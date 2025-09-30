// Shared constants and keys
export const STORAGE_KEYS = {
  chats: 'kai_chats',
} as const

// Enums for Select options
export enum Model {
  GPT_4O_MINI = 'gpt-4o-mini',
  GPT_41_MINI = 'gpt-4.1-mini',
}

export enum AnalysisProvider {
  AZURE = 'azure',
  OPENAI = 'openai',
}

export enum TtsVoice {
  ALLOY = 'alloy',
  VERSE = 'verse',
}

export enum TtsProvider {
  OPENAI = 'openai',
  ELEVENLABS = 'elevenlabs',
  AZURE = 'azure',
}

export enum Accent {
  US = 'us',
  UK = 'uk',
}

export enum PlaybackRate {
  HALF = '0.5',
  THREE_QUARTERS = '0.75',
  NORMAL = '1',
  ONE_QUARTER = '1.25',
  ONE_HALF = '1.5',
}

export const DEFAULTS = {
  model: Model.GPT_4O_MINI,
  ttsVoice: TtsVoice.ALLOY,
  ttsRate: 1.0,
  analysisProvider: AnalysisProvider.AZURE,
  ttsProvider: TtsProvider.OPENAI,
  accent: Accent.US,
  targetLanguage: 'en' as const,
}

export const ORDER = {
  asc: 'asc',
  desc: 'desc',
} as const

export type Order = keyof typeof ORDER

export const MODEL_MAP = {
  [Model.GPT_4O_MINI]: 'gpt-4o-mini',
  [Model.GPT_41_MINI]: 'gpt-4.1-mini',
}

export const ANALYSIS_PROVIDER_MAP = {
  [AnalysisProvider.AZURE]: 'Azure',
  [AnalysisProvider.OPENAI]: 'OpenAI',
}

export const TTS_VOICE_MAP = {
  [TtsVoice.ALLOY]: 'alloy',
  [TtsVoice.VERSE]: 'verse',
}

export const TTS_PROVIDER_MAP = {
  [TtsProvider.OPENAI]: 'OpenAI',
  [TtsProvider.ELEVENLABS]: 'ElevenLabs',
  [TtsProvider.AZURE]: 'Azure',
}

export const ACCENT_MAP = {
  [Accent.US]: 'US',
  [Accent.UK]: 'UK',
}

export const PLAYBACK_RATE_MAP = {
  [PlaybackRate.HALF]: '0.5',
  [PlaybackRate.THREE_QUARTERS]: '0.75',
  [PlaybackRate.NORMAL]: '1',
  [PlaybackRate.ONE_QUARTER]: '1.25',
  [PlaybackRate.ONE_HALF]: '1.5',
}

// Select options configurations
export const SELECT_OPTIONS = {
  models: Object.entries(MODEL_MAP).map(([value, label]) => ({ value, label })),
  analysisProviders: Object.entries(ANALYSIS_PROVIDER_MAP).map(([value, label]) => ({ value, label })),
  ttsVoices: Object.entries(TTS_VOICE_MAP).map(([value, label]) => ({ value, label })),
  ttsProviders: Object.entries(TTS_PROVIDER_MAP).map(([value, label]) => ({ value, label })),
  accents: Object.entries(ACCENT_MAP).map(([value, label]) => ({ value, label })),
  playbackRates: Object.entries(PLAYBACK_RATE_MAP).map(([value, label]) => ({ value, label })),
}

