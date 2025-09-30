import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { word, sentence } = await req.json();
    if (!word || typeof word !== 'string') return NextResponse.json({ error: 'word required' }, { status: 400 });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        word,
        meaning: `【Mock】Meaning of "${word}" varies by context.`,
        example: sentence || '',
        cefr: 'B1',
      });
    }

    const prompt = `Provide a concise, learner-friendly definition of the target word within the given sentence context. Return JSON with keys: meaning (Chinese), partOfSpeech, cefr (A2/B1/B2/C1), example (short), and note (optional).\nTarget word: ${word}\nSentence: ${sentence || ''}\nReturn ONLY JSON.`
    const api = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [ { role: 'user', content: prompt } ]
      }),
    });
    if (!api.ok) {
      const text = await api.text();
      if (text.includes('insufficient_quota') || api.status === 429 || api.status === 402) {
        return NextResponse.json({ word, meaning: `【额度不足】${word}（上下文义）`, cefr: 'B1', example: sentence || '' });
      }
      return NextResponse.json({ error: text }, { status: 500 });
    }
    const data = await api.json();
    const content = data?.choices?.[0]?.message?.content || '{}';
    try {
      const json = JSON.parse(content);
      return NextResponse.json({ word, ...json });
    } catch {
      return NextResponse.json({ word, meaning: content });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
