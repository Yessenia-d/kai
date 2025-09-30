type JsonInit = Omit<RequestInit, 'body' | 'method' | 'headers'> & {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  headers?: Record<string, string>
  query?: Record<string, string | number | undefined | null>
}

function buildUrl(path: string, query?: JsonInit['query']) {
  if (!query) return path
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  return qs ? `${path}?${qs}` : path
}

async function jsonFetch<T>(path: string, init?: JsonInit): Promise<T> {
  const url = buildUrl(path, init?.query)
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function blobFetch(path: string, body: any): Promise<Blob> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.blob()
}

// Messages API
export type MessageRecord = { id: string; chat_id: string; role: 'user' | 'assistant'; content: string; meta?: any; created_at: string }

export async function getMessages(chatId: string, order: 'asc' | 'desc' = 'asc') {
  return jsonFetch<{ messages: MessageRecord[] }>(`/api/messages`, { method: 'GET', query: { chat_id: chatId, order } })
}

export async function createMessage(input: { chat_id: string; role: 'user' | 'assistant'; content: string; meta?: any }) {
  return jsonFetch<{ message: MessageRecord }>(`/api/messages`, { method: 'POST', body: input })
}

// Chats API
export type ChatRecord = { id: string; title: string }

export async function listChats() {
  return jsonFetch<{ chats: ChatRecord[] }>(`/api/chats`, { method: 'GET' })
}

export async function createChat(title: string) {
  return jsonFetch<{ chat: ChatRecord }>(`/api/chats`, { method: 'POST', body: { action: 'create', title } })
}

export async function deleteChat(id: string) {
  return jsonFetch<{}>(`/api/chats`, { method: 'POST', body: { action: 'delete', id } })
}

// TTS API
export async function ttsSynthesize(body: { text: string; voice: string; speed: number; provider: 'openai' | 'elevenlabs' | 'azure' }) {
  return blobFetch('/api/tts', body)
}

// Stream Chat API
export type StreamPayload = { message: string; targetLanguage: 'en' | 'ja'; level: string; hints: boolean; corrections: boolean; model: string }
export async function streamChat(body: StreamPayload): Promise<Response> {
  return fetch('/api/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
export async function chatComplete(body: Omit<StreamPayload, 'hints' | 'corrections'> & { hints: boolean; corrections: boolean }) {
  return jsonFetch<{ answer: string; corrections?: any[]; hints?: string[]; vocab: any[] }>(`/api/chat`, { method: 'POST', body })
}

// Upload API
export async function uploadFiles(chatId: string, files: File[]) {
  const fd = new FormData()
  fd.append('chatId', chatId)
  files.forEach(f => fd.append('file', f))
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  return res.json()
}

// Speech Analyze API
export async function analyzeSpeechAudio(audio: Blob, targetLanguage: 'en' | 'ja', provider: 'azure' | 'openai') {
  const fd = new FormData()
  fd.append('audio', audio, 'speech.wav')
  fd.append('targetLanguage', targetLanguage)
  fd.append('provider', provider)
  const res = await fetch('/api/speech/analyze', { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`Analyze failed: ${res.status}`)
  return res.json()
}

// Translate
export async function translateText(text: string) {
  return jsonFetch<{ text?: string; translation?: string }>(`/api/translate`, { method: 'POST', body: { text } })
}

// Dictionary lookup
export async function lookupDict(word: string, sentence: string) {
  return jsonFetch<{ meaning?: string; partOfSpeech?: string; cefr?: string; example?: string }>(`/api/dict`, { method: 'POST', body: { word, sentence } })
}
