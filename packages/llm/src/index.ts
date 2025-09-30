import type { KaiResponse } from '@kai/core';

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  apiKey?: string;
}

export interface LLMClient {
  chat(req: LLMRequest): Promise<string>; // returns raw text (expected JSON)
}

// OpenAI Chat Completions via fetch (simple, no streaming for MVP)
export class OpenAIClient implements LLMClient {
  endpoint = 'https://api.openai.com/v1/chat/completions';
  async chat(req: LLMRequest): Promise<string> {
    const apiKey = req.apiKey || process.env.OPENAI_API_KEY;
    const model = req.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: req.userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${text}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : JSON.stringify({
      answer: 'Sorry, I could not generate a response.',
      vocab: [] as KaiResponse['vocab'],
    });
  }
}

// Fallback mock client for local development without API key
export class MockClient implements LLMClient {
  async chat(req: LLMRequest): Promise<string> {
    return JSON.stringify({
      answer: 'This is a mock reply. Replace OPENAI_API_KEY to get real answers.',
      corrections: [],
      hints: [],
      vocab: [
        { word: 'immersion', meaning: 'deep involvement', why: 'core learning strategy here' },
      ],
    });
  }
}
