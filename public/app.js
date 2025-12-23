// public/app.js (module)
import { detectLocale } from "./locale.js";
import { t } from "./i18n.js";

class VoiceAgentApp {
  constructor() {
    this.agent = new window.VoiceAgent();
    this.transcriptBuffer = { user: "", assistant: "" };

    this.locale = detectLocale(); // { lang, variant }

    this.elements = {
      status: document.getElementById("status"), // can be hidden (sr-only) but useful for debugging
      toggleBtn: document.getElementById("toggleBtn"),
      hintText: document.getElementById("hintText"),
      transcript: document.getElementById("transcript"),
      canvas: document.getElementById("waveform"),
      avatar: document.getElementById("brendaAvatar"),
    };

    this.canvasCtx = this.elements.canvas.getContext("2d");
    this.audioData = new Float32Array(128);

    this.init();
  }

  init() {
    // Localise UI
    if (this.elements.hintText) {
      this.elements.hintText.textContent = t(this.locale.variant, "hint");
    }

    // Transcript placeholder via CSS attr(data-placeholder)
    if (this.elements.transcript) {
      this.elements.transcript.setAttribute(
        "data-placeholder",
        t(this.locale.variant, "placeholder")
      );
    }

    // Initial status + button state
    if (this.elements.status) {
      this.elements.status.textContent = t(this.locale.variant, "disconnected");
    }

    if (!this.elements.toggleBtn) {
      throw new Error('Missing #toggleBtn in index.html');
    }

    // Initial: Connect (green)
    this.setToggleButtonState({ connected: false, disabled: false });

    // One-button connect/disconnect
    this.elements.toggleBtn.addEventListener("click", () => this.toggleConnection());

    // Agent callbacks
    this.agent.onStatusChange = (s) => this.updateStatus(s);
    this.agent.onTranscript = (role, text) => this.addTranscript(role, text);
    this.agent.onAudioData = (data) => this.updateWaveform(data);
    this.agent.onError = (err) => this.showError(err);

    this.animateWaveform();
  }

  async toggleConnection() {
    const isDisconnect = this.elements.toggleBtn.classList.contains("btn-disconnect");

    if (isDisconnect) {
      this.disconnect();
      return;
    }

    // Connect path
    try {
      this.setToggleButtonState({ connected: false, disabled: true }); // disable while connecting
      this.elements.transcript.innerHTML = "";
      this.transcriptBuffer = { user: "", assistant: "" };

      await this.agent.connect("anon", this.locale.variant);
      // updateStatus("connected") will flip button to Disconnect automatically
    } catch (e) {
      console.error(e);
      alert("Connect failed: " + e.message);
      this.setToggleButtonState({ connected: false, disabled: false });
    }
  }

  disconnect() {
    this.agent.disconnect();
    // updateStatus("disconnected") will flip button back to Connect
  }

  setToggleButtonState({ connected, disabled }) {
    const btn = this.elements.toggleBtn;
    btn.disabled = !!disabled;

    if (connected) {
      btn.textContent = t(this.locale.variant, "disconnect");
      btn.classList.remove("btn-connect");
      btn.classList.add("btn-disconnect");
    } else {
      btn.textContent = t(this.locale.variant, "connect");
      btn.classList.add("btn-connect");
      btn.classList.remove("btn-disconnect");
    }
  }

  updateStatus(status) {
    // Keep status text for debugging / accessibility (you can keep it sr-only in CSS)
    const labelKey =
      status === "disconnected" ? "disconnected" :
      status === "connecting" ? "connecting" :
      status === "connected" ? "connected" :
      status === "speaking" ? "speaking" : status;

    if (this.elements.status) {
      this.elements.status.textContent = t(this.locale.variant, labelKey);

      // Preserve any sr-only class you applied in HTML/CSS by only appending the state class.
      // If you prefer, set className explicitly (e.g. "status sr-only " + status).
      const base = this.elements.status.className.includes("status") ? "" : "status ";
      this.elements.status.className = `${base}${this.elements.status.className} ${status}`.trim();
    }

    // Optional: avatar glow while speaking
    if (this.elements.avatar) {
      this.elements.avatar.classList.toggle("speaking", status === "speaking");
    }

    // Toggle button behaviour:
    if (status === "connected" || status === "speaking") {
      this.setToggleButtonState({ connected: true, disabled: false });
    } else if (status === "connecting") {
      // Keep it in Connect mode but disabled while connecting
      this.setToggleButtonState({ connected: false, disabled: true });
    } else {
      // disconnected / error
      this.setToggleButtonState({ connected: false, disabled: false });
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

    // Baseline at the bottom
    const baselineY = c.height - 6;   // small padding from bottom
    const maxHeight = c.height - 12;  // keep a bit of top/bottom padding

    ctx.strokeStyle = "#667eea";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const slice = c.width / this.audioData.length;
    let x = 0;

    for (let i = 0; i < this.audioData.length; i++) {
      const v = Math.max(0, Math.min(1, this.audioData[i])); // clamp 0..1

      // Bigger v -> go UP (smaller y)
      const y = baselineY - v * maxHeight;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      x += slice;
    }

    ctx.stroke();

    // Draw the baseline (optional, helps readability)
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(c.width, baselineY);
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
