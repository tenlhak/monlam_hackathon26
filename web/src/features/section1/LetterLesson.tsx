import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  LESSON_STAGES,
  type Consonant,
  type LessonStage,
} from '@/data/consonants'
import { TraceCanvas } from './TraceCanvas'

type LetterLessonProps = {
  letter: Consonant
  rowLetters: Consonant[]
  stage: LessonStage
  onStageChange: (stage: LessonStage) => void
  onCompleteLetter: () => void
}

export function LetterLesson({
  letter,
  rowLetters,
  stage,
  onStageChange,
  onCompleteLetter,
}: LetterLessonProps) {
  const [heard, setHeard] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [quizChoice, setQuizChoice] = useState<string | null>(null)

  useEffect(() => {
    setHeard(false)
    setSpeaking(false)
    setConfidence(null)
    setQuizChoice(null)
  }, [letter.id])

  const quizOptions = useMemo(() => {
    const others = rowLetters.filter((l) => l.id !== letter.id)
    const pool = [...others].sort(() => Math.random() - 0.5).slice(0, 3)
    return [...pool, letter].sort(() => Math.random() - 0.5)
  }, [letter, rowLetters])

  function goNextStage() {
    const order = LESSON_STAGES.map((s) => s.id)
    const idx = order.indexOf(stage)
    if (idx < order.length - 1) {
      onStageChange(order[idx + 1])
    } else {
      onCompleteLetter()
    }
  }

  function handlePlayListen() {
    setHeard(true)
    // TTS hook-up point (Monlam AI)
  }

  function handleSpeak() {
    setSpeaking(true)
    // STT hook-up point (Monlam AI) — constrained to 30-consonant set
    window.setTimeout(() => {
      setSpeaking(false)
      setConfidence(0.86)
    }, 1200)
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <div className="flex items-center gap-1 border-b border-border/70 pb-3">
        {LESSON_STAGES.map((s) => {
          const active = s.id === stage
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onStageChange(s.id)}
              className={cn(
                'relative px-3 py-1.5 text-sm transition-colors',
                active
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
              {active && (
                <span className="absolute inset-x-2 -bottom-3 h-0.5 rounded-full bg-[oklch(0.62_0.14_295)]" />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex min-h-64 flex-1 flex-col">
        {stage === 'listen' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <p className="font-tibetan text-7xl sm:text-8xl">{letter.glyph}</p>
            <p className="text-sm text-muted-foreground">
              Hear the sound · {letter.latin}
            </p>
            <Button
              className="bg-[oklch(0.88_0.05_295)] text-[oklch(0.35_0.1_295)] hover:bg-[oklch(0.84_0.06_295)]"
              onClick={handlePlayListen}
            >
              {heard ? 'Play again' : 'Play TTS'}
            </Button>
            {heard && (
              <Button variant="outline" onClick={goNextStage}>
                Continue to Trace
              </Button>
            )}
          </div>
        )}

        {stage === 'trace' && (
          <TraceCanvas glyph={letter.glyph} onPass={goNextStage} />
        )}

        {stage === 'speak' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            <p className="font-tibetan text-7xl sm:text-8xl">{letter.glyph}</p>
            <p className="text-sm text-muted-foreground">
              Say the letter · decoder locked to 30 consonants
            </p>
            <Button
              className="bg-[oklch(0.92_0.06_150)] text-[oklch(0.35_0.1_150)] hover:bg-[oklch(0.88_0.07_150)]"
              onClick={handleSpeak}
              disabled={speaking}
            >
              {speaking ? 'Listening…' : 'Hold to speak (STT)'}
            </Button>
            {confidence !== null && (
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    Top: {letter.glyph} ({Math.round(confidence * 100)}%)
                  </span>
                  <span>Runner-up: ཁ (9%)</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[oklch(0.62_0.12_150)] transition-all"
                    style={{ width: `${confidence * 100}%` }}
                  />
                </div>
                <Button variant="outline" className="w-full" onClick={goNextStage}>
                  Continue to Quiz
                </Button>
              </div>
            )}
          </div>
        )}

        {stage === 'quiz' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            <p className="text-sm text-muted-foreground">
              Which letter did you just practice?
            </p>
            <p className="text-lg font-medium tracking-wide">{letter.latin}</p>
            <div className="grid w-full max-w-sm grid-cols-2 gap-3">
              {quizOptions.map((option) => {
                const selected = quizChoice === option.id
                const correct = option.id === letter.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setQuizChoice(option.id)}
                    className={cn(
                      'font-tibetan rounded-xl border py-4 text-3xl transition-all',
                      selected && correct &&
                        'border-transparent bg-[oklch(0.94_0.05_150)]',
                      selected && !correct &&
                        'border-destructive/40 bg-destructive/5',
                      !selected && 'border-border bg-background hover:bg-muted/40',
                    )}
                  >
                    {option.glyph}
                  </button>
                )
              })}
            </div>
            {quizChoice === letter.id && (
              <Button
                className="bg-[oklch(0.88_0.05_295)] text-[oklch(0.35_0.1_295)] hover:bg-[oklch(0.84_0.06_295)]"
                onClick={onCompleteLetter}
              >
                Complete letter
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {stage === 'trace'
          ? 'Stage 2 shown. Canvas check is geometry-based, not OCR — avoids penalising beginner handwriting.'
          : stage === 'listen'
            ? 'Stage 1 · Monlam TTS plays the consonant sound.'
            : stage === 'speak'
              ? 'Stage 3 · STT confidence as a bar with runner-up, not pass/fail.'
              : 'Stage 4 · Quick recognition check before unlocking the next letter.'}
      </p>
    </div>
  )
}
