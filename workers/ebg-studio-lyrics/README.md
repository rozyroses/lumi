# EBG Studio Timed Lyrics Worker

Dedicated Cloudflare Worker for turning uploaded EBG+ music audio into timestamped lyric lines.

## What it does

- Requires the signed-in EBG Studio bearer token.
- Verifies staff access through the existing `studio_load_cms` Supabase RPC.
- Only fetches audio from the configured EBG+ Supabase project host.
- Sends the audio server-side to the OpenAI Audio Transcriptions API.
- Returns normalized `timedLyrics` entries shaped like `{ start, end, text }`.
- Keeps `OPENAI_API_KEY` out of browser code.

## Required Worker secrets

From this directory, configure:

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
```

Optional model override:

```bash
npx wrangler secret put OPENAI_TRANSCRIPTION_MODEL
```

The default model is `whisper-1` because the endpoint supports verbose segment timestamps used by the EBG+ synced-lyrics UI.

## Deploy

```bash
npm install
npm run deploy
```

The Worker name is `ebg-studio-lyrics`. After deployment, set EBG Studio's `VITE_STUDIO_LYRICS_URL` to the Worker base URL, for example `https://ebg-studio-lyrics.<your-subdomain>.workers.dev`.

## Endpoints

- `GET /health`
- `POST /transcribe-lyrics` with JSON `{ "audioUrl": "https://..." }` and `Authorization: Bearer <studio access token>`.
