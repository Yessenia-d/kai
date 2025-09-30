// Core domain primitives and pipeline
// Goal: keep pure, framework-agnostic logic for reuse across platforms.

export type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: Role;
  content: string;
}

export type TargetLanguage = 'en' | 'ja';
export type Level = 'beginner' | 'elementary' | 'intermediate' | 'upper-intermediate' | 'advanced';

export interface PipelineInput {
  userText: string;
  targetLanguage: TargetLanguage;
  level: Level;
  enableCorrections: boolean;
  enableHints: boolean; // hints for L1 -> L2 natural expressions
}

export interface PipelinePlan {
  detectedLang: 'zh' | 'en' | 'ja' | 'other';
  tasks: Array<'hint' | 'correct' | 'answer' | 'vocab'>;
}

// Very lightweight language detection for MVP (heuristic)
export function detectLanguage(text: string): PipelinePlan['detectedLang'] {
  if (/\p{Script=Han}/u.test(text)) return 'zh';
  if (/[ぁ-ゟ゠-ヿ一-龯]/.test(text)) return 'ja';
  if (/[a-zA-Z]/.test(text)) return 'en';
  return 'other';
}

export function planPipeline(input: PipelineInput): PipelinePlan {
  const detected = detectLanguage(input.userText);
  const tasks: PipelinePlan['tasks'] = [];
  if (detected !== 'en') {
    if (input.enableHints) tasks.push('hint');
  } else {
    if (input.enableCorrections) tasks.push('correct');
  }
  tasks.push('answer', 'vocab');
  return { detectedLang: detected, tasks };
}

export function levelDescriptor(level: Level): string {
  switch (level) {
    case 'beginner':
      return 'Use CEFR A2 level English with short sentences and common words.';
    case 'elementary':
      return 'Use CEFR B1- with simple structures and high-frequency vocabulary.';
    case 'intermediate':
      return 'Use CEFR B1-B2 level English. Keep it clear and mostly common words.';
    case 'upper-intermediate':
      return 'Use CEFR B2 level English. Slightly challenging, but still clear.';
    case 'advanced':
      return 'Use CEFR C1 level English. Precise and natural, but avoid rare words unless needed.';
  }
}

export interface PromptContext {
  level: Level;
  targetLanguage: TargetLanguage;
  detectedLang: PipelinePlan['detectedLang'];
  enableCorrections: boolean;
  enableHints: boolean;
}

// Build a single JSON-oriented instruction to get: answer + optional corrections + vocab
export function buildSystemPrompt(ctx: PromptContext): string {
  const base = `You are Kai, a friendly language coach. ${levelDescriptor(ctx.level)} Always encourage the learner.`;
  const goals = [
    'Reply in English unless explicitly asked otherwise.',
    'Keep responses concise and easy to understand.',
  ];
  if (ctx.detectedLang !== 'en' && ctx.enableHints) {
    goals.push('If the user used their L1 (e.g., Chinese), provide a natural English phrasing for their intent.');
  }
  if (ctx.detectedLang === 'en' && ctx.enableCorrections) {
    goals.push('If the user writes English, provide gentle grammar corrections and a better phrasing.');
  }
  goals.push('Extract 3-5 useful vocabulary items from your reply and explain their meaning in this context briefly.');
  return [base, 'Goals:', ...goals.map((g) => `- ${g}`)].join('\n');
}

export function buildUserPrompt(userText: string): string {
  // Ask the model to return JSON we can parse deterministically
  return `User message:\n${userText}\n\nRespond in JSON with keys: 
  answer: string (the final answer you would say to the learner),
  corrections?: { original: string, corrected: string, explanation: string }[] (if any),
  hints?: string[] (natural English expressions for the user's intent, if L1 was used),
  vocab: { word: string, meaning: string, why: string }[] (brief, in-context).
Return ONLY JSON, no code fences.`;
}

export interface KaiResponse {
  answer: string;
  corrections?: { original: string; corrected: string; explanation: string }[];
  hints?: string[];
  vocab: { word: string; meaning: string; why: string }[];
}

// Streaming-first: Generate only the learner-facing answer (best for token streaming)
export function buildAnswerOnlySystemPrompt(ctx: PromptContext): string {
  const base = `You are Kai, a friendly language coach. ${levelDescriptor(ctx.level)} Reply only with what you would say to the learner.`;
  const goals = [
    'Reply in English unless explicitly asked otherwise.',
    'Keep responses concise and easy to understand.',
  ];
  if (ctx.detectedLang !== 'en' && ctx.enableHints) {
    goals.push('The user may have used L1; infer their intent and reply naturally in English.');
  }
  return [base, 'Guidelines:', ...goals.map((g) => `- ${g}`)].join('\n');
}

// Post-process prompt: derive corrections, hints, and higher-quality vocabulary from the final answer
export function buildPostProcessPrompt(params: {
  userText: string;
  finalAnswer: string;
  level: Level;
  detectedLang: PipelinePlan['detectedLang'];
  enableCorrections: boolean;
  enableHints: boolean;
}): string {
  const { userText, finalAnswer, level, detectedLang, enableCorrections, enableHints } = params;
  const parts: string[] = [];
  parts.push('You are Kai, a precise post-processor for language coaching outputs.');
  parts.push(levelDescriptor(level));
  parts.push('Using the user input and the assistant final answer, extract helpful learning signals.');
  const want: string[] = [];
  if (detectedLang === 'en' && enableCorrections) want.push('corrections');
  if (detectedLang !== 'en' && enableHints) want.push('hints');
  want.push('vocab');
  parts.push(`Return ONLY JSON with keys: answer, ${want.join(', ')}.`);
  parts.push(`Rules for vocab: return 4-8 items most useful for the learner at this level; each item must include: word, partOfSpeech, meaning (in this context), example (short snippet from the final answer or a closely matching sentence), cefr (A2/B1/B2/C1 approx), and why (1 short reason).`);
  parts.push('Keep explanations short. JSON only, no code fences.');
  parts.push('---');
  parts.push('User input:');
  parts.push(userText);
  parts.push('---');
  parts.push('Assistant final answer:');
  parts.push(finalAnswer);
  parts.push('---');
  parts.push('JSON shape example (illustrative, adapt fields if missing):');
  parts.push('{"answer":"<finalAnswer>","corrections":[{"original":"","corrected":"","explanation":""}],"hints":["..."],"vocab":[{"word":"","partOfSpeech":"","meaning":"","example":"","cefr":"B1","why":""}]}');
  return parts.join('\n');
}

export function safeParseKaiResponse(text: string): KaiResponse | null {
  try {
    const obj = JSON.parse(text);
    if (typeof obj.answer !== 'string' || !Array.isArray(obj.vocab)) return null;
    return obj as KaiResponse;
  } catch {
    return null;
  }
}
