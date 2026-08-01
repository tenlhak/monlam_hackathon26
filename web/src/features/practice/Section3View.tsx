import { useCallback, useEffect, useState } from 'react'
import { Volume2, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  SYLLABLES,
  SOUND_QUIZ,
  SECTION3_META,
  SLOT_ORDER,
  SLOT_HEADERS,
  type SyllableExample,
  type SlotPiece,
  type QuizAnswer,
} from '@/lib/section3-data'
import { api } from '@/lib/api'
import { recordAndCelebrate } from '@/lib/celebrate'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type Mode = 'anatomy' | 'builder' | 'quiz'

async function playTts(text: string) {
  if (!text.trim()) return
  const res = await api.post<{ audio_url: string }>('/api/practice/listen', { text })
  await new Audio(res.data.audio_url).play()
}

function SlotPill({
  glyph,
  label,
  heard,
}: {
  glyph: string
  label: string
  heard: boolean
}) {
  return (
    <div
      className={cn(
        'flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl border px-3 py-3',
        heard
          ? 'border-violet-500/60 bg-violet-500/10 text-violet-700 dark:text-violet-300'
          : 'border-border bg-muted/40 text-muted-foreground',
      )}
    >
      <span className="font-tibetan text-2xl leading-[1.8]">{glyph || '—'}</span>
      <span className="text-[10px] text-center leading-tight">{label}</span>
    </div>
  )
}

function AnatomyPanel({
  example,
  onPlay,
  playing,
}: {
  example: SyllableExample
  onPlay: () => void
  playing: boolean
}) {
  const filled = example.slots.filter((s) => s.glyph)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm">Anatomy</p>
          <p className="text-xs text-muted-foreground">
            Purple = heard. Gray = silent.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onPlay}
          disabled={playing}
          className="rounded-full text-xs gap-1.5 h-7 px-3"
        >
          <Volume2 className="h-3 w-3" />
          {playing ? 'Playing…' : 'TTS'}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
        <div className="flex flex-col items-center py-6 px-4 gap-1">
          <p className="font-tibetan text-5xl leading-[2.2]">{example.text}</p>
          <p className="text-sm text-muted-foreground">
            {example.roman} — {example.gloss}
          </p>
        </div>

        <Separator />

        <div className="flex flex-wrap justify-center gap-2 p-4">
          {filled.map((slot) => (
            <SlotPill
              key={slot.key}
              glyph={slot.glyph}
              label={slot.label}
              heard={slot.heard}
            />
          ))}
        </div>

        {example.extras && example.extras.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-[11px] text-muted-foreground mb-2 text-center uppercase tracking-wider">
              Full stack extras
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {example.extras.map((ex) => (
                <SlotPill
                  key={ex.key}
                  glyph={ex.glyph}
                  label={ex.label}
                  heard={ex.heard}
                />
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-border px-4 py-3 text-center space-y-1">
          <p className="text-sm font-medium">{example.heardSummary}</p>
          {example.note && (
            <p className="text-xs text-muted-foreground">{example.note}</p>
          )}
        </div>
      </div>

      <p className="text-[11px] text-center text-muted-foreground/70">
        Stack order: prefix → superscript → root → subscript → vowel → suffix → post-suffix
      </p>
    </div>
  )
}

function BuilderPanel({
  example,
  onSelectPreset,
}: {
  example: SyllableExample
  onSelectPreset: (ex: SyllableExample) => void
}) {
  const [slots, setSlots] = useState<SlotPiece[]>(example.slots)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    setSlots(example.slots)
  }, [example])

  const speak = useCallback(async (text: string) => {
    setPlaying(true)
    try {
      await playTts(text)
    } catch {
      // best-effort
    } finally {
      setPlaying(false)
    }
  }, [])

  const loadPreset = (ex: SyllableExample) => {
    onSelectPreset(ex)
    setSlots(ex.slots)
    void speak(ex.text)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm">Builder</p>
          <p className="text-xs text-muted-foreground">
            Drop a real word into the slots — TTS fires on each preset.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => speak(example.text)}
          disabled={playing}
          className="rounded-full text-xs gap-1.5 h-7 px-3"
        >
          <Volume2 className="h-3 w-3" />
          {playing ? 'Playing…' : 'TTS'}
        </Button>
      </div>

      {/* Slot headers + boxes */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <div className="grid grid-cols-5 gap-1.5">
          {SLOT_ORDER.map((key) => (
            <div key={key} className="text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {SLOT_HEADERS[key].short}
              </p>
              <p className="font-tibetan text-[10px] text-muted-foreground/70 leading-tight">
                {SLOT_HEADERS[key].tibetan}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {SLOT_ORDER.map((key) => {
            const slot = slots.find((s) => s.key === key)!
            let slotClass = 'border-dashed border-border/60 text-muted-foreground/40'
            if (slot.glyph && slot.heard) {
              slotClass = 'border-violet-500/50 bg-violet-500/10'
            } else if (slot.glyph) {
              slotClass = 'border-border bg-muted/50 text-muted-foreground'
            }
            return (
              <div
                key={key}
                className={cn(
                  'flex min-h-18 items-center justify-center rounded-lg border font-tibetan text-2xl leading-[1.8]',
                  slotClass,
                )}
              >
                {slot.glyph || '—'}
              </div>
            )
          })}
        </div>

        <div className="text-center pt-1">
          <p className="font-tibetan text-3xl leading-[2]">{example.text}</p>
          <p className="text-sm text-muted-foreground">
            {example.roman} — {example.gloss}
          </p>
        </div>
      </div>

      {/* Preset chips */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground text-center">
          Preset words — tap to load into the builder
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {SYLLABLES.map((ex) => (
            <button
              key={ex.id}
              onClick={() => loadPreset(ex)}
              className={cn(
                'rounded-full border px-3 py-1.5 font-tibetan text-base leading-[1.8] transition-colors',
                ex.id === example.id
                  ? 'border-violet-500/60 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                  : 'border-border hover:bg-accent',
              )}
            >
              {ex.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function QuizPanel() {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<QuizAnswer | null>(null)
  const [playing, setPlaying] = useState<'before' | 'after' | null>(null)
  const item = SOUND_QUIZ[index]

  const play = async (which: 'before' | 'after') => {
    setPlaying(which)
    try {
      await playTts(which === 'before' ? item.before : item.after)
    } catch {
      // ignore
    } finally {
      setPlaying(null)
    }
  }

  const next = () => {
    setIndex((i) => (i + 1) % SOUND_QUIZ.length)
    setPicked(null)
  }

  const prev = () => {
    setIndex((i) => (i - 1 + SOUND_QUIZ.length) % SOUND_QUIZ.length)
    setPicked(null)
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-semibold text-sm">Sound-change quiz</p>
        <p className="text-xs text-muted-foreground">
          I changed one slot — what changed in the sound?
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
        <p className="text-sm text-center">{item.prompt}</p>

        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { key: 'before' as const, text: item.before, roman: item.beforeRoman, label: 'Before' },
              { key: 'after' as const, text: item.after, roman: item.afterRoman, label: 'After' },
            ]
          ).map((side) => (
            <button
              key={side.key}
              onClick={() => play(side.key)}
              className="rounded-lg border border-border bg-background p-3 text-center hover:bg-accent/40 transition-colors"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {side.label}
                {playing === side.key ? ' · …' : ''}
              </p>
              <p className="font-tibetan text-3xl leading-[2]">{side.text}</p>
              <p className="text-xs text-muted-foreground">{side.roman}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {item.options.map((opt) => {
            const isPicked = picked === opt.key
            const isCorrect = opt.key === item.answer
            const showResult = picked !== null

            return (
              <button
                key={opt.key}
                disabled={picked !== null}
                onClick={() => {
                  setPicked(opt.key)
                  if (opt.key === item.answer) recordAndCelebrate(1, 3, item.prompt)
                }}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-sm text-left transition-colors',
                  showResult && isCorrect && 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400',
                  showResult && isPicked && !isCorrect && 'border-destructive bg-destructive/10 text-destructive',
                  !showResult && 'border-border hover:bg-accent',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {picked && (
          <p
            className={cn(
              'text-sm text-center',
              picked === item.answer
                ? 'text-green-600 dark:text-green-400'
                : 'text-destructive',
            )}
          >
            {picked === item.answer
              ? 'Correct — you heard what actually changed.'
              : `Not quite — the answer is “${item.options.find((o) => o.key === item.answer)?.label}”.`}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={prev}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {index + 1} / {SOUND_QUIZ.length}
        </span>
        <Button variant="ghost" size="icon" onClick={next}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}

export function Section3View() {
  const [mode, setMode] = useState<Mode>('anatomy')
  const [exampleIndex, setExampleIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const example = SYLLABLES[exampleIndex]

  const handlePlay = async () => {
    setPlaying(true)
    try {
      await playTts(example.text)
      recordAndCelebrate(1, 3, example.id)
    } catch {
      // ignore
    } finally {
      setPlaying(false)
    }
  }

  const prevExample = () => {
    setExampleIndex((i) => (i - 1 + SYLLABLES.length) % SYLLABLES.length)
  }

  const nextExample = () => {
    setExampleIndex((i) => (i + 1) % SYLLABLES.length)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Section 3
            </p>
            <h2 className="font-semibold">{SECTION3_META.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{SECTION3_META.focus}</p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            Interactive
          </Badge>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="anatomy" className="flex-1 text-xs sm:text-sm">
              Anatomy
            </TabsTrigger>
            <TabsTrigger value="builder" className="flex-1 text-xs sm:text-sm">
              Builder
            </TabsTrigger>
            <TabsTrigger value="quiz" className="flex-1 text-xs sm:text-sm">
              Quiz
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Separator />

        {mode === 'anatomy' && (
          <>
            <AnatomyPanel example={example} onPlay={handlePlay} playing={playing} />
            <div className="flex items-center justify-center gap-4 pt-1">
              <Button variant="ghost" size="icon" onClick={prevExample}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {exampleIndex + 1} / {SYLLABLES.length}
              </span>
              <Button variant="ghost" size="icon" onClick={nextExample}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </>
        )}

        {mode === 'builder' && (
          <BuilderPanel
            example={example}
            onSelectPreset={(ex) => {
              const idx = SYLLABLES.findIndex((s) => s.id === ex.id)
              if (idx >= 0) setExampleIndex(idx)
            }}
          />
        )}

        {mode === 'quiz' && <QuizPanel />}
      </div>
    </div>
  )
}
