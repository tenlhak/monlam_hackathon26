import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Play, Mic, Square, Cpu, Volume2 } from 'lucide-react'
import type { PracticeItem, PracticeLevel } from '@/lib/types/tutor'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import { startRecording, stopRecording } from '@/lib/wav-recorder'
import { TraceCanvas } from '@/features/section1/TraceCanvas'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Drill = 'listen' | 'trace' | 'speak' | 'build'

type ResultState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'ok'; message: string }
  | { type: 'error'; message: string }

// Tibetan vowel diacritics: no mark (inherent 'a') + 4 explicit vowels
const VOWELS = [
  { mark: '',       name: 'none',       label: 'a' },
  { mark: '\u0F72', name: 'i (gi gu)',  label: 'i' },
  { mark: '\u0F74', name: 'u (zhabs kyu)', label: 'u' },
  { mark: '\u0F7A', name: 'e (naro)',   label: 'e' },
  { mark: '\u0F7C', name: 'o (dbu ma)', label: 'o' },
]

export function PracticeView() {
  const { user } = useAuth()
  const [drill, setDrill] = useState<Drill>('listen')
  const [itemIndex, setItemIndex] = useState(0)
  const [recording, setRecording] = useState(false)
  const [result, setResult] = useState<ResultState>({ type: 'idle' })
  const [selectedVowelIdx, setSelectedVowelIdx] = useState(0)
  const [ttsLoading, setTtsLoading] = useState(false)

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
    setSelectedVowelIdx(0)
  }

  const next = () => {
    if (!items.length) return
    setItemIndex((i) => (i + 1) % items.length)
    setResult({ type: 'idle' })
    setSelectedVowelIdx(0)
  }

  const handleDrillChange = (value: string) => {
    setDrill(value as Drill)
    setResult({ type: 'idle' })
    setSelectedVowelIdx(0)
  }

  const handleListen = async () => {
    if (!item) return
    setResult({ type: 'loading' })
    try {
      const res = await api.post<{ audio_url: string }>('/api/practice/listen', { text: item.text })
      await new Audio(res.data.audio_url).play()
      setResult({ type: 'ok', message: `Listen and repeat: ${item.roman}` })
    } catch (err) {
      setResult({ type: 'error', message: err instanceof Error ? err.message : 'Could not load audio' })
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
      setResult(
        data.correct
          ? { type: 'ok', message: `Correct — I heard "${data.transcript}"` }
          : { type: 'error', message: `I heard "${data.transcript || 'nothing'}" — try again` },
      )
    } catch (err) {
      setResult({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  const handleBuildTTS = async () => {
    if (!item) return
    setTtsLoading(true)
    try {
      const syllable = item.text + VOWELS[selectedVowelIdx].mark
      const res = await api.post<{ audio_url: string }>('/api/practice/listen', { text: syllable })
      await new Audio(res.data.audio_url).play()
    } catch {
      // TTS is optional — no error UI for this helper
    } finally {
      setTtsLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">

        {/* Drill tabs */}
        <Tabs value={drill} onValueChange={handleDrillChange}>
          <TabsList className="w-full">
            <TabsTrigger value="listen" className="flex-1 text-xs sm:text-sm">Listen</TabsTrigger>
            <TabsTrigger value="trace"  className="flex-1 text-xs sm:text-sm">Trace</TabsTrigger>
            <TabsTrigger value="speak"  className="flex-1 text-xs sm:text-sm">Speak</TabsTrigger>
            <TabsTrigger value="build"  className="flex-1 text-xs sm:text-sm">Build</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Focus label */}
        {data && (
          <p className="text-sm text-muted-foreground text-center">
            {data.title} — {data.focus}
          </p>
        )}

        <Separator />

        {item ? (
          <>
            {/* ── Trace drill ── */}
            {drill === 'trace' && (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">Trace</p>
                    <p className="text-xs text-muted-foreground">Follow the stroke order</p>
                  </div>
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Cpu className="h-3 w-3" />
                    On-device check
                  </Badge>
                </div>
                <TraceCanvas glyph={item.text} onPass={() => {}} />
                <p className="text-xs text-center text-muted-foreground">
                  {item.roman} — {item.gloss}
                </p>
                <p className="text-[11px] text-center text-muted-foreground/60 italic">
                  Deliberately not OCR — print-trained OCR misreads beginner handwriting
                </p>
              </div>
            )}

            {/* ── Build drill ── */}
            {drill === 'build' && (
              <div className="space-y-4">
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">Build</p>
                    <p className="text-xs text-muted-foreground">Add a vowel to the root letter</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleBuildTTS}
                    disabled={ttsLoading}
                    className="rounded-full text-xs gap-1.5 h-7 px-3"
                  >
                    <Volume2 className="h-3 w-3" />
                    {ttsLoading ? 'Playing…' : 'Monlam TTS'}
                  </Button>
                </div>

                {/* Glyph display */}
                <div className="flex flex-col items-center rounded-xl bg-muted/30 border border-border overflow-hidden">
                  <div className="flex items-center justify-center w-full py-8 px-4 min-h-[140px]">
                    <p className="font-tibetan text-6xl leading-[2.2]">
                      {item.text + VOWELS[selectedVowelIdx].mark}
                    </p>
                  </div>
                  <div className="w-full border-t border-border py-2.5 text-center">
                    <p className="text-sm text-muted-foreground">
                      {item.roman} · vowel:{' '}
                      <span className="text-foreground font-medium">
                        {VOWELS[selectedVowelIdx].name}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Vowel picker */}
                <div className="flex justify-center gap-2">
                  {VOWELS.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedVowelIdx(i)}
                      className={cn(
                        'w-13 h-13 min-w-[52px] min-h-[52px] rounded-lg font-tibetan text-xl flex items-center justify-center border transition-colors',
                        selectedVowelIdx === i
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'border-border text-foreground hover:bg-accent hover:border-accent-foreground/20',
                      )}
                    >
                      {item.text + v.mark}
                    </button>
                  ))}
                </div>

                {/* Hint */}
                <p className="text-xs text-center text-muted-foreground italic">
                  {item.gloss}
                </p>
              </div>
            )}

            {/* ── Listen / Speak drills ── */}
            {(drill === 'listen' || drill === 'speak') && (
              <div className="flex flex-col items-center gap-4 py-4">
                <p className="font-tibetan text-6xl leading-relaxed">{item.text}</p>
                <p className="text-base text-muted-foreground">
                  {item.roman} — {item.gloss}
                </p>

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
                  {drill === 'speak' && (() => {
                    let speakLabel: React.ReactNode
                    if (recording) {
                      speakLabel = <><Square className="h-4 w-4" />Stop</>
                    } else if (result.type === 'loading') {
                      speakLabel = 'Checking…'
                    } else {
                      speakLabel = <><Mic className="h-4 w-4" />Record</>
                    }
                    return (
                      <Button
                        onClick={handleSpeak}
                        disabled={result.type === 'loading'}
                        variant={recording ? 'destructive' : 'outline'}
                        className="gap-2"
                      >
                        {speakLabel}
                      </Button>
                    )
                  })()}
                </div>

                {result.type !== 'idle' && result.type !== 'loading' && (
                  <p className={`text-sm ${result.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                    {result.message}
                  </p>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4 pt-1">
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
          </>
        ) : (
          <p className="text-center text-muted-foreground text-sm py-12">Loading practice items…</p>
        )}
      </div>
    </div>
  )
}
