"use client";
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar } from '@/components/ui/avatar'
import { formatTime } from '@/lib/utils'
import { Copy, PauseCircle, PlayCircle, Star, StarOff, Languages, Headphones } from 'lucide-react'
import { lookupDict } from '@/lib/api'

type VocabItem = { word: string; meaning?: string; why?: string; partOfSpeech?: string; cefr?: string; example?: string }

function WordToken({ token, vocab, sentence }: { token: string; vocab: VocabItem; sentence: string }) {
  const [loading, setLoading] = useState(false)
  const [rich, setRich] = useState<VocabItem | null>(null)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="rounded bg-amber-100 px-1 text-amber-900 ring-1 ring-amber-200 hover:bg-amber-200" title={vocab.meaning || 'vocab'}>{token}</button>
      </PopoverTrigger>
      <PopoverContent onOpenAutoFocus={async () => {
        if (rich || loading) return
        try {
          setLoading(true)
          const data = await lookupDict(vocab.word, sentence)
          setRich({ word: vocab.word, meaning: data.meaning || vocab.meaning, partOfSpeech: data.partOfSpeech || vocab.partOfSpeech, cefr: data.cefr || vocab.cefr, example: data.example || vocab.example, why: vocab.why })
        } finally {
          setLoading(false)
        }
      }}>
        <div className="space-y-1">
          <div className="text-sm font-medium">{(rich?.word || vocab.word)} {(rich?.partOfSpeech || vocab.partOfSpeech) ? `· ${(rich?.partOfSpeech || vocab.partOfSpeech)}` : ''} {(rich?.cefr || vocab.cefr) ? `· ${(rich?.cefr || vocab.cefr)}` : ''}</div>
          <div className="text-sm">{(rich?.meaning || vocab.meaning) || '—'}</div>
          {(rich?.example || vocab.example) && <div className="text-xs text-gray-600">“{(rich?.example || vocab.example)}”</div>}
          {vocab.why && <div className="text-xs text-gray-500">{vocab.why}</div>}
          {loading && <div className="text-xs text-gray-400">Loading dictionary…</div>}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function MessageItem({
  role,
  text,
  vocab,
  onSpeak,
  onCopy,
  onTranslate,
  createdAt,
  attachments,
  timeline,
  audioUrl,
}: {
  role: 'user' | 'assistant'
  text: string
  vocab?: VocabItem[]
  onSpeak?: (text: string) => Promise<HTMLAudioElement | null> | void
  onCopy?: (text: string) => void
  onTranslate?: (text: string) => Promise<string>
  createdAt?: number | string
  attachments?: { name: string; url: string }[]
  timeline?: { words: { word: string; offsetMs: number; durationMs: number; accuracyScore?: number; errorType?: string; phonemes?: { phoneme: string; offsetMs: number; durationMs: number; accuracyScore?: number }[] }[] }
  audioUrl?: string
}) {
  const [marked, setMarked] = useState(false)
  const [playingAI, setPlayingAI] = useState(false)
  const [playingOriginal, setPlayingOriginal] = useState(false)
  const [translation, setTranslation] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const [origAudio, setOrigAudio] = useState<HTMLAudioElement | null>(null)
  const [wordIndex, setWordIndex] = useState(0)
  const [showPhonemesFor, setShowPhonemesFor] = useState<number | null>(null)

  function splitAndHighlight(content: string) {
    const words = vocab?.map(v => v.word.toLowerCase()) ?? []
    const tokenized = content.split(/(\b)/)
    let count = 0
    return tokenized.map((tok, i) => {
      const isWord = /[A-Za-z]/.test(tok)
      const idx = words.indexOf(tok.toLowerCase())
      const indexForTiming = isWord ? count++ : -1
      if (isWord && idx >= 0) {
        const v = vocab![idx]
        return (
          <span key={i} className={indexForTiming >= 0 && indexForTiming === wordIndex ? 'underline decoration-2' : ''}>
            <WordToken token={tok} vocab={v} sentence={content} />
          </span>
        )
      }
      return <span key={i} className={indexForTiming >= 0 && indexForTiming === wordIndex ? 'underline decoration-2' : ''}>{tok}</span>
    })
  }

  const bubbleClass = role === 'user' ? 'bubble-user' : 'bubble-assistant'
  const rowClass = role === 'user' ? 'flex-row-reverse' : 'flex-row'
  const who = role === 'user' ? 'You' : 'Kai'
  const metaColor = role === 'assistant' ? 'text-gray-200' : 'text-gray-500'
  return (
    <div className={`flex items-start gap-2 ${rowClass}`}>
      <Avatar title={who} side={role === 'user' ? 'right' : 'left'} />
      <div className={bubbleClass}>
        <div className={`mb-2 flex items-center justify-between text-xs ${metaColor}`}>
          <span>{who}</span>
          <div className="flex items-center gap-2">
            <span className={metaColor}>{formatTime(createdAt)}</span>
            <div className="flex items-center gap-1">
          <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => { onCopy?.(text) }} aria-label="Copy (⌘/Ctrl+C)"><Copy className="h-4 w-4"/></Button>
            </TooltipTrigger>
            <TooltipContent>Copy (⌘/Ctrl+C)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={async () => {
            if (translation !== null) { setTranslation(null); return }
            if (onTranslate) {
              const t = await onTranslate(text)
              setTranslation(t)
            }
          }} aria-label="Show Chinese translation"><Languages className="h-4 w-4"/></Button>
            </TooltipTrigger>
            <TooltipContent>Translation (T)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => { setMarked(v => !v) }} aria-label="Mark/Unmark">
              {marked ? <Star className="h-4 w-4"/> : <StarOff className="h-4 w-4"/>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mark</TooltipContent>
        </Tooltip>
        {/* Original recording playback (if available) */}
        {audioUrl ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={async () => {
                if (!playingOriginal) {
                  const el = new Audio(audioUrl)
                  setOrigAudio(el)
                  await el.play().catch(() => {})
                  el.addEventListener('ended', () => setPlayingOriginal(false))
                  setPlayingOriginal(true)
                } else {
                  try { origAudio?.pause() } catch {}
                  setPlayingOriginal(false)
                }
              }} aria-label="Play original">
                {playingOriginal ? <PauseCircle className="h-5 w-5"/> : <Headphones className="h-5 w-5"/>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Play your recording</TooltipContent>
          </Tooltip>
        ) : null}
        {/* AI TTS playback */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={async () => {
              if (!playingAI) {
                const el = (await onSpeak?.(text)) as HTMLAudioElement | undefined
                if (el && el instanceof HTMLAudioElement) {
                  setAudio(el)
                  const words = text.split(/\b/).filter(w => /[A-Za-z]/.test(w))
                  const handler = () => {
                    if (!el.duration || !isFinite(el.duration)) return
                    const ratio = Math.min(1, Math.max(0, el.currentTime / el.duration))
                    const idx = Math.floor(ratio * words.length)
                    setWordIndex(idx)
                  }
                  el.addEventListener('timeupdate', handler)
                  el.addEventListener('ended', () => { setPlayingAI(false); setWordIndex(0) })
                }
                setPlayingAI(true)
              } else {
                if (audio) { try { audio.pause() } catch {} }
                setPlayingAI(false)
              }
            }} aria-label="Play AI voice">
              {playingAI ? <PauseCircle className="h-5 w-5"/> : <PlayCircle className="h-5 w-5"/>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Play AI voice</TooltipContent>
        </Tooltip>
        </TooltipProvider>
      </div>
          </div>
        </div>
        <div className="leading-relaxed">{role === 'assistant' ? splitAndHighlight(text) : text}</div>
        {translation && (
          <div className="mt-2 rounded bg-gray-50 p-2 text-sm text-gray-800">{translation}</div>
        )}
        {attachments?.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noreferrer" className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50">
                📎 {a.name}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      {/* Azure timeline rendering */}
      {role === 'assistant' && timeline?.words?.length && audioUrl ? (
        <div className="mt-3 space-y-2">
          <div className="text-xs text-gray-500">Pronunciation timeline</div>
          <AzureTimeline timeline={timeline} audioUrl={audioUrl} />
        </div>
      ) : null}
    </div>
  )
}

function scoreColor(s?: number) {
  if (s === undefined || s === null) return 'bg-gray-200 text-gray-800'
  if (s >= 85) return 'bg-green-100 text-green-900'
  if (s >= 70) return 'bg-yellow-100 text-yellow-900'
  return 'bg-red-100 text-red-900'
}

function AzureTimeline({ timeline, audioUrl }: { timeline: Required<NonNullable<Parameters<typeof MessageItem>[0]['timeline']>>; audioUrl: string }) {
  const [active, setActive] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    const a = new Audio(audioUrl)
    audioRef.current = a
    const onTime = () => {
      if (!timeline?.words) return
      const t = a.currentTime * 1000
      const idx = timeline.words.findIndex(w => t >= w.offsetMs && t < w.offsetMs + w.durationMs)
      if (idx >= 0) setActive(idx)
    }
    a.addEventListener('timeupdate', onTime)
    return () => { a.pause(); a.removeEventListener('timeupdate', onTime) }
  }, [audioUrl])

  async function playRange(offsetMs: number, durationMs: number) {
    const a = audioRef.current
    if (!a) return
    a.currentTime = offsetMs / 1000
    await a.play()
    const end = (offsetMs + durationMs) / 1000
    const iv = setInterval(() => {
      if (a.currentTime >= end) { a.pause(); clearInterval(iv) }
    }, 20)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {timeline.words.map((w, i) => (
          <button key={i} className={`rounded px-2 py-1 text-xs ${scoreColor(w.accuracyScore)} ${active===i?'ring-2 ring-black':''}`} onClick={() => playRange(w.offsetMs, w.durationMs)} title={`${w.word} · ${w.accuracyScore ?? '-'}%`}>
            {w.word}
          </button>
        ))}
      </div>
      {active !== null && timeline.words[active]?.phonemes?.length ? (
        <div className="rounded-md border p-2">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
            <div>Phonemes for “{timeline.words[active].word}”</div>
          </div>
          <div className="flex flex-wrap gap-1">
            {timeline.words[active].phonemes!.map((p, idx) => (
              <span key={idx} className={`rounded px-2 py-0.5 text-xs ${scoreColor(p.accuracyScore)}`}>{p.phoneme}</span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
