export interface Env {
  OPENAI_API_KEY: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  ALLOWED_ORIGIN?: string
  OPENAI_TRANSCRIPTION_MODEL?: string
}

type TimedLyric = {
  start: number
  end: number
  text: string
}

const json = (body: unknown, status = 200, origin = '*') => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  },
})

const allowedOrigin = (request: Request, env: Env) => {
  const configured = env.ALLOWED_ORIGIN?.trim()
  const requestOrigin = request.headers.get('Origin') || ''
  if (!configured) return requestOrigin || '*'
  return requestOrigin === configured ? configured : configured
}

async function verifyStudioStaff(request: Request, env: Env) {
  const authorization = request.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) return false
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new Error('Supabase Worker secrets are not configured.')

  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/studio_load_cms`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })

  return response.ok
}

function validateAudioUrl(value: string, env: Env) {
  const audioUrl = new URL(value)
  const supabaseUrl = new URL(env.SUPABASE_URL)
  if (audioUrl.protocol !== 'https:') throw new Error('Audio URL must use HTTPS.')
  if (audioUrl.hostname !== supabaseUrl.hostname) throw new Error('Audio must come from this EBG+ Supabase project.')
  return audioUrl
}

function filenameFromUrl(url: URL, contentType: string) {
  const raw = decodeURIComponent(url.pathname.split('/').pop() || '').trim()
  if (raw && raw.includes('.')) return raw
  if (contentType.includes('wav')) return 'track.wav'
  if (contentType.includes('flac')) return 'track.flac'
  if (contentType.includes('mp4') || contentType.includes('m4a')) return 'track.m4a'
  if (contentType.includes('ogg')) return 'track.ogg'
  return 'track.mp3'
}

async function transcribeLyrics(audioUrlValue: string, env: Env) {
  const audioUrl = validateAudioUrl(audioUrlValue, env)
  const audioResponse = await fetch(audioUrl.toString())
  if (!audioResponse.ok) throw new Error(`Uploaded audio could not be fetched (${audioResponse.status}).`)

  const maxBytes = 24 * 1024 * 1024
  const declaredSize = Number(audioResponse.headers.get('content-length') || 0)
  if (declaredSize > maxBytes) throw new Error('This audio file is larger than 24 MB. Upload a smaller MP3/M4A for lyric transcription.')

  const audioBlob = await audioResponse.blob()
  if (audioBlob.size > maxBytes) throw new Error('This audio file is larger than 24 MB. Upload a smaller MP3/M4A for lyric transcription.')
  if (!audioBlob.size) throw new Error('The uploaded audio file is empty.')

  const contentType = audioBlob.type || audioResponse.headers.get('content-type') || 'audio/mpeg'
  const form = new FormData()
  form.append('file', new File([audioBlob], filenameFromUrl(audioUrl, contentType), { type: contentType }))
  form.append('model', env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1')
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')
  form.append('temperature', '0')
  form.append('prompt', 'Transcribe the sung vocals faithfully as song lyrics. Preserve repeated lyric lines and short vocal phrases. Do not invent words for instrumental sections.')

  const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: form,
  })

  const payload = await transcriptionResponse.json().catch(() => ({})) as {
    text?: string
    duration?: number
    language?: string
    segments?: Array<{ start?: number; end?: number; text?: string }>
    error?: { message?: string }
  }

  if (!transcriptionResponse.ok) {
    throw new Error(payload.error?.message || `Transcription failed (${transcriptionResponse.status}).`)
  }

  const lines: TimedLyric[] = (payload.segments || [])
    .map((segment) => ({
      start: Math.max(0, Number(segment.start || 0)),
      end: Math.max(0, Number(segment.end || segment.start || 0)),
      text: String(segment.text || '').trim(),
    }))
    .filter((line) => line.text.length > 0)
    .map((line) => ({ ...line, end: Math.max(line.end, line.start + 0.1) }))

  if (!lines.length && payload.text?.trim()) {
    lines.push({ start: 0, end: Math.max(Number(payload.duration || 0), 0.1), text: payload.text.trim() })
  }

  return {
    text: lines.map((line) => line.text).join('\n'),
    timedLyrics: lines,
    language: payload.language || null,
    duration: Number(payload.duration || (lines.at(-1)?.end ?? 0)),
    model: env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1',
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(request, env)
    if (request.method === 'OPTIONS') return json({ ok: true }, 200, origin)

    const url = new URL(request.url)
    if (url.pathname === '/health') return json({ ok: true, service: 'ebg-studio-lyrics' }, 200, origin)
    if (url.pathname !== '/transcribe-lyrics' || request.method !== 'POST') return json({ error: 'Not found.' }, 404, origin)

    try {
      if (!env.OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY is not configured.' }, 500, origin)
      const isStaff = await verifyStudioStaff(request, env)
      if (!isStaff) return json({ error: 'EBG Studio staff access required.' }, 403, origin)

      const body = await request.json().catch(() => ({})) as { audioUrl?: string }
      if (!body.audioUrl?.trim()) return json({ error: 'audioUrl is required.' }, 400, origin)

      const result = await transcribeLyrics(body.audioUrl.trim(), env)
      return json(result, 200, origin)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Timed lyric transcription failed.' }, 500, origin)
    }
  },
}
