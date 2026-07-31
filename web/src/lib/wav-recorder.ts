// PCM → WAV encoder + mic capture.
// Uses ScriptProcessorNode (same as static app) to guarantee WAV output
// that the backend STT endpoint is verified against.

let audioCtx: AudioContext | null = null
let mediaStream: MediaStream | null = null
// eslint-disable-next-line @typescript-eslint/no-deprecated
let processor: ScriptProcessorNode | null = null
let chunks: Float32Array[] = []

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return new Blob([view], { type: 'audio/wav' })
}

export async function startRecording(): Promise<void> {
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const source = audioCtx.createMediaStreamSource(mediaStream)
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  processor = audioCtx.createScriptProcessor(4096, 1, 1)
  chunks = []

  processor.onaudioprocess = (e) => {
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
  }

  source.connect(processor)
  processor.connect(audioCtx.destination)
}

export function stopRecording(): Blob {
  if (processor) processor.disconnect()
  if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop())

  const length = chunks.reduce((n, c) => n + c.length, 0)
  const merged = new Float32Array(length)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.length
  }

  const rate = audioCtx ? audioCtx.sampleRate : 44100
  if (audioCtx) {
    audioCtx.close()
    audioCtx = null
  }

  mediaStream = null
  processor = null
  chunks = []

  return encodeWAV(merged, rate)
}
