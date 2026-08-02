import { useCallback, useMemo, useState } from 'react'
import { Delete, Volume2 } from 'lucide-react'
import {
  DIGITS,
  READING_NUMBERS,
  toTibetanDigits,
  type Numeral,
} from '@/lib/numerals'
import { playTts } from '@/lib/tts'
import { recordAndCelebrate } from '@/lib/celebrate'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type Mode = 'digits' | 'match' | 'read'

/**
 * Level 1 reads numerals; Level 2 §4 hears and says them. Nothing here uses
 * the microphone — this section is still part of the script phase.
 */
export function NumeralsView() {
  const [mode, setMode] = useState<Mode>('digits')

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="digits" className="flex-1 text-xs sm:text-sm">
              Digits
            </TabsTrigger>
            <TabsTrigger value="match" className="flex-1 text-xs sm:text-sm">
              Match
            </TabsTrigger>
            <TabsTrigger value="read" className="flex-1 text-xs sm:text-sm">
              Read
            </TabsTrigger>
          </TabsList>
        </Tabs>


        {mode === 'digits' && <DigitsPanel />}
        {mode === 'match' && <MatchPanel />}
        {mode === 'read' && <ReadPanel />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────── Digits

function DigitsPanel() {
  const [playing, setPlaying] = useState<number | null>(null)

  const speak = async (numeral: Numeral) => {
    setPlaying(numeral.value)
    try {
      await playTts(numeral.word)
      recordAndCelebrate(1, 5, String(numeral.value))
    } catch {
      // best-effort TTS
    } finally {
      setPlaying(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2">
        {DIGITS.map((digit) => (
          <button
            key={digit.value}
            onClick={() => speak(digit)}
            disabled={playing === digit.value}
            className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-1 py-3 transition-colors hover:bg-accent disabled:opacity-60"
          >
            <span className="font-tibetan text-3xl leading-[1.7]">
              {digit.digits}
            </span>
            <span className="text-lg font-medium tabular-nums">{digit.value}</span>
            <span className="font-tibetan text-xs leading-[1.8] text-muted-foreground">
              {digit.word}
            </span>
          </button>
        ))}
      </div>

      <p className="text-xs leading-[1.9] text-muted-foreground italic">
        Tibetan digits run left to right, the same direction as Arabic ones, so
        ༢༤༧ is 247 — no reordering. Tap any digit to hear its name.
      </p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────── Match

const PAIRS_PER_ROUND = 5

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

function MatchPanel() {
  const [round, setRound] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [matched, setMatched] = useState<number[]>([])
  const [wrong, setWrong] = useState<number | null>(null)

  // `round` re-rolls the board; the two columns are shuffled independently so
  // matching position to position never works.
  const { tibetan, arabic } = useMemo(() => {
    const chosen = shuffle(DIGITS).slice(0, PAIRS_PER_ROUND)
    return { tibetan: shuffle(chosen), arabic: shuffle(chosen) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  const done = matched.length === PAIRS_PER_ROUND

  const nextRound = useCallback(() => {
    setRound((r) => r + 1)
    setPicked(null)
    setMatched([])
    setWrong(null)
  }, [])

  const pickArabic = (value: number) => {
    if (picked === null || matched.includes(value)) return
    if (value === picked) {
      setMatched((m) => [...m, value])
      setPicked(null)
      setWrong(null)
      recordAndCelebrate(1, 5, String(value))
    } else {
      setWrong(value)
      window.setTimeout(() => setWrong(null), 600)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-center text-muted-foreground">
        Tap a Tibetan digit, then its Arabic value.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {tibetan.map((digit) => {
            const isMatched = matched.includes(digit.value)
            const isPicked = picked === digit.value
            return (
              <button
                key={digit.value}
                onClick={() => !isMatched && setPicked(digit.value)}
                disabled={isMatched}
                className={cn(
                  'w-full rounded-lg border py-3 font-tibetan text-3xl leading-[1.7] transition-colors',
                  isMatched
                    ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400'
                    : isPicked
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-accent',
                )}
              >
                {digit.digits}
              </button>
            )
          })}
        </div>

        <div className="space-y-2">
          {arabic.map((digit) => {
            const isMatched = matched.includes(digit.value)
            const isWrong = wrong === digit.value
            return (
              <button
                key={digit.value}
                onClick={() => pickArabic(digit.value)}
                disabled={isMatched || picked === null}
                className={cn(
                  'w-full rounded-lg border py-3 text-2xl font-medium tabular-nums transition-colors',
                  isMatched
                    ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400'
                    : isWrong
                      ? 'border-destructive/50 bg-destructive/5 text-destructive'
                      : picked === null
                        ? 'border-border opacity-50'
                        : 'border-border hover:bg-accent',
                )}
              >
                {digit.value}
              </button>
            )
          })}
        </div>
      </div>

      {done ? (
        <div className="space-y-2 text-center">
          <p className="text-sm text-green-600 dark:text-green-400">
            All {PAIRS_PER_ROUND} matched.
          </p>
          <Button variant="outline" size="sm" onClick={nextRound}>
            New round
          </Button>
        </div>
      ) : (
        <p className="text-xs text-center text-muted-foreground tabular-nums">
          {matched.length} / {PAIRS_PER_ROUND} matched
        </p>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────── Read

function ReadPanel() {
  const [target, setTarget] = useState(
    () => READING_NUMBERS[Math.floor(Math.random() * READING_NUMBERS.length)],
  )
  const [entry, setEntry] = useState('')
  const [checked, setChecked] = useState(false)
  const [playing, setPlaying] = useState(false)

  const tibetan = useMemo(() => toTibetanDigits(target), [target])
  const correct = Number(entry) === target && entry !== ''

  const nextNumber = () => {
    setTarget((prev) => {
      let next = prev
      while (next === prev) {
        next = READING_NUMBERS[Math.floor(Math.random() * READING_NUMBERS.length)]
      }
      return next
    })
    setEntry('')
    setChecked(false)
  }

  // Reading is the point here, so the audio is a reveal after answering
  // rather than the prompt — Level 2 §4 runs the ear-first version.
  const reveal = async () => {
    setPlaying(true)
    try {
      await playTts(tibetan)
    } catch {
      // best-effort TTS
    } finally {
      setPlaying(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-8 text-center space-y-2">
        <p className="font-tibetan text-6xl leading-[1.6]">{tibetan}</p>
        <p className="text-sm text-muted-foreground">
          Write this number in Arabic digits
        </p>
      </div>

      <p
        className={cn(
          'text-center text-4xl font-medium tabular-nums min-h-[3rem]',
          checked && (correct ? 'text-green-600 dark:text-green-400' : 'text-destructive'),
        )}
      >
        {entry || <span className="text-muted-foreground/40">—</span>}
      </p>

      <div className="grid grid-cols-5 gap-2">
        {DIGITS.map((digit) => (
          <button
            key={digit.value}
            onClick={() => {
              setEntry((e) => (e.length < 4 ? e + digit.value : e))
              setChecked(false)
            }}
            className="rounded-lg border border-border py-2.5 text-xl font-medium tabular-nums transition-colors hover:bg-accent"
          >
            {digit.value}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            setEntry((e) => e.slice(0, -1))
            setChecked(false)
          }}
          disabled={!entry}
        >
          <Delete className="h-4 w-4" />
          Delete
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            setChecked(true)
            if (Number(entry) === target) {
              // Reading a multi-digit number proves each digit in it.
              new Set(String(target)).forEach((d) => recordAndCelebrate(1, 5, d))
            }
          }}
          disabled={!entry || checked}
        >
          Check
        </Button>
      </div>

      {checked && (
        <div className="space-y-3 text-center">
          <p
            className={cn(
              'text-sm',
              correct ? 'text-green-600 dark:text-green-400' : 'text-destructive',
            )}
          >
            {correct
              ? `Correct — ${tibetan} is ${target}.`
              : `Not quite — ${tibetan} is ${target}. Read the digits left to right.`}
          </p>
          <div className="flex justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={reveal}
              disabled={playing}
              className="gap-2"
            >
              <Volume2 className="h-3.5 w-3.5" />
              Hear it
            </Button>
            <Button variant="outline" size="sm" onClick={nextNumber}>
              Next number
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
