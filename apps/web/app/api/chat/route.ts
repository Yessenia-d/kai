import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt, buildUserPrompt, planPipeline, type Level, type TargetLanguage, safeParseKaiResponse } from '@kai/core';
import { MockClient, OpenAIClient } from '@kai/llm';

export const runtime = 'edge'; // fast, serverless-friendly

// Minimal, commented BFF endpoint: accepts a single-turn message and returns structured reply.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userText = String(body.message || '').slice(0, 4000);
    const targetLanguage = (body.targetLanguage || process.env.KAI_DEFAULT_TARGET_LANG || 'en') as TargetLanguage;
    const level = (body.level || process.env.KAI_DEFAULT_LEVEL || 'intermediate') as Level;
    const enableCorrections = Boolean(body.corrections ?? true);
    const enableHints = Boolean(body.hints ?? true);

    const plan = planPipeline({ userText, targetLanguage, level, enableCorrections, enableHints });
    const systemPrompt = buildSystemPrompt({
      level,
      targetLanguage,
      detectedLang: plan.detectedLang,
      enableCorrections,
      enableHints,
    });
    const userPrompt = buildUserPrompt(userText);

    // Choose real OpenAI client if key exists; otherwise fallback to mock
    const client = process.env.OPENAI_API_KEY ? new OpenAIClient() : new MockClient();
    const raw = await client.chat({ systemPrompt, userPrompt, model: (body?.model as string | undefined) });
    const parsed = safeParseKaiResponse(raw);
    if (!parsed) {
      return NextResponse.json({ answer: raw, vocab: [] }, { status: 200 });
    }
    return NextResponse.json(parsed, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
