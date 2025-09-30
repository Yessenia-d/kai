import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'form-data required' }, { status: 400 })
    }
    const form = await req.formData()
    const file = form.get('audio') as File | null
    const targetLang = String(form.get('targetLanguage') || 'en')
    const provider = String(form.get('provider') || 'openai')
    if (!file) return NextResponse.json({ error: 'audio required' }, { status: 400 })

    // Azure Pronunciation Assessment path
    if (provider === 'azure') {
      const key = process.env.AZURE_SPEECH_KEY
      const region = process.env.AZURE_SPEECH_REGION
      const lang = targetLang === 'ja' ? 'ja-JP' : 'en-US'
      if (!key || !region) {
        return NextResponse.json({ error: 'missing AZURE_SPEECH_KEY/REGION' }, { status: 400 })
      }
      const endpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(lang)}&format=detailed`
      const config = {
        ReferenceText: '',
        GradingSystem: 'HundredMark',
        Granularity: 'Phoneme',
        EnableMiscue: true,
        Dimension: 'Comprehensive',
        EnableProsodyAssessment: true,
      }
      const paHeader = Buffer.from(JSON.stringify(config)).toString('base64')
      const rawType = file.type || 'audio/wav'
      const contentType = rawType.includes('wav') ? 'audio/wav; codecs=audio/pcm' : (rawType.startsWith('audio/webm') ? 'audio/webm; codecs=opus' : rawType)
      const headers: Record<string, string> = {
        'Ocp-Apim-Subscription-Key': key,
        'Pronunciation-Assessment': paHeader,
        'Accept': 'application/json',
        'Content-Type': contentType,
      }
      const audioBuf = Buffer.from(await file.arrayBuffer())
      const az = await fetch(endpoint, { method: 'POST', headers, body: audioBuf })
      if (!az.ok) {
        const text = await az.text().catch(() => '')
        return NextResponse.json({ error: text || 'azure error' }, { status: az.status })
      }
      const result = await az.json()
      console.log('azure result', result)
      const nbest = (result?.NBest && result.NBest[0]) || {}
      const pa = nbest?.PronunciationAssessment || {}
      const words = (nbest?.Words || []).map((w: any) => ({
        word: w.Word,
        offsetMs: Math.round((w.Offset || 0) / 10000),
        durationMs: Math.round((w.Duration || 0) / 10000),
        accuracyScore: w.PronunciationAssessment?.AccuracyScore,
        errorType: w.PronunciationAssessment?.ErrorType,
        phonemes: Array.isArray(w.Phonemes)
          ? w.Phonemes.map((p: any) => ({
              phoneme: p.Phoneme,
              offsetMs: Math.round((p.Offset || 0) / 10000),
              durationMs: Math.round((p.Duration || 0) / 10000),
              accuracyScore: p.PronunciationAssessment?.AccuracyScore,
            }))
          : undefined,
      }))
      let transcript = nbest?.Display || result?.DisplayText || ''
      const overall = pa?.PronunciationScore ?? pa?.OverallScore ?? pa?.AccuracyScore
      const pronunciation = `Pronunciation ${Math.round(overall ?? 0)}/100, Accuracy ${Math.round(pa?.AccuracyScore ?? 0)}, Fluency ${Math.round(pa?.FluencyScore ?? 0)}, Completeness ${Math.round(pa?.CompletenessScore ?? 0)}${pa?.ProsodyScore ? `, Prosody ${Math.round(pa.ProsodyScore)}` : ''}`
      const prosody = pa?.ProsodyScore ? `Azure prosody score: ${Math.round(pa.ProsodyScore)}` : 'Prosody evaluated by Azure.'
      const grammar = '—'
      const suggestions: string[] = []
      if ((pa?.FluencyScore ?? 100) < 70) suggestions.push('Add short pauses at commas and slow down slightly.')
      if ((pa?.AccuracyScore ?? 100) < 70) suggestions.push('Exaggerate vowel length and stress content words.')
      if ((pa?.CompletenessScore ?? 100) < 70) suggestions.push('Complete each word fully; avoid dropping endings.')
      const demo = 'Try: Could I have a cappuccino, please?'
      // Fallback: if transcript empty or '.', try OpenAI transcription
      if ((!transcript || transcript.trim() === '.' ) && process.env.OPENAI_API_KEY) {
        try {
          const fd2 = new FormData()
          fd2.append('file', new File([audioBuf], 'speech.wav', { type: 'audio/wav' }))
          fd2.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1')
          const tr2 = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd2,
          })
          if (tr2.ok) { const dj = await tr2.json(); if (dj?.text) transcript = dj.text }
        } catch {}
      }
      return NextResponse.json({ transcript, pronunciation, prosody, grammar, suggestions, demo, timeline: { words }, azure: { raw: result } })
    }

    const apiKey = process.env.OPENAI_API_KEY
    let transcript = 'Hello, this is a mock transcript.'
    if (apiKey) {
      try {
        // Transcribe with OpenAI (gpt-4o-transcribe or whisper-1)
        const fd = new FormData()
        fd.append('file', file)
        fd.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-transcribe')
        const tr = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: fd,
        })
        if (tr.ok) {
          const data = await tr.json()
          transcript = data?.text || transcript
        }
      } catch {}
    }

    // Ask LLM for analysis (prosody, pronunciation, grammar) and a demonstration
    let analysis = {
      transcript,
      pronunciation: 'Generally clear, minor vowel reductions on stressed syllables.',
      prosody: 'Pace is slightly fast; add short pauses at commas and emphasize keywords.',
      grammar: 'One subject–verb agreement issue detected.',
      suggestions: [
        'Slow down by ~10% and pause at commas.',
        'Stress content words (nouns/verbs) more strongly.',
        'Practice the minimal pair: ship/sheep.'
      ],
      demo: 'Here is a clearer version: Could I have a cappuccino, please?'
    }
    if (apiKey) {
      try {
        const prompt = `You are Kai, a pronunciation coach. Analyze this learner transcript for pronunciation (segmental), prosody (stress, rhythm, intonation), and grammar. Then produce a short improved demonstration line in target English. Return JSON with keys: transcript, pronunciation, prosody, grammar, suggestions (array of 3-5 items), demo.`
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: `Transcript: ${transcript}` },
            ],
          }),
        })
        if (resp.ok) {
          const data = await resp.json()
          const content = data?.choices?.[0]?.message?.content || ''
          const parsed = JSON.parse(content)
          analysis = parsed
        }
      } catch {
        console.error('error analyzing speech')
      }
    }

    return NextResponse.json(analysis)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'analysis error' }, { status: 500 })
  }
}
