# Voice-to-Voice MVP (Ephemeral Keys) — Local + Vercel

## Local (Win11 / VS Code)
1) Copy `.env-example` → `.env` and set:
   - OPENAI_API_KEY
   - VOICE_SESSION_SECRET (any long random string)

2) Install + run:
```bash
npm install
npm run dev
```

3) Open:
- http://localhost:3000
- Health test: http://localhost:3000/api/ping

## Vercel
1) Push to GitHub
2) Import to Vercel
3) Add env vars (Production + Preview):
   - OPENAI_API_KEY
   - VOICE_SESSION_SECRET
   - (optional) OPENAI_REALTIME_MODEL, OPENAI_VOICE, OPENAI_REALTIME_INSTRUCTIONS
4) Deploy

## Architecture
- Browser calls:
  - POST /api/voice/session  -> signed sessionToken
  - POST /api/voice/realtime-key -> returns ephemeralKey (ek_...)
- Browser uses that ephemeralKey to connect to OpenAI Realtime via WebSocket.

## Troubleshooting
- If mic permission fails: check browser site permissions (Microphone: Allow)
- If audio is silent: ensure system output device is correct and volume > 0
- If Connect seems stuck: open DevTools → Network and check the /api/voice/* calls.
