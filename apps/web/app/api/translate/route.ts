import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string') return NextResponse.json({ error: 'text required' }, { status: 400 });

    if (!process.env.OPENAI_API_KEY) {
      // Mock translation for local testing
      return NextResponse.json({ translation: '【Mock】' + text });
    }

    const prompt = `Translate the following English into concise, learner-friendly Simplified Chinese. Return only the translation.\n---\n${text}`;
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
        return NextResponse.json({ translation: '【额度不足：请检查 API 计费】' });
      }
      return NextResponse.json({ error: text }, { status: 500 });
    }
    const data = await api.json();
    const content = data?.choices?.[0]?.message?.content || '';
    return NextResponse.json({ translation: content });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
