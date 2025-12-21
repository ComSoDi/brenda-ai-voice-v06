// voiceAgent.js (browser)
// Ephemeral-key Realtime WebSocket client (safe for Vercel/public).
// Key fixes:
//  - Audio initialised inside Connect click (user gesture) -> avoids AudioContext null/suspended
//  - Mic processor is silent (no monitoring/feedback)
//  - Output chunks scheduled sequentially (no overlap / "multiple voices")

(function () {
  class VoiceAgent {
    constructor() {
      this.ws = null;

      this.audioContext = null;
      this.mediaStream = null;
      this.processor = null;

      this.outputGain = null;
      this.nextPlayTime = 0;

      this.isConnected = false;
      this.isRecording = false;
      this.isSpeaking = false;

      this.currentResponseId = null;
      this.lastResponseTime = 0;
      this.RESPONSE_COOLDOWN = 1200;

      this._audioInitPromise = null;

      this.onStatusChange = null;
      this.onTranscript = null;
      this.onAudioData = null;
      this.onError = null;
    }

    updateStatus(status) {
      if (this.onStatusChange) this.onStatusChange(status);
    }

    async connect(userId = 'anon') {
      if (this.isConnected || this.ws) return;

      try {
        this.updateStatus('connecting');

        // Initialise audio under user gesture (connect() called from click)
        await this.ensureAudioReady();

        // Mint ephemeral key
        const ephemeralKey = await Config.mintEphemeralKey({ userId });

        // Connect to OpenAI Realtime WS
        const url = `${Config.OPENAI.API_URL}?model=${encodeURIComponent(Config.OPENAI.MODEL)}`;
        this.ws = new WebSocket(url, [
          'realtime',
          `openai-insecure-api-key.${ephemeralKey}`,
          'openai-beta.realtime-v1',
        ]);

        this.ws.onopen = () => this.handleOpen();
        this.ws.onmessage = (ev) => this.handleMessage(ev);
        this.ws.onerror = (err) => this.handleError(err);
        this.ws.onclose = () => this.handleClose();
      } catch (e) {
        this.handleError(e);
      }
    }

    handleOpen() {
      this.sendEvent({
        type: 'session.update',
        session: {
          modalities: Config.OPENAI.MODALITIES,
          instructions: Config.OPENAI.INSTRUCTIONS,
          voice: Config.OPENAI.VOICE,
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.9,
            prefix_padding_ms: 200,
            silence_duration_ms: 900,
            create_response: true,
            interrupt_response: true,
          },
        },
      });

      this.isConnected = true;
      this.isRecording = true;
      this.updateStatus('connected');
    }

    handleMessage(event) {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (data.type) {
        case 'conversation.item.input_audio_transcription.completed':
          if (this.onTranscript && data.transcript) this.onTranscript('user', data.transcript);
          break;

        case 'response.created': {
          const newId = data.response?.id;
          if (!newId) break;

          const dt = Date.now() - this.lastResponseTime;
          if (this.currentResponseId || dt < this.RESPONSE_COOLDOWN) {
            this.sendEvent({ type: 'response.cancel', response_id: newId });
            break;
          }

          this.currentResponseId = newId;
          this.lastResponseTime = Date.now();
          this.isSpeaking = true;
          this.updateStatus('speaking');
          this.resetPlaybackScheduler();
          break;
        }

        case 'response.audio_transcript.delta':
          if (this.onTranscript && data.delta) this.onTranscript('assistant', data.delta);
          break;

        case 'response.audio.delta':
          if (data.response_id === this.currentResponseId && data.delta) {
            this.playAudioChunkScheduled(data.delta);
          }
          break;

        case 'response.done':
          if (data.response?.id === this.currentResponseId) {
            this.sendEvent({ type: 'input_audio_buffer.clear' });
            setTimeout(() => {
              this.isSpeaking = false;
              this.currentResponseId = null;
              this.updateStatus('connected');
            }, 250);
          }
          break;

        case 'error':
          this.handleError(new Error(data.error?.message || 'Realtime error'));
          break;
      }
    }

    async ensureAudioReady() {
      if (this._audioInitPromise) return this._audioInitPromise;

      this._audioInitPromise = (async () => {
        // Create AudioContext if needed
        if (!this.audioContext || this.audioContext.state === 'closed') {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: Config.AUDIO.SAMPLE_RATE,
          });
        }

        // Resume if suspended (allowed because we're inside a click)
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        // Output chain
        this.outputGain = this.audioContext.createGain();
        this.outputGain.gain.value = Config.UI.PLAYBACK_VOLUME ?? 0.35;
        this.outputGain.connect(this.audioContext.destination);
        this.resetPlaybackScheduler();

        // Mic
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: Config.AUDIO.SAMPLE_RATE,
            channelCount: Config.AUDIO.CHANNELS,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (!this.audioContext) throw new Error('AudioContext missing');
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);

        const processor = this.audioContext.createScriptProcessor(
          Config.AUDIO.PROCESSOR_BUFFER_SIZE || 4096,
          1,
          1
        );

        processor.onaudioprocess = (e) => {
          if (!this.isRecording) return;
          if (this.isSpeaking) return;
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          this.sendEvent({
            type: 'input_audio_buffer.append',
            audio: this.arrayBufferToBase64(int16.buffer),
          });

          if (this.onAudioData) this.onAudioData(inputData);
        };

        source.connect(processor);

        // Silent monitor path (no feedback)
        const silentGain = this.audioContext.createGain();
        silentGain.gain.value = 0;
        processor.connect(silentGain);
        silentGain.connect(this.audioContext.destination);

        this.processor = processor;
      })();

      return this._audioInitPromise;
    }

    resetPlaybackScheduler() {
      if (!this.audioContext) return;
      this.nextPlayTime = this.audioContext.currentTime;
    }

    playAudioChunkScheduled(base64Audio) {
      if (!this.audioContext || !this.outputGain) return;

      try {
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
        }

        const buf = this.audioContext.createBuffer(1, float32.length, Config.AUDIO.SAMPLE_RATE);
        buf.getChannelData(0).set(float32);

        const src = this.audioContext.createBufferSource();
        src.buffer = buf;
        src.connect(this.outputGain);

        const now = this.audioContext.currentTime;
        if (this.nextPlayTime < now) this.nextPlayTime = now;

        src.start(this.nextPlayTime);
        this.nextPlayTime += buf.duration;
      } catch (e) {
        console.error('Audio playback error:', e);
      }
    }

    sendEvent(event) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(event));
      }
    }

    arrayBufferToBase64(buffer) {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    }

    disconnect() {
      try { if (this.ws) this.ws.close(); } catch {}
      this.cleanup();
    }

    cleanup() {
      this.isRecording = false;
      this.isConnected = false;
      this.isSpeaking = false;
      this.currentResponseId = null;

      try { if (this.processor) this.processor.disconnect(); } catch {}
      this.processor = null;

      try { if (this.mediaStream) this.mediaStream.getTracks().forEach((t) => t.stop()); } catch {}
      this.mediaStream = null;

      try { if (this.outputGain) this.outputGain.disconnect(); } catch {}
      this.outputGain = null;

      try { if (this.audioContext && this.audioContext.state !== 'closed') this.audioContext.close(); } catch {}
      this.audioContext = null;

      this.ws = null;
      this._audioInitPromise = null;
      this.nextPlayTime = 0;

      this.updateStatus('disconnected');
    }

    handleError(err) {
      console.error('VoiceAgent error:', err);
      if (this.onError) this.onError(err);
      this.updateStatus('error');
    }

    handleClose() {
      this.cleanup();
    }
  }

  window.VoiceAgent = VoiceAgent;
})();
