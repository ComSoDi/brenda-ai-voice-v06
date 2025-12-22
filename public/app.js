// public/app.js (module)
import { detectLocale } from "./locale.js";
import { t } from "./i18n.js";

class VoiceAgentApp {
  constructor() {
    this.agent = new window.VoiceAgent();
    this.transcriptBuffer = { user: "", assistant: "" };

    this.locale = detectLocale(); // { lang, variant }

    this.elements = {
      status: document.getElementById("status"),
      connectBtn: document.getElementById("connectBtn"),
      disconnectBtn: document.getElementById("disconnectBtn"),
      hintText: document.getElementById("hintText"),
      transcript: document.getElementById("transcript"),
      canvas: document.getElementById("waveform")
    };

    this.canvasCtx = this.elements.canvas.getContext("2d");
    this.audioData = new Float32Array(128);

    this.init();
  }

  init() {
    this.elements.connectBtn.textContent = t(this.locale.variant, "connect");
    this.elements.disconnectBtn.textContent = t(this.locale.variant, "disconnect");
    if (this.elements.hintText) this.elements.hintText.textContent = t(this.locale.variant, "hint");
    this.elements.status.textContent = t(this.locale.variant, "disconnected");
    this.elements.transcript.setAttribute(
      "data-placeholder",
      t(this.locale.variant, "placeholder")
    );

    this.elements.connectBtn.addEventListener("click", () => this.connect());
    this.elements.disconnectBtn.addEventListener("click", () => this.disconnect());

    this.agent.onStatusChange = (s) => this.updateStatus(s);
    this.agent.onTranscript = (role, text) => this.addTranscript(role, text);
    this.agent.onAudioData = (data) => this.updateWaveform(data);
    this.agent.onError = (err) => this.showError(err);

    this.animateWaveform();
  }

  async connect() {
    try {
      this.elements.connectBtn.disabled = true;
      this.elements.transcript.innerHTML = "";
      this.transcriptBuffer = { user: "", assistant: "" };

      await this.agent.connect("anon", this.locale.variant);
    } catch (e) {
      console.error(e);
      alert("Connect failed: " + e.message);
      this.elements.connectBtn.disabled = false;
    }
  }

  disconnect() {
    this.agent.disconnect();
  }

  updateStatus(status) {
    const labelKey =
      status === "disconnected" ? "disconnected" :
      status === "connecting" ? "connecting" :
      status === "connected" ? "connected" :
      status === "speaking" ? "speaking" : status;

    this.elements.status.textContent = t(this.locale.variant, labelKey);
    this.elements.status.className = "status " + status;

    if (status === "connected") {
      this.elements.connectBtn.disabled = true;
      this.elements.disconnectBtn.disabled = false;
    } else if (status === "disconnected" || status === "error") {
      this.elements.connectBtn.disabled = false;
      this.elements.disconnectBtn.disabled = true;
    } else {
      this.elements.connectBtn.disabled = true;
      this.elements.disconnectBtn.disabled = true;
    }
  }

  addTranscript(role, text) {
    this.transcriptBuffer[role] += text;
    this.renderTranscript();
  }

  renderTranscript() {
    const esc = (t0) => {
      const d = document.createElement("div");
      d.textContent = t0;
      return d.innerHTML;
    };

    let html = "";
    if (this.transcriptBuffer.user) {
      html += `
        <div class="transcript-item">
          <div class="transcript-label">${t(this.locale.variant, "youLabel")}</div>
          <div>${esc(this.transcriptBuffer.user)}</div>
        </div>`;
    }

    if (this.transcriptBuffer.assistant) {
      html += `
        <div class="transcript-item">
          <div class="transcript-label assistant">${t(this.locale.variant, "assistantLabel")}</div>
          <div>${esc(this.transcriptBuffer.assistant)}</div>
        </div>`;
    }
    this.elements.transcript.innerHTML = html;
    this.elements.transcript.scrollTop = this.elements.transcript.scrollHeight;
  }

  updateWaveform(floatTimeDomain) {
    const step = Math.floor(floatTimeDomain.length / this.audioData.length);
    for (let i = 0; i < this.audioData.length; i++) {
      this.audioData[i] = Math.abs(floatTimeDomain[i * step]) || 0;
    }
  }

  animateWaveform() {
    const c = this.elements.canvas;
    const ctx = this.canvasCtx;
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.strokeStyle = "#667eea";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const slice = c.width / this.audioData.length;
    let x = 0;
    for (let i = 0; i < this.audioData.length; i++) {
      const y = c.height / 2 + (this.audioData[i] * c.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += slice;
    }
    ctx.lineTo(c.width, c.height / 2);
    ctx.stroke();
    requestAnimationFrame(() => this.animateWaveform());
  }

  showError(err) {
    alert("Error: " + (err?.message || String(err)));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.__app = new VoiceAgentApp();
});
