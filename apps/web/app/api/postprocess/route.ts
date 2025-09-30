import { NextRequest, NextResponse } from 'next/server';
import { buildPostProcessPrompt, detectLanguage, type Level } from '@kai/core';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { userText, finalAnswer, level = 'intermediate', corrections = true, hints = true } = await req.json();
    const detected = detectLanguage(String(userText || ''));
    const prompt = buildPostProcessPrompt({
      userText: String(userText || ''),
      finalAnswer: String(finalAnswer || ''),
      level: level as Level,
      detectedLang: detected,
      enableCorrections: Boolean(corrections),
      enableHints: Boolean(hints),
    });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        answer: finalAnswer,
        corrections: [],
        hints: [],
        vocab: [
          { word: 'immersion', partOfSpeech: 'noun', meaning: 'deep involvement in a language', example: 'Immersion helps you learn faster.', cefr: 'B2', why: 'core learning idea' },
        ],
      });
    }

    const api = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Return only JSON.' }
        ]
      }),
    });
    if (!api.ok) {
      const text = await api.text();
      if (text.includes('insufficient_quota') || api.status === 429 || api.status === 402) {
        // Fallback to mock JSON to keep UX usable
        return NextResponse.json({
          answer: finalAnswer,
          corrections: [],
          hints: [],
          vocab: [
            { word: 'practice', partOfSpeech: 'verb', meaning: '反复练习以提高技能', example: 'Practice a short dialogue daily.', cefr: 'A2', why: 'common learning verb' },
          ],
          mock: 'quota',
        })
      }
      return NextResponse.json({ error: text }, { status: 500 });
    }
    const data = await api.json();
    const content = data?.choices?.[0]?.message?.content || '';
    // Attempt strict JSON parse; if fails, wrap minimally
    try {
      const json = JSON.parse(content);
      return NextResponse.json(json);
    } catch {
      return NextResponse.json({ answer: finalAnswer, vocab: [], raw: content });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
