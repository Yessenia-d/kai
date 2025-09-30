"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { ChatSidebar, type ChatItem } from '@/components/chat/sidebar';
import { MessageItem } from '@/components/chat/message-item';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectValue, SelectItem, SelectContent, SelectTrigger } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Paperclip, Send, Mic, Square } from 'lucide-react';
import { useRecorder } from '@/lib/useRecorder';
import { analyzeAudio } from '@/lib/analyzeAudio';
import { STORAGE_KEYS, DEFAULTS, SELECT_OPTIONS, Model, AnalysisProvider, TtsVoice, TtsProvider, Accent, PlaybackRate } from '@/lib/constants';
import { createMessage, getMessages, createChat as apiCreateChat, listChats, ttsSynthesize, uploadFiles as apiUploadFiles, streamChat, chatComplete, analyzeSpeechAudio, translateText } from '@/lib/api';
import { blobToWav16kMono } from '@/lib/audioToWav';

const RequestSchema = z.object({
  message: z.string().min(1),
  targetLanguage: z.enum(['en', 'ja']).default('en'),
  level: z.enum(['beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced']).default('intermediate'),
  corrections: z.boolean().default(true),
  hints: z.boolean().default(true),
  tts: z.boolean().default(true),
  rate: z.number().min(0.5).max(1.5).default(0.9),
});

type ResponseData = {
  answer: string;
  corrections?: { original: string; corrected: string; explanation: string }[];
  hints?: string[];
  vocab: { word: string; meaning: string; why: string }[];
  error?: string;
};

type Message = { role: 'user' | 'assistant'; content: string; meta?: any; createdAt?: number };

type BizSelectProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  placeholder: string;
}
const BizSelect = <T extends string>(props: BizSelectProps<T>) => {
  const { value, onChange, options, placeholder } = props;
  return <Select onValueChange={onChange} value={value}>
    <SelectTrigger className="w-auto">
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      {options.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
}

export default function Page() {
  const [history, setHistory] = useState<Message[]>([]);
  const [message, setMessage] = useState('Hi Kai! I want to practice ordering food at a cafe.');
  const [targetLanguage, setTargetLanguage] = useState<'en' | 'ja'>(DEFAULTS.targetLanguage);
  const [level, setLevel] = useState<'beginner' | 'elementary' | 'intermediate' | 'upper-intermediate' | 'advanced'>('intermediate');
  const [corrections, setCorrections] = useState(true);
  const [hints, setHints] = useState(true);
  const [rate, setRate] = useState(1.0);
  const [tts, setTts] = useState(true);
  const [naturalTts, setNaturalTts] = useState(true);
  const [ttsVoice, setTtsVoice] = useState<TtsVoice>(DEFAULTS.ttsVoice);
  const [accent, setAccent] = useState<Accent>(DEFAULTS.accent);
  const [model, setModel] = useState<Model>(DEFAULTS.model);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>(DEFAULTS.ttsProvider)
  const [analysisProvider, setAnalysisProvider] = useState<AnalysisProvider>(DEFAULTS.analysisProvider)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const { recording, elapsed, start: startRec, stop: stopRec } = useRecorder();
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChat, setActiveChat] = useState<string | undefined>(undefined);
  const [histories, setHistories] = useState<Record<string, Message[]>>({});
  const [remote, setRemote] = useState(false);
  const synth = useMemo(() => (typeof window !== 'undefined' ? window.speechSynthesis : null), []);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = async (text: string): Promise<HTMLAudioElement | null> => {
    if (!tts) return null;
    // Try natural TTS via API first
    if (naturalTts) {
      try {
        const blob = await ttsSynthesize({ text, voice: ttsVoice, speed: rate, provider: ttsProvider })
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.play()
        return audio
      } catch { }
    }
    // Fallback: Web Speech synthesis
    if (!synth) return null;
    try {
      if (utterRef.current) synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate; // slow down for learners
      utterRef.current = u;
      synth.speak(u);
      return null;
    } catch { return null }
  };

  // Keyboard shortcuts: Cmd/Ctrl+Enter to send; Shift+Enter for newline; Esc to stop TTS
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const form = document.querySelector('form');
        if (form) (form as HTMLFormElement).dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
      if (e.key === 'Escape') {
        try { synth?.cancel() } catch { }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [synth])

  // Load chats: try server first (Supabase), else localStorage
  useEffect(() => {
    (async () => {
      try {
        const data = await listChats()
        setRemote(true)
        if (Array.isArray(data?.chats)) {
          const list: ChatItem[] = data.chats.map((c: any) => ({ id: String(c.id), title: String(c.title || 'Untitled') }))
          setChats(list)
          if (!activeChat && list.length) selectChat(list[0].id)
          return
        }
      } catch { }
      // Fallback to localStorage
      const saved = localStorage.getItem(STORAGE_KEYS.chats);
      if (saved) {
        const parsed = JSON.parse(saved) as { chats: ChatItem[]; activeId?: string; histories: Record<string, Message[]> };
        setChats(parsed.chats || []);
        setActiveChat(parsed.activeId);
        setHistories(parsed.histories || {});
        if (parsed.activeId && parsed.histories?.[parsed.activeId]) {
          setHistory(parsed.histories[parsed.activeId]);
        } else if (parsed.chats?.length) {
          selectChat(parsed.chats[0].id)
        }
      }
    })()
  }, []);
  useEffect(() => {
    const current = { ...histories };
    if (activeChat) current[activeChat] = history;
    localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify({ chats, activeId: activeChat, histories: current }));
  }, [chats, activeChat, history, histories]);

  async function getOrCreateChatId(): Promise<string> {
    if (activeChat) return activeChat
    const title = (message || 'New Chat').slice(0, 32) || 'New Chat'
    if (remote) {
      const data = await apiCreateChat(title)
      const id = data?.chat?.id as string
      if (id) {
        setChats((c) => [{ id, title: data.chat.title || title }, ...c])
        setActiveChat(id)
        setHistories((h) => ({ ...h, [id]: [] }))
        return id
      }
      // fallback local
    }
    const id = String(Date.now())
    setChats((c) => [{ id, title }, ...c])
    setActiveChat(id)
    setHistories((h) => ({ ...h, [id]: [] }))
    return id
  }

  function newChat() {
    setHistory([]);
    setActiveChat(undefined);
  }

  function selectChat(id: string) {
    setActiveChat(id);
    if (remote) {
      getMessages(id).then(data => {
        const msgs = (data?.messages || []).map((m: any) => ({ role: m.role, content: m.content, meta: m.meta, createdAt: new Date(m.created_at).getTime() }))
        setHistory(msgs)
      }).catch(() => setHistory([]))
    } else {
      setHistory(histories[id] || []);
    }
  }

  function deleteChat(id: string) {
    setChats((c) => c.filter((x) => x.id !== id));
    if (activeChat === id) {
      setActiveChat(undefined);
      setHistory([]);
    }
    setHistories((h) => { const cp = { ...h }; delete cp[id]; return cp; });
    if (remote) {
      import('@/lib/api').then(({ deleteChat }) => deleteChat(id).catch(() => { }))
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = RequestSchema.parse({ message, targetLanguage, level, corrections, hints, tts, rate });
    const chatId = await getOrCreateChatId();
    const now = Date.now();
    setHistory((h) => [...h, { role: 'user', content: parsed.message, createdAt: now }, { role: 'assistant', content: '', createdAt: Date.now() }]);
    setLoading(true);
    try {
      // 0) Upload files if present (Supabase Storage)
      let attachments: { name: string; url: string; size: number; type: string }[] = []
      if (files.length) {
        try { const payload = await apiUploadFiles(chatId, files); if (payload?.files) attachments = payload.files } catch { }
      }

      // 1) Persist user message (optional remote)
      if (remote && chatId) { createMessage({ chat_id: chatId, role: 'user', content: parsed.message, meta: { attachments } }).catch(() => { }) }

      // 2) Stream the answer text
      let res = await streamChat({ message: parsed.message, targetLanguage, level, hints, corrections, model });
      if (!res.ok || !res.body) {
        // Fallback to non-stream API
        const data: ResponseData = await chatComplete({ message: parsed.message, targetLanguage, level, corrections, hints, model });
        setHistory((h) => {
          const copy = [...h];
          copy[copy.length - 1] = { role: 'assistant', content: data.answer, meta: { corrections: data.corrections, hints: data.hints, vocab: data.vocab }, createdAt: copy[copy.length - 1]?.createdAt || Date.now() };
          return copy;
        });
        speak(data.answer);
        setMessage('');
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = '';
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          full += chunk;
          setHistory((h) => {
            const copy = [...h];
            copy[copy.length - 1] = { ...copy[copy.length - 1], content: full };
            return copy;
          });
          // Auto-scroll on new chunks
          const el = document.getElementById('kai-end');
          if (el) el.scrollIntoView({ block: 'end' });
        }
      }

      // TTS after streaming ends
      speak(full);

      // 3) Post-process for corrections/hints/vocab
      const post = await fetch('/api/postprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userText: parsed.message, finalAnswer: full, level, corrections, hints }),
      });
      const meta: ResponseData = await post.json();
      setHistory((h) => {
        const copy = [...h];
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = { ...last, meta: { corrections: meta.corrections, hints: meta.hints, vocab: meta.vocab } };
        return copy;
      });

      // 4) Persist assistant message (optional remote)
      if (remote && chatId) { createMessage({ chat_id: chatId, role: 'assistant', content: full, meta: { corrections: meta.corrections, hints: meta.hints, vocab: meta.vocab } }).catch(() => { }) }
      setMessage('');
      setFiles([]);
    } catch (err: any) {
      setHistory((h) => [...h, { role: 'assistant', content: 'Error: ' + (err?.message || 'unknown'), createdAt: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid grid-cols-[18rem_1fr] gap-4">
      <ChatSidebar chats={chats} activeId={activeChat} onNew={newChat} onSelect={selectChat} onDelete={deleteChat} />
      <section className="grid grid-rows-[1fr_auto] gap-3">
        <div className="flex min-h-0 flex-col gap-3 overflow-auto pb-24">
          {history.map((m, i) => (
            <MessageItem key={i} role={m.role} text={m.content} vocab={m.meta?.vocab} createdAt={m.createdAt} attachments={m.meta?.attachments} timeline={m.meta?.timeline} audioUrl={m.meta?.audioUrl}
              onSpeak={(t) => speak(t)}
              onCopy={(t) => navigator.clipboard?.writeText(t)}
              onTranslate={async (t) => {
                const data = await translateText(t)
                return data.translation || data.text || '—'
              }}
            />
          ))}
          <div id="kai-end" />
        </div>
        <div className="sticky bottom-2 rounded-xl border bg-white p-2 shadow-sm">
          <form onSubmit={onSubmit} className="grid gap-2">
            <div className="flex flex-wrap items-center gap-3 px-1 pt-1 text-sm text-gray-600">
              <BizSelect<Model> value={model} onChange={setModel} options={SELECT_OPTIONS.models} placeholder="Model" />
              <BizSelect<AnalysisProvider> value={analysisProvider} onChange={setAnalysisProvider} options={SELECT_OPTIONS.analysisProviders} placeholder="Analysis" />
              <BizSelect<TtsVoice> value={ttsVoice} onChange={setTtsVoice} options={SELECT_OPTIONS.ttsVoices} placeholder="Voice" />
              <BizSelect<TtsProvider> value={ttsProvider} onChange={setTtsProvider} options={SELECT_OPTIONS.ttsProviders} placeholder="TTS" />
              <BizSelect<Accent> value={accent} onChange={setAccent} options={SELECT_OPTIONS.accents} placeholder="Accent" />
              <BizSelect<PlaybackRate> value={rate.toString() as PlaybackRate} onChange={(value) => setRate(parseFloat(value))} options={SELECT_OPTIONS.playbackRates} placeholder="Speed" />

              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="tts">TTS</Label>
                  <Switch id="tts" checked={tts} onCheckedChange={setTts} />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="natural">Natural</Label>
                  <Switch id="natural" checked={naturalTts} onCheckedChange={setNaturalTts} />
                </div>
              </div>
            </div>
            <div className="relative">
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message Kai…" className="pr-24 min-h-[56px]" />
              <div className="pointer-events-none absolute bottom-2 left-3 text-xs text-gray-400">
                {recording ? `Recording… ${elapsed}s` : files.length ? `${files.length} file(s)` : ''}
              </div>
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                <Button type="button" variant={recording ? 'secondary' : 'secondary'} size="icon" aria-label="Record"
                  onClick={async () => {
                    if (!recording) {
                      try { await startRec() } catch { }
                    } else {
                      const rawBlob = await stopRec()
                      if (rawBlob && rawBlob.size > 0) {
                        // Client-side audio feature analysis (prosody approximation)
                        let features: any = null
                        try { features = await analyzeAudio(rawBlob) } catch { }
                        // Convert to 16k WAV for Azure reliability
                        const wav = await blobToWav16kMono(rawBlob)
                        const data = await analyzeSpeechAudio(wav, targetLanguage, analysisProvider)
                        // Merge server analysis + client features for richer feedback
                        const duration = features?.durationSec || 0
                        const nonzero = (features?.pitchHz || []).filter((x: number) => x > 20)
                        const pitchMin = nonzero.length ? Math.round(Math.min(...nonzero)) : 0
                        const pitchMax = nonzero.length ? Math.round(Math.max(...nonzero)) : 0
                        const words = (data?.transcript || '').trim().split(/\s+/).filter(Boolean).length
                        const wpm = duration > 0 ? Math.round((words / duration) * 60) : undefined

                        const audioUrl = URL.createObjectURL(rawBlob)
                        setHistory((h) => [...h, { role: 'user', content: data.transcript || '[voice message]', createdAt: Date.now(), meta: { audioUrl } }])
                        const chatId2 = await getOrCreateChatId()
                        if (remote && chatId2) { createMessage({ chat_id: chatId2, role: 'user', content: data.transcript || '[voice message]', meta: { audioUrl } }).catch(() => { }) }
                        const feedback = `Pronunciation: ${data.pronunciation}\nProsody: ${data.prosody}\nGrammar: ${data.grammar}\n\nMeasured (approx):${wpm ? `\n- Speaking rate: ${wpm} WPM` : ''}\n- Pauses: ${features?.pauses?.count || 0} (avg ${features?.pauses?.avgMs || 0} ms)\n- Pitch range: ${pitchMin ? `${pitchMin}-${pitchMax} Hz` : '—'}\n\nSuggestions:\n- ${(data.suggestions || []).join('\n- ')}\n\nDemo: ${data.demo}`
                        setHistory((h) => [...h, { role: 'assistant', content: feedback, createdAt: Date.now(), meta: { vocab: [], timeline: data.timeline, azure: data.azure, audioUrl } }])
                        if (remote && chatId2) { createMessage({ chat_id: chatId2, role: 'assistant', content: feedback, meta: { timeline: data.timeline, azure: data.azure, audioUrl } }).catch(() => { }) }
                      }
                    }
                  }}>
                  {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button type="button" variant="secondary" size="icon" onClick={() => fileInputRef.current?.click()} aria-label="Attach">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button type="submit" size="icon" disabled={loading} aria-label="Send">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
