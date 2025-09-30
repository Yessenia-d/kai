"use client";
import { useEffect, useRef, useState } from 'react'

export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  const [elapsed, setElapsed] = useState(0)
  const chunksRef = useRef<Blob[]>([])
  const recRef = useRef<MediaRecorder | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.permissions?.query({ name: 'microphone' as any }).then((p) => setPermission(p.state as any)).catch(() => {})
    }
  }, [])

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const preferred = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm']
    let mime = ''
    for (const m of preferred) { if ((window as any).MediaRecorder?.isTypeSupported?.(m)) { mime = m; break } }
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    chunksRef.current = []
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = () => { stream.getTracks().forEach(t => t.stop()) }
    recRef.current = rec
    setRecording(true)
    setElapsed(0)
    rec.start()
    timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000)
  }

  async function stop(): Promise<Blob | null> {
    const rec = recRef.current
    if (!rec) return null
    return new Promise((resolve) => {
      rec.onstop = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        setRecording(false)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        resolve(blob)
      }
      rec.stop()
    })
  }

  return { recording, permission, elapsed, start, stop }
}
