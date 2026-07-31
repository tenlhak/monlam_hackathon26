import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Play, Mic, Square } from 'lucide-react'
import type { PracticeItem, PracticeLevel } from '@/lib/types/tutor'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import { startRecording, stopRecording } from '@/lib/wav-recorder'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

type Drill = 'listen' | 'trace' | 'speak'

type ResultState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'ok'; message: string }
  | { type: 'error'; message: string }

export function PracticeView() {
  const { user } = useAuth()
  const [drill, setDrill] = useState<Drill>('listen')
  const [itemIndex, setItemIndex] = useState(0)
  const [recording, setRecording] = useState(false)
  const [result, setResult] = useState<ResultState>({ type: 'idle' })

  const { data } = useQuery<PracticeLevel>({
    queryKey: ['practice', user?.level],
    queryFn: () =>
      api.get<PracticeLevel>(`/api/practice/items?level=${user?.level ?? 1}`).then((r) => r.data),
    enabled: !!user,
  })

  const items: PracticeItem[] = data?.items ?? []
  const item = items[itemIndex] ?? null

  const prev = () => {
    if (!items.length) return
    setItemIndex((i) => (i - 1 + items.length) % items.length)
    setResult({ type: 'idle' })
  }

  const next = () => {
    if (!items.length) return
    setItemIndex((i) => (i + 1) % items.length)
    setResult({ type: 'idle' })
  }

  const handleDrillChange = (value: string) => {
    if (value === 'trace') return
    setDrill(value as Drill)
    setResult({ type: 'idle' })
  }

  const handleListen = async () => {
    if (!item) return
    setResult({ type: 'loading' })
    try {
      const res = await api.post<{ audio_url: string }>('/api/practice/listen', { text: item.text })
      const audio = new Audio(res.data.audio_url)
      await audio.play()
      setResult({ type: 'ok', message: `Listen and repeat: ${item.roman}` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load audio'
      setResult({ type: 'error', message: msg })
    }
  }

  const handleSpeak = async () => {
    if (!item || !user) return

    if (!recording) {
      try {
        await startRecording()
        setRecording(true)
        setResult({ type: 'ok', message: `Listening… say "${item.roman}"` })
      } catch {
        setResult({ type: 'error', message: 'Could not access the microphone.' })
      }
      return
    }

    setRecording(false)
    setResult({ type: 'loading' })

    const wav = stopRecording()

    try {
      const form = new FormData()
      form.append('user_id', String(user.id))
      form.append('target', item.text)
      form.append('audio', wav, 'recording.wav')

      const res = await fetch('/api/practice/speak', { method: 'POST', body: form })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.detail ?? 'Could not check that')
      }
      const data = await res.json() as { transcript: string; correct: boolean }

      if (data.correct) {
        setResult({
          type: 'ok',
          message: `Correct — I heard "${data.transcript}"`,
        })
      } else {
        setResult({
          type: 'error',
          message: `I heard "${data.transcript || 'nothing'}" — try again`,
        })
      }
    } catch (err) {
      setResult({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="p-4 space-y-5 max-w-lg mx-auto w-full">
        {/* Drill tabs */}
        <Tabs value={drill} onValueChange={handleDrillChange}>
          <TabsList className="w-full">
            <TabsTrigger value="listen" className="flex-1">
              Listen
            </TabsTrigger>
            <TabsTrigger value="trace" disabled className="flex-1">
              Trace
              <span className="ml-1.5 text-[10px] text-muted-foreground">Soon</span>
            </TabsTrigger>
            <TabsTrigger value="speak" className="flex-1">
              Speak
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Focus label */}
        {data && (
          <p className="text-sm text-muted-foreground text-center">
            {data.title} — {data.focus}
          </p>
        )}

        <Separator />

        {/* Card */}
        {item ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="font-tibetan text-6xl leading-relaxed">{item.text}</p>
            <p className="text-base text-muted-foreground">
              {item.roman} — {item.gloss}
            </p>

            {/* Action button */}
            <div className="mt-2">
              {drill === 'listen' && (
                <Button
                  onClick={handleListen}
                  disabled={result.type === 'loading'}
                  variant="outline"
                  className="gap-2"
                >
                  <Play className="h-4 w-4" />
                  {result.type === 'loading' ? 'Loading…' : 'Play'}
                </Button>
              )}
              {drill === 'speak' && (
                <Button
                  onClick={handleSpeak}
                  disabled={result.type === 'loading'}
                  variant={recording ? 'destructive' : 'outline'}
                  className="gap-2"
                >
                  {recording ? (
                    <>
                      <Square className="h-4 w-4" />
                      Stop
                    </>
                  ) : result.type === 'loading' ? (
                    'Checking…'
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      Record
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Result feedback */}
            {result.type !== 'idle' && result.type !== 'loading' && (
              <p
                className={`text-sm ${
                  result.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-destructive'
                }`}
              >
                {result.message}
              </p>
            )}

            {/* Navigation */}
            <div className="flex items-center gap-4 mt-2">
              <Button variant="ghost" size="icon" onClick={prev}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {itemIndex + 1} / {items.length}
              </span>
              <Button variant="ghost" size="icon" onClick={next}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground text-sm py-12">Loading practice items…</p>
        )}
      </div>
    </div>
  )
}
