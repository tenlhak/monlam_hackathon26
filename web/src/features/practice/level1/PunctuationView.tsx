import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Volume2 } from 'lucide-react'
import {
  MARKS,
  PHRASES,
  isShad,
  isTsheg,
  splitSyllables,
  type PunctuationMark,
} from '@/lib/punctuation-data'
import { playTts } from '@/lib/tts'
import { recordAndCelebrate } from '@/lib/celebrate'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type Mode = 'marks' | 'context' | 'quiz'

/** Tsheg and shad get distinct tints so the two roles stay visually separate. */
const MARK_TINT: Record<PunctuationMark['id'], string> = {
  tsheg:
    'text-[oklch(0.5_0.16_275)] bg-[oklch(0.94_0.03_275)] dark:text-[oklch(0.83_0.11_275)] dark:bg-[oklch(0.3_0.06_275)]',
  shad: 'text-[oklch(0.42_0.11_155)] bg-[oklch(0.93_0.04_155)] dark:text-[oklch(0.82_0.1_155)] dark:bg-[oklch(0.29_0.05_155)]',
}

export function PunctuationView() {
  const [mode, setMode] = useState<Mode>('marks')

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="marks" className="flex-1 text-xs sm:text-sm">
              Marks
            </TabsTrigger>
            <TabsTrigger value="context" className="flex-1 text-xs sm:text-sm">
              In context
            </TabsTrigger>
            <TabsTrigger value="quiz" className="flex-1 text-xs sm:text-sm">
              Quiz
            </TabsTrigger>
          </TabsList>
        </Tabs>


        {mode === 'marks' && <MarksPanel />}
        {mode === 'context' && <ContextPanel />}
        {mode === 'quiz' && <QuizPanel />}
      </div>
    </div>
  )
}

/** Renders a phrase with its punctuation picked out from the letters. */
function MarkedPhrase({ text, size = 'text-4xl' }: { text: string; size?: string }) {
  return (
    <p className={cn('font-tibetan leading-[1.9]', size)}>
      {[...text].map((char, i) => {
        const tint = isTsheg(char)
          ? MARK_TINT.tsheg
          : isShad(char)
            ? MARK_TINT.shad
            : null
        return tint ? (
          <span key={i} className={cn('rounded px-0.5', tint)}>
            {char}
          </span>
        ) : (
          <span key={i}>{char}</span>
        )
      })}
    </p>
  )
}

// ───────────────────────────────────────────────────────────── Marks

function MarksPanel() {
  const [playing, setPlaying] = useState<string | null>(null)

  const speak = async (mark: PunctuationMark) => {
    setPlaying(mark.id)
    try {
      await playTts(mark.name)
    } catch {
      // best-effort TTS
    } finally {
      setPlaying(null)
    }
  }

  return (
    <div className="space-y-3">
      {MARKS.map((mark) => (
        <div
          key={mark.id}
          className="rounded-xl border border-border bg-card p-4 space-y-3"
        >
          <div className="flex items-center gap-4">
            <span
              className={cn(
                'flex h-16 w-16 shrink-0 items-center justify-center rounded-xl font-tibetan text-4xl leading-[1.9]',
                MARK_TINT[mark.id],
              )}
            >
              {mark.glyph}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-tibetan text-xl leading-[1.9]">{mark.name}</p>
              <p className="text-xs text-muted-foreground">
                {mark.roman} — {mark.title}
              </p>
            </div>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => speak(mark)}
              disabled={playing === mark.id}
              title={`Hear ${mark.roman}`}
            >
              <Volume2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <p className="text-sm">{mark.role}</p>
          <p className="text-xs leading-[1.9] text-muted-foreground">{mark.note}</p>
        </div>
      ))}

      <p className="text-xs text-muted-foreground italic">
        The audio plays the mark's name, not the mark — neither one makes a
        sound of its own when you read aloud.
      </p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────── Context

function ContextPanel() {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  const phrase = PHRASES[index]
  const syllables = useMemo(() => splitSyllables(phrase.text), [phrase])
  const endsWithShad = [...phrase.text].some(isShad)

  const go = (delta: number) =>
    setIndex((i) => (i + delta + PHRASES.length) % PHRASES.length)

  const say = async () => {
    setPlaying(true)
    try {
      await playTts(phrase.text)
    } catch {
      // best-effort TTS
    } finally {
      setPlaying(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-7 text-center space-y-2">
        <MarkedPhrase text={phrase.text} />
        <p className="text-sm text-muted-foreground">
          {phrase.roman} — {phrase.gloss}
        </p>
      </div>

      <div className="flex justify-center">
        <Button variant="outline" onClick={say} disabled={playing} className="gap-2">
          <Volume2 className="h-4 w-4" />
          {playing ? 'Playing…' : 'Hear the phrase'}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {syllables.length} {syllables.length === 1 ? 'syllable' : 'syllables'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {syllables.map((syllable, i) => (
            <span
              key={i}
              className="rounded-lg border border-border bg-card px-2.5 py-1 font-tibetan text-lg leading-[1.9]"
            >
              {syllable}
            </span>
          ))}
        </div>
      </div>

      <p className="text-xs leading-[1.9] text-muted-foreground">
        {endsWithShad
          ? 'The ཤད closes it. Notice the last syllable has no ཚེག — the shad replaces it.'
          : 'No ཤད here: this is a word, not a finished sentence.'}
      </p>

      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => go(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {index + 1} / {PHRASES.length}
        </span>
        <Button variant="ghost" size="icon" onClick={() => go(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────── Quiz

interface Question {
  phrase: (typeof PHRASES)[number]
  answer: number
  options: number[]
}

/** Ask the syllable count — the one thing knowing the tsheg actually buys you. */
function buildQuestions(): Question[] {
  return PHRASES.map((phrase) => {
    const answer = splitSyllables(phrase.text).length
    const options = new Set<number>([answer])
    let spread = 1
    while (options.size < 4) {
      if (answer - spread >= 1) options.add(answer - spread)
      if (options.size < 4) options.add(answer + spread)
      spread++
    }
    return {
      phrase,
      answer,
      options: [...options].sort((a, b) => a - b),
    }
  }).sort(() => Math.random() - 0.5)
}

function QuizPanel() {
  const questions = useMemo(buildQuestions, [])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState({ right: 0, asked: 0 })

  const question = questions[index]
  const correct = picked === question.answer

  const pick = (option: number) => {
    if (picked !== null) return
    setPicked(option)
    setScore((s) => ({
      right: s.right + (option === question.answer ? 1 : 0),
      asked: s.asked + 1,
    }))
    if (option === question.answer) recordAndCelebrate(1, 4, question.phrase.text)
  }

  const next = () => {
    setIndex((i) => (i + 1) % questions.length)
    setPicked(null)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-center">
        How many syllables does this have?
      </p>

      <div className="rounded-xl border border-border bg-muted/30 px-4 py-7 text-center space-y-2">
        <MarkedPhrase text={question.phrase.text} />
        {picked !== null && (
          <p className="text-sm text-muted-foreground">
            {question.phrase.roman} — {question.phrase.gloss}
          </p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {question.options.map((option) => {
          const isAnswer = option === question.answer
          const answered = picked !== null
          return (
            <button
              key={option}
              onClick={() => pick(option)}
              disabled={answered}
              className={cn(
                'rounded-lg border py-3 text-xl font-medium tabular-nums transition-colors',
                answered && isAnswer
                  ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400'
                  : answered && option === picked
                    ? 'border-destructive/50 bg-destructive/5 text-destructive'
                    : answered
                      ? 'border-border text-muted-foreground opacity-50'
                      : 'border-border hover:bg-accent hover:border-accent-foreground/20',
              )}
            >
              {option}
            </button>
          )
        })}
      </div>

      {picked !== null && (
        <div className="space-y-3">
          <div className="flex flex-wrap justify-center gap-1.5">
            {splitSyllables(question.phrase.text).map((syllable, i) => (
              <span
                key={i}
                className="rounded-lg border border-border bg-card px-2.5 py-1 font-tibetan text-lg leading-[1.9]"
              >
                {syllable}
              </span>
            ))}
          </div>
          <p
            className={cn(
              'text-sm text-center',
              correct ? 'text-green-600 dark:text-green-400' : 'text-destructive',
            )}
          >
            {correct
              ? `Correct — ${question.answer} ${question.answer === 1 ? 'syllable' : 'syllables'}.`
              : `It is ${question.answer} — the pieces above. Count what sits between the ཚེག marks, not the marks themselves.`}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground tabular-nums">
          {score.right} / {score.asked} correct
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={next}
          disabled={picked === null}
          className="gap-1"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
