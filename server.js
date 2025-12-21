// server.js (local dev)
// Serves static files + provides /api/voice/* endpoints to mint ephemeral keys.
// On Vercel, these endpoints live in /api (serverless).

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const STATIC_DIR = process.env.STATIC_DIR || __dirname;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VOICE_SESSION_SECRET = process.env.VOICE_SESSION_SECRET;

console.log('[env]', {
  cwd: process.cwd(),
  OPENAI_API_KEY: OPENAI_API_KEY ? 'SET' : 'MISSING',
  VOICE_SESSION_SECRET: VOICE_SESSION_SECRET ? 'SET' : 'MISSING',
});

if (!OPENAI_API_KEY) console.warn('[WARN] OPENAI_API_KEY not set');
if (!VOICE_SESSION_SECRET) console.warn('[WARN] VOICE_SESSION_SECRET not set');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(STATIC_DIR));

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function sign(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${data}.${sig}`;
}
function base64urlToBuf(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}
function verify(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, error: 'Bad token' };
  const [h, p, sig] = parts;
  const data = `${h}.${p}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  if (expected !== sig) return { ok: false, error: 'Bad signature' };
  const payload = JSON.parse(base64urlToBuf(p).toString('utf-8'));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return { ok: false, error: 'Expired token' };
  return { ok: true, payload };
}

app.get('/api/ping', (_req, res) => res.json({ ok: true, now: Date.now() }));

app.post('/api/voice/session', (req, res) => {
  if (!VOICE_SESSION_SECRET) return res.status(500).json({ error: 'VOICE_SESSION_SECRET not set' });
  const userId = req.body?.userId || 'anon';
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = 10 * 60;
  const token = sign({ uid: userId, iat: now, exp: now + ttlSeconds }, VOICE_SESSION_SECRET);
  res.json({ sessionToken: token, expiresIn: ttlSeconds });
});

app.post('/api/voice/realtime-key', async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });
  if (!VOICE_SESSION_SECRET) return res.status(500).json({ error: 'VOICE_SESSION_SECRET not set' });

  const { sessionToken, model, voice, instructions } = req.body || {};
  if (!sessionToken) return res.status(400).json({ error: 'sessionToken is required' });

  const v = verify(sessionToken, VOICE_SESSION_SECRET);
  if (!v.ok) return res.status(401).json({ error: v.error });

  const useModel = model || process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-mini-realtime-preview';
  const useVoice = voice || process.env.OPENAI_VOICE || 'alloy';
  const useInstructions =
    instructions ||
    process.env.OPENAI_REALTIME_INSTRUCTIONS ||
    'You are a helpful voice assistant. Be conversational, friendly, and concise.';

  const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'realtime=v1',
    },
    body: JSON.stringify({
      model: useModel,
      modalities: ['audio', 'text'],
      voice: useVoice,
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      instructions: useInstructions,
      turn_detection: {
        type: 'server_vad',
        threshold: 0.9,
        prefix_padding_ms: 200,
        silence_duration_ms: 900,
        create_response: true,
        interrupt_response: true,
      },
    }),
  });

  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }

  if (!r.ok) {
    return res.status(502).json({ error: 'OpenAI error', status: r.status, detail: text.slice(0, 1500) });
  }

  const ek = json?.client_secret?.value;
  if (!ek) return res.status(502).json({ error: 'No client_secret', detail: json || text });

  res.json({
    ephemeralKey: ek,
    sessionId: json?.id,
    expiresAt: json?.client_secret?.expires_at || null,
    userId: v.payload.uid,
  });
});

app.get('*', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));

app.listen(PORT, () => console.log(`[local] http://localhost:${PORT}`));
