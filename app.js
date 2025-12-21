// app.js (module)
// UI wiring only

class VoiceAgentApp {
  constructor() {
    this.agent = new window.VoiceAgent();
    this.transcriptBuffer = { user: '', assistant: '' };

    this.elements = {
      status: document.getElementById('status'),
      connectBtn: document.getElementById('connectBtn'),
      disconnectBtn: document.getElementById('disconnectBtn'),
      transcript: document.getElementById('transcript'),
      canvas: document.getElementById('waveform'),
    };

    this.canvasCtx = this.elements.canvas.getContext('2d');
    this.audioData = new Float32Array(128);

    this.initialize();
  }

  initialize() {
    this.elements.connectBtn.addEventListener('click', () => this.connect());
    this.elements.disconnectBtn.addEventListener('click', () => this.disconnect());

    this.agent.onStatusChange = (status) => this.updateStatus(status);
    this.agent.onTranscript = (role, text) => this.addTranscript(role, text);
    this.agent.onAudioData = (data) => this.updateWaveform(data);
    this.agent.onError = (error) => this.showError(error);

    this.animateWaveform();
    console.log('Voice Agent initialized');
  }

  getUserIdForVoice() {
    return 'anon';
  }

  async connect() {
    try {
      this.elements.connectBtn.disabled = true;
      this.elements.transcript.innerHTML = '';
      this.transcriptBuffer = { user: '', assistant: '' };

      await this.agent.connect(this.getUserIdForVoice());
    } catch (e) {
      console.error('Connect failed:', e);
      alert('Connect failed: ' + e.message);
      this.elements.connectBtn.disabled = false;
    }
  }

  disconnect() {
    this.agent.disconnect();
  }

  updateStatus(status) {
    this.elements.status.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    this.elements.status.className = 'status ' + status;

    switch (status) {
      case 'connected':
        this.elements.connectBtn.disabled = true;
        this.elements.disconnectBtn.disabled = false;
        break;
      case 'disconnected':
      case 'error':
        this.elements.connectBtn.disabled = false;
        this.elements.disconnectBtn.disabled = true;
        break;
      case 'connecting':
      case 'speaking':
        this.elements.connectBtn.disabled = true;
        this.elements.disconnectBtn.disabled = true;
        break;
    }
  }

  addTranscript(role, text) {
    this.transcriptBuffer[role] += text;
    this.renderTranscript();
  }

  renderTranscript() {
    let html = '';

    if (this.transcriptBuffer.user) {
      html += `
        <div class="transcript-item">
          <div class="transcript-label">You:</div>
          <div>${this.escapeHtml(this.transcriptBuffer.user)}</div>
        </div>
      `;
    }

    if (this.transcriptBuffer.assistant) {
      html += `
        <div class="transcript-item">
          <div class="transcript-label assistant">Assistant:</div>
          <div>${this.escapeHtml(this.transcriptBuffer.assistant)}</div>
        </div>
      `;
    }

    this.elements.transcript.innerHTML = html;
    this.elements.transcript.scrollTop = this.elements.transcript.scrollHeight;
  }

  updateWaveform(data) {
    const step = Math.floor(data.length / this.audioData.length);
    for (let i = 0; i < this.audioData.length; i++) {
      this.audioData[i] = Math.abs(data[i * step]) || 0;
    }
  }

  animateWaveform() {
    const canvas = this.elements.canvas;
    const ctx = this.canvasCtx;
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / this.audioData.length;
    let x = 0;

    for (let i = 0; i < this.audioData.length; i++) {
      const v = this.audioData[i];
      const y = height / 2 + (v * height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();

    requestAnimationFrame(() => this.animateWaveform());
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showError(error) {
    alert('Error: ' + (error?.message || String(error)));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.__app = new VoiceAgentApp();
});
