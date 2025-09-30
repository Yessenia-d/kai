import { NextRequest } from 'next/server';
import { buildAnswerOnlySystemPrompt, detectLanguage, type Level, type TargetLanguage } from '@kai/core';

export const runtime = 'edge';

// Streams only the final learner-facing answer tokens. Post-processing happens separately.
export async function POST(req: NextRequest) {
  const { message, targetLanguage = 'en', level = 'intermediate', hints = true, corrections = true, model } = await req.json();
  const detectedLang = detectLanguage(String(message || ''));
  const systemPrompt = buildAnswerOnlySystemPrompt({
    level: level as Level,
    targetLanguage: targetLanguage as TargetLanguage,
    detectedLang,
    enableCorrections: Boolean(corrections),
    enableHints: Boolean(hints),
  });

  // If no API key, stream a mock response
  if (!process.env.OPENAI_API_KEY) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const chunks = [
          'This is a mock streaming reply. ',
          'Add an OPENAI_API_KEY to get live responses. ',
          'Meanwhile, you can test the UI and TTS. '
        ];
        let i = 0;
        const timer = setInterval(() => {
          if (i >= chunks.length) {
            clearInterval(timer);
            controller.close();
          } else {
            controller.enqueue(encoder.encode(chunks[i++]));
          }
        }, 300);
      }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // Stream via OpenAI Chat Completions SSE
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: String(message || '').slice(0, 4000) },
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    // If quota is exceeded, fall back to a friendly mock stream so UX remains usable
    if (text.includes('insufficient_quota') || res.status === 429 || res.status === 402) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const chunks = [
            'Quota exceeded for the API key. ',
            'Switching to mock output so you can keep practicing. ',
            'Please check billing or replace the key in settings. '
          ];
          let i = 0;
          const timer = setInterval(() => {
            if (i >= chunks.length) {
              clearInterval(timer);
              controller.close();
            } else {
              controller.enqueue(encoder.encode(chunks[i++]));
            }
          }, 300);
        }
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Kai-Mock': 'quota' } });
    }
    return new Response(`Failed to connect to OpenAI: ${res.status} ${text}`, { status: 500 });
  }

  const encoder = new TextEncoder();
  const reader = res.body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      // Parse SSE chunks, extract delta content
      const text = new TextDecoder().decode(value);
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length) {
            controller.enqueue(encoder.encode(delta));
          }
        } catch {
          // ignore malformed lines
        }
      }
    }
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
