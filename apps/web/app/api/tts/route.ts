import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  let text = ''
  try {
    const body = await req.json()
    text = (body?.text ?? '').toString()
    if (!text) throw new Error('no-json')
    var voice = (body?.voice ?? 'alloy').toString()
    var speed = Number(body?.speed ?? 1.0)
    var format = (body?.format ?? 'mp3').toString()
    var provider = (body?.provider ?? 'openai').toString()
    var elevenVoice = (body?.elevenVoiceId ?? process.env.ELEVENLABS_VOICE_ID ?? '').toString()
  } catch {
    // Fallback to query param for robustness
    const url = new URL(req.url)
    text = url.searchParams.get('text') || ''
    voice = url.searchParams.get('voice') || 'alloy'
    speed = Number(url.searchParams.get('speed') || '1.0')
    format = url.searchParams.get('format') || 'mp3'
    provider = url.searchParams.get('provider') || 'openai'
    elevenVoice = url.searchParams.get('elevenVoiceId') || (process.env.ELEVENLABS_VOICE_ID || '')
  }
  if (!text) return new Response('text required', { status: 400 })

  // ElevenLabs provider
  if (provider === 'elevenlabs') {
    const key = process.env.ELEVENLABS_API_KEY
    const voiceId = elevenVoice || '21m00Tcm4TlvDq8ikWAM' // fallback voice id
    if (!key) return new Response('missing ELEVENLABS_API_KEY', { status: 402 })
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
        voice_settings: { stability: 0.4, similarity_boost: 0.8 },
      }),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    const arr = await res.arrayBuffer()
    return new Response(arr, { headers: { 'Content-Type': 'audio/mpeg' } })
  }

  // Azure provider via REST (SSML). Note: REST does not return word timings; for exact timings use client SDK.
  if (provider === 'azure') {
    const key = process.env.AZURE_SPEECH_KEY
    const region = process.env.AZURE_SPEECH_REGION
    const voiceName = process.env.AZURE_SPEECH_VOICE || 'en-US-JennyNeural'
    if (!key || !region) return new Response('missing AZURE_SPEECH_KEY/REGION', { status: 402 })
    const ssml = `<?xml version="1.0" encoding="utf-8"?>
<speak version="1.0" xml:lang="en-US">
  <voice name="${voiceName}">
    <prosody rate="${Math.round(speed*100)}%">${text.replace(/&/g,'&amp;')}</prosody>
  </voice>
</speak>`
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      },
      body: ssml,
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    const arr = await res.arrayBuffer()
    return new Response(arr, { headers: { 'Content-Type': 'audio/mpeg' } })
  }

  // Default OpenAI provider
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'
  if (!apiKey) return new Response('missing OPENAI_API_KEY', { status: 402 })

  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, voice, input: text, format, speed }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return new Response(body || 'TTS failed', { status: res.status })
    }
    const arr = await res.arrayBuffer()
    return new Response(arr, { headers: { 'Content-Type': 'audio/mpeg' } })
  } catch (e: any) {
    return new Response(String(e?.message || 'TTS error'), { status: 500 })
  }
}
