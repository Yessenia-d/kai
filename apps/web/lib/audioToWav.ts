"use client";

// Convert an audio Blob (e.g., webm/opus) to 16k mono WAV (16-bit PCM)
export async function blobToWav16kMono(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer()
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0))
  // Resample to 16k and downmix to mono via OfflineAudioContext.
  const targetSr = 16000
  const frameCount = Math.ceil(decoded.duration * targetSr)
  const offline = new OfflineAudioContext(1, frameCount, targetSr)
  const src = offline.createBufferSource()
  src.buffer = decoded // connecting multi-channel buffer to 1ch destination downmixes automatically
  src.connect(offline.destination)
  src.start(0)
  const rendered = await offline.startRendering()
  const out = rendered.getChannelData(0)

  // Encode WAV header + PCM16
  const bytesPerSample = 2
  const blockAlign = 1 * bytesPerSample
  const byteRate = targetSr * blockAlign
  const dataSize = out.length * bytesPerSample
  const bufferSize = 44 + dataSize
  const b = new ArrayBuffer(bufferSize)
  const view = new DataView(b)
  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // channels
  view.setUint32(24, targetSr, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 8 * bytesPerSample, true)
  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)
  // PCM samples
  floatTo16BitPCM(view, 44, out)
  try { ctx.close() } catch {}
  return new Blob([view], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array) {
  let pos = offset
  for (let i = 0; i < input.length; i++, pos += 2) {
    let s = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
}
