// config.js (browser)
// Browser never sees OPENAI_API_KEY. It only talks to our backend /api/voice/*
// which mints an ephemeral key (ek_...) for the Realtime WebSocket.

const Config = {
  OPENAI: {
    API_URL: 'wss://api.openai.com/v1/realtime',
    MODEL: 'gpt-4o-mini-realtime-preview',
    VOICE: 'alloy',
    MODALITIES: ['audio', 'text'],
    INSTRUCTIONS:
      'You are a helpful voice assistant. Be conversational, friendly, and concise. If unsure, ask a clarifying question.',
  },

  AUDIO: {
    SAMPLE_RATE: 24000,
    CHANNELS: 1,
    PROCESSOR_BUFFER_SIZE: 4096,
  },

  UI: {
    PLAYBACK_VOLUME: 0.35,
  },

  async mintEphemeralKey({ userId = 'anon' } = {}) {
    const s = await fetch('/api/voice/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!s.ok) {
      const t = await s.text().catch(() => '');
      throw new Error(`Failed to create voice session (${s.status}): ${t}`);
    }
    const session = await s.json();
    const sessionToken = session.sessionToken;
    if (!sessionToken) throw new Error('Voice session did not return sessionToken');

    const r = await fetch('/api/voice/realtime-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken,
        model: Config.OPENAI.MODEL,
        voice: Config.OPENAI.VOICE,
        instructions: Config.OPENAI.INSTRUCTIONS,
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(`Failed to mint ephemeral key (${r.status}): ${t}`);
    }
    const data = await r.json();
    if (!data.ephemeralKey) throw new Error('No ephemeralKey returned from server');
    return data.ephemeralKey;
  },
};
