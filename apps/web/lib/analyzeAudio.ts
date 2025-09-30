"use client";
export type AudioFeatures = {
  durationSec: number
  sampleRate: number
  rms: number[]
  pitchHz: number[]
  pauses: { count: number; avgMs: number }
}

function rms(frame: Float32Array) {
  let s = 0
  for (let i = 0; i < frame.length; i++) { const v = frame[i]; s += v * v }
  return Math.sqrt(s / frame.length)
}

// Very simple autocorrelation-based pitch estimator (mono)
function estimatePitch(frame: Float32Array, sampleRate: number) {
  // limit search to 80–300 Hz
  const minLag = Math.floor(sampleRate / 300)
  const maxLag = Math.floor(sampleRate / 80)
  let bestLag = -1
  let best = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i < frame.length - lag; i++) sum += frame[i] * frame[i + lag]
    if (sum > best) { best = sum; bestLag = lag }
  }
  if (bestLag > 0) return sampleRate / bestLag
  return 0
}

export async function analyzeAudio(blob: Blob): Promise<AudioFeatures> {
  const arrayBuf = await blob.arrayBuffer()
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const audio = await ctx.decodeAudioData(arrayBuf.slice(0))
  const chan = audio.getChannelData(0)
  const sr = audio.sampleRate
  const frameSize = Math.floor(sr * 0.03) // 30ms frames
  const hop = Math.floor(frameSize / 2) // 50% overlap
  const rmsArr: number[] = []
  const pitchArr: number[] = []
  for (let i = 0; i + frameSize <= chan.length; i += hop) {
    const sub = chan.subarray(i, i + frameSize)
    const e = rms(sub)
    rmsArr.push(e)
    // Only estimate pitch on voiced frames (energy threshold)
    if (e > 0.02) {
      const hz = estimatePitch(sub, sr)
      pitchArr.push(hz)
    } else {
      pitchArr.push(0)
    }
  }
  // Pause detection: contiguous low-energy frames > 200ms
  const thresh = 0.02
  let count = 0, durations: number[] = [], cur = 0
  for (let i = 0; i < rmsArr.length; i++) {
    if (rmsArr[i] < thresh) cur += hop / sr
    else if (cur > 0) { if (cur >= 0.2) { count++; durations.push(cur) } cur = 0 }
  }
  if (cur >= 0.2) { count++; durations.push(cur) }
  const avg = durations.length ? (durations.reduce((a, b) => a + b, 0) / durations.length) * 1000 : 0
  return { durationSec: audio.duration, sampleRate: sr, rms: rmsArr, pitchHz: pitchArr, pauses: { count, avgMs: Math.round(avg) } }
}

