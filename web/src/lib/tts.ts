import { api } from '@/lib/api'

/** Speak Tibetan text through Monlam TTS. Best-effort — callers show no error. */
export async function playTts(text: string): Promise<void> {
  const res = await api.post<{ audio_url: string }>('/api/practice/listen', { text })
  await new Audio(res.data.audio_url).play()
}
