import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Play, Mic, Square, Cpu, Volume2, X } from 'lucide-react'
import type { PracticeItem, PracticeLevel, ActiveSection } from '@/lib/types/tutor'
import { SECTION2_ITEMS, SECTION2_META, S2_VOWELS, type Section2Item } from '@/lib/section2-data'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import { startRecording, stopRecording } from '@/lib/wav-recorder'
import { useSectionProgress } from '@/lib/progress'
import { recordAndCelebrate } from '@/lib/celebrate'
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

// Section 1 vowel picker (free combination)
const VOWELS = [
  { mark: '',       name: 'none',        label: 'a' },
  { mark: '\u0F72', name: 'i (gi gu)',   label: 'i' },
  { mark: '\u0F74', name: 'u (zhabs kyu)', label: 'u' },
  { mark: '\u0F7A', name: 'e (greng bu)', label: 'e' },
  { mark: '\u0F7C', name: 'o (na ro)',   label: 'o' },
]

interface PracticeViewProps {
  /** Which Level-1 section to load — driven by the route */
  section: ActiveSection
}

export function PracticeView({ section }: PracticeViewProps) {
  const { user } = useAuth()
  const progress = useSectionProgress(1, section)

  // A correct answer records the item and fires the right celebration.
  const completeItem = (itemKey: string) => recordAndCelebrate(1, section, itemKey)

  // ── Drill state ────────────────────────────────────────────────────
  const [drill, setDrill] = useState<Drill>('listen')
  const [itemIndex, setItemIndex] = useState(0)
  const [result, setResult] = useState<ResultState>({ type: 'idle' })

  // Section 1 extras
  const [selectedVowelIdx, setSelectedVowelIdx] = useState(0)
  const [ttsLoading, setTtsLoading] = useState(false)

  // Speak
  const [recording, setRecording] = useState(false)

  // Reset when the route section changes
  React.useEffect(() => {
    setDrill('listen')
    setItemIndex(0)
    setResult({ type: 'idle' })
    setSelectedVowelIdx(0)
  }, [section])

  // ── Data ───────────────────────────────────────────────────────────
  // Section 1 consonants come from the API (backend level 1).
  // Section 2 vowels are frontend-only.
  const { data: s1Data } = useQuery<PracticeLevel>({
    queryKey: ['practice', 1],
    queryFn: () =>
      api.get<PracticeLevel>('/api/practice/items?level=1').then((r) => r.data),
    enabled: !!user && section === 1,
  })

  const s1Items: PracticeItem[] = s1Data?.items ?? []
  const s2Items: Section2Item[] = SECTION2_ITEMS

  const items = section === 1 ? s1Items : s2Items
  const item = items[itemIndex] ?? null
  const s2Item: Section2Item | null =
    section === 2 ? (s2Items[itemIndex] ?? null) : null

  const sectionMeta = section === 1
    ? { title: s1Data?.title ?? 'Foundations', focus: s1Data?.focus ?? '' }
    : SECTION2_META

  // ── Navigation ─────────────────────────────────────────────────────
  const resetDrillState = () => {
    setResult({ type: 'idle' })
    setSelectedVowelIdx(0)
  }

  const prev = () => {
    if (!items.length) return
    setItemIndex((i) => (i - 1 + items.length) % items.length)
    resetDrillState()
  }

  const next = () => {
    if (!items.length) return
    setItemIndex((i) => (i + 1) % items.length)
    resetDrillState()
  }

  const handleDrillChange = (value: string) => {
    setDrill(value as Drill)
    resetDrillState()
  }

  // ── Listen ─────────────────────────────────────────────────────────
  const handleListen = async () => {
    if (!item) return
    setResult({ type: 'loading' })
    try {
      const res = await api.post<{ audio_url: string }>('/api/practice/listen', { text: item.text })
      await new Audio(res.data.audio_url).play()
      setResult({ type: 'ok', message: `Listen and repeat: ${item.roman}` })
      completeItem(item.text)
    } catch (err) {
      setResult({ type: 'error', message: err instanceof Error ? err.message : 'Could not load audio' })
    }
  }

  // ── Speak ──────────────────────────────────────────────────────────
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
      if (data.correct) completeItem(item.text)
    } catch (err) {
      setResult({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  // ── Section 1 Build TTS ────────────────────────────────────────────
  const handleS1BuildTTS = async () => {
    if (!item) return
    setTtsLoading(true)
    try {
      const syllable = item.text + VOWELS[selectedVowelIdx].mark
      const res = await api.post<{ audio_url: string }>('/api/practice/listen', { text: syllable })
      await new Audio(res.data.audio_url).play()
      completeItem(item.text)
    } catch {
      // best-effort TTS
    } finally {
      setTtsLoading(false)
    }
  }

  // ── Section 2 Build: vowel identification quiz ─────────────────────
  const handleS2VowelPick = async (pickedMark: string, pickedName: string) => {
    if (!s2Item) return
    const correct = pickedMark === s2Item.vowelMark

    if (correct) {
      setResult({ type: 'ok', message: `Correct — ${s2Item.vowelName} (${s2Item.vowelLabel})` })
      completeItem(s2Item.text)
      // play the syllable as positive reinforcement
      try {
        const res = await api.post<{ audio_url: string }>('/api/practice/listen', { text: s2Item.text })
        await new Audio(res.data.audio_url).play()
      } catch { /* ignore */ }
    } else {
      setResult({ type: 'error', message: `Not quite — that's ${pickedName}. Try again.` })
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────

  function renderResultBanner() {
    if (result.type === 'idle' || result.type === 'loading') return null
    const ok = result.type === 'ok'
    return (
      <div
        key={result.message}
        className={cn(
          'flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-heading font-bold',
          ok
            ? 'bg-success/12 text-success animate-pop-in'
            : 'bg-destructive/10 text-destructive animate-shake',
        )}
      >
        {ok ? <Check className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}
        <span className="min-w-0">{result.message}</span>
      </div>
    )
  }

  function renderListenDrill() {
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="w-full flex flex-col items-center rounded-2xl border border-border bg-card shadow-sm py-6">
          <p className="font-tibetan text-6xl leading-[2.2]">{item?.text}</p>
        </div>
        <p className="text-base text-muted-foreground">{item?.roman} — {item?.gloss}</p>
        <Button
          onClick={handleListen}
          disabled={result.type === 'loading'}
          variant="outline"
          className="gap-2 mt-2"
        >
          <Play className="h-4 w-4" />
          {result.type === 'loading' ? 'Loading…' : 'Play'}
        </Button>
        {renderResultBanner()}
      </div>
    )
  }

  function renderSpeakDrill() {
    let speakLabel: React.ReactNode
    if (recording) {
      speakLabel = <><Square className="h-4 w-4" />Stop</>
    } else if (result.type === 'loading') {
      speakLabel = 'Checking…'
    } else {
      speakLabel = <><Mic className="h-4 w-4" />Record</>
    }

    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="w-full flex flex-col items-center rounded-2xl border border-border bg-card shadow-sm py-6">
          <p className="font-tibetan text-6xl leading-[2.2]">{item?.text}</p>
        </div>
        <p className="text-base text-muted-foreground">{item?.roman} — {item?.gloss}</p>
        <Button
          onClick={handleSpeak}
          disabled={result.type === 'loading'}
          variant={recording ? 'destructive' : 'outline'}
          className="gap-2 mt-2"
        >
          {speakLabel}
        </Button>
        {renderResultBanner()}
      </div>
    )
  }

  function renderTraceDrill() {
    return (
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
        <TraceCanvas glyph={item?.text ?? ''} onPass={() => item && completeItem(item.text)} />
        <p className="text-xs text-center text-muted-foreground">
          {item?.roman} — {item?.gloss}
        </p>
        <p className="text-[11px] text-center text-muted-foreground/60 italic">
          Deliberately not OCR — print-trained OCR misreads beginner handwriting
        </p>
      </div>
    )
  }

  function renderS1BuildDrill() {
    if (!item) return null
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-sm">Build</p>
            <p className="text-xs text-muted-foreground">Add a vowel to the root letter</p>
          </div>
          <Button
            variant="secondary" size="sm"
            onClick={handleS1BuildTTS} disabled={ttsLoading}
            className="rounded-full text-xs gap-1.5 h-7 px-3"
          >
            <Volume2 className="h-3 w-3" />
            {ttsLoading ? 'Playing…' : 'Monlam TTS'}
          </Button>
        </div>

        <div className="flex flex-col items-center rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-center w-full py-8 px-4 min-h-[140px]">
            <p className="font-tibetan text-6xl leading-[2.2]">
              {item.text + VOWELS[selectedVowelIdx].mark}
            </p>
          </div>
          <div className="w-full border-t border-border py-2.5 text-center">
            <p className="text-sm text-muted-foreground">
              {item.roman} · vowel:{' '}
              <span className="text-foreground font-medium">{VOWELS[selectedVowelIdx].name}</span>
            </p>
          </div>
        </div>

        <div className="flex justify-center gap-2">
          {VOWELS.map((v, i) => (
            <button
              key={i}
              onClick={() => setSelectedVowelIdx(i)}
              className={cn(
                'min-w-[52px] min-h-[52px] rounded-lg font-tibetan text-xl flex items-center justify-center border transition-colors',
                selectedVowelIdx === i
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'border-border text-foreground hover:bg-accent hover:border-accent-foreground/20',
              )}
            >
              {item.text + v.mark}
            </button>
          ))}
        </div>

        <p className="text-xs text-center text-muted-foreground italic">{item.gloss}</p>
      </div>
    )
  }

  function renderS2BuildDrill() {
    if (!s2Item) return null
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-sm">Build</p>
            <p className="text-xs text-muted-foreground">Which vowel makes this syllable?</p>
          </div>
          <Badge variant="secondary" className="gap-1 text-xs">
            <Volume2 className="h-3 w-3" />
            Vowel quiz
          </Badge>
        </div>

        {/* Target syllable */}
        <div className="flex flex-col items-center rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-center w-full py-8 px-4 min-h-[140px]">
            <p className="font-tibetan text-6xl leading-[2.2]">{s2Item.text}</p>
          </div>
          <div className="w-full border-t border-border py-2.5 text-center">
            <p className="text-sm text-muted-foreground">
              Base:{' '}
              <span className="font-tibetan text-base">{s2Item.base}</span>
              {' '}+{' '}
              <span className="font-medium">?</span>
              {' '}= {s2Item.roman}
            </p>
          </div>
        </div>

        {/* 4 vowel choices — shown as base+vowel for readability */}
        <div className="flex justify-center gap-2">
          {S2_VOWELS.map((v) => {
            const isCorrect = v.mark === s2Item.vowelMark
            const wasAnswered = result.type !== 'idle' && result.type !== 'loading'
            return (
              <button
                key={v.mark}
                onClick={() => !wasAnswered && handleS2VowelPick(v.mark, v.name)}
                disabled={wasAnswered}
                className={cn(
                  'min-w-[56px] min-h-[56px] flex flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors font-tibetan text-xl px-1',
                  wasAnswered && isCorrect
                    ? 'bg-green-500/10 border-green-500 text-green-600 dark:text-green-400'
                    : wasAnswered && !isCorrect
                      ? 'bg-muted/40 border-border text-muted-foreground opacity-50'
                      : 'border-border text-foreground hover:bg-accent hover:border-accent-foreground/20',
                )}
              >
                {s2Item.base + v.mark}
                <span className="font-sans text-[9px] text-muted-foreground not-italic leading-none">
                  {v.label}
                </span>
              </button>
            )
          })}
        </div>

        {renderResultBanner()}

        <p className="text-xs text-center text-muted-foreground italic">{s2Item.gloss}</p>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────
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
        {sectionMeta.focus && (
          <p className="text-sm text-muted-foreground text-center">
            {sectionMeta.title} — {sectionMeta.focus}
          </p>
        )}

        {/* Section progress */}
        {progress.total > 0 && (
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  progress.complete ? 'bg-gradient-to-r from-sunrise to-sun' : 'bg-primary',
                )}
                style={{ width: `${Math.max(progress.percent, progress.done > 0 ? 3 : 0)}%` }}
              />
            </div>
            <span className="text-xs font-heading font-bold text-muted-foreground tabular-nums shrink-0">
              {progress.complete ? 'Complete! 🎉' : `${progress.done}/${progress.total}`}
            </span>
          </div>
        )}

        <Separator />

        {item ? (
          <>
            {drill === 'listen' && renderListenDrill()}
            {drill === 'trace'  && renderTraceDrill()}
            {drill === 'speak'  && renderSpeakDrill()}
            {drill === 'build'  && section === 1 && renderS1BuildDrill()}
            {drill === 'build'  && section === 2 && renderS2BuildDrill()}

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
