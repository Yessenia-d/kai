import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const text: string = (body?.text || '').toString()
    const provider: string = (body?.provider || 'elevenlabs').toString()
    const voiceId: string = (body?.elevenVoiceId || process.env.ELEVENLABS_VOICE_ID || '').toString()
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

    // Mock subtitles for now; evenly distribute across words
    const words = text.split(/\s+/).filter(Boolean)
    const total = Math.max(1, words.length)
    const dur = 3 + Math.min(9, Math.round(words.length * 0.3)) // 3–12s heuristic
    const step = (dur * 1000) / total
    const timeline = words.map((w, i) => ({ word: w, offsetMs: Math.round(i * step), durationMs: Math.round(step) }))
    return NextResponse.json({ timeline, provider })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'subtitles error' }, { status: 500 })
  }
}

