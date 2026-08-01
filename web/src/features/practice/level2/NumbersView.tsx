import { useCallback, useEffect, useMemo, useState } from 'react'
import { Delete, Mic, Play, Square, Volume2 } from 'lucide-react'
import { LEVEL2_META } from '@/lib/level2-data'
import {
  DIGITS,
  TENS,
  NUMERALS,
  toTibetanDigits,
  type Numeral,
} from '@/lib/numerals'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import { playTts } from '@/lib/tts'
import { startRecording, stopRecording } from '@/lib/wav-recorder'
import { recordAndCelebrate } from '@/lib/celebrate'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type Mode = 'digits' | 'write' | 'read'

export function NumbersView() {
  const [mode, setMode] = useState<Mode>('digits')

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="digits" className="flex-1 text-xs sm:text-sm">
              Digits
            </TabsTrigger>
            <TabsTrigger value="write" className="flex-1 text-xs sm:text-sm">
              Hear → write
            </TabsTrigger>
            <TabsTrigger value="read" className="flex-1 text-xs sm:text-sm">
              Read aloud
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <p className="text-sm text-muted-foreground text-center">
          {LEVEL2_META.numbers.title} — {LEVEL2_META.numbers.focus}
        </p>

        <Separator />

        {mode === 'digits' && <DigitsPanel />}
        {mode === 'write' && <WritePanel />}
        {mode === 'read' && <ReadPanel />}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────── Digits

function DigitsPanel() {
  const [playing, setPlaying] = useState<number | null>(null)

  const speak = async (n: Numeral) => {
    setPlaying(n.value)
    try {
      await playTts(n.word)
      recordAndCelebrate(2, 4, String(n.value))
    } catch {
      // best-effort TTS
    } finally {
      setPlaying(null)
    }
  }

  const cell = (n: Numeral) => (
    <button
      key={n.value}
      onClick={() => speak(n)}
      disabled={playing === n.value}
      className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-1 py-2.5 transition-colors hover:bg-accent disabled:opacity-60"
    >
      <span className="font-tibetan text-2xl leading-[1.8]">{n.digits}</span>
      <span className="font-tibetan text-xs leading-[1.8] text-muted-foreground">
        {n.word}
      </span>
      <span className="text-[10px] leading-none text-muted-foreground/80">
        {n.roman} · {n.value}
      </span>
    </button>
  )

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Digits ༠–༩
        </p>
        <div className="grid grid-cols-5 gap-2">{DIGITS.map(cell)}</div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Tens and hundred
        </p>
        <div className="grid grid-cols-5 gap-2">{TENS.map(cell)}</div>
      </div>

      <p className="text-xs text-muted-foreground italic">
        Tap any number to hear it. Tibetan digits are written left to right, the
        same order as Arabic numerals.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────── Hear → write

/** Random number from the pool, never the same one twice in a row. */
function useRandomNumeral() {
  const [current, setCurrent] = useState<Numeral>(
    () => NUMERALS[Math.floor(Math.random() * NUMERALS.length)],
  )
  const shuffle = useCallback(() => {
    setCurrent((prev) => {
      let next = prev
      while (next.value === prev.value) {
        next = NUMERALS[Math.floor(Math.random() * NUMERALS.length)]
      }
      return next
    })
  }, [])
  return [current, shuffle] as const
}

function WritePanel() {
  const [target, shuffle] = useRandomNumeral()
  const [entry, setEntry] = useState('')
  const [checked, setChecked] = useState(false)
  const [playing, setPlaying] = useState(false)

  const expected = useMemo(() => toTibetanDigits(target.value), [target])
  const correct = entry === expected

  // Playback is button-driven: browsers block audio without a user gesture, so
  // the number cannot announce itself when it changes.
  const say = useCallback(async () => {
    setPlaying(true)
    try {
      await playTts(target.word)
    } catch {
      // best-effort TTS
    } finally {
      setPlaying(false)
    }
  }, [target])

  useEffect(() => {
    setEntry('')
    setChecked(false)
  }, [target])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Listen, then write the number in Tibetan digits.
        </p>
        <Button variant="outline" onClick={say} disabled={playing} className="gap-2">
          <Play className="h-4 w-4" />
          {playing ? 'Playing…' : 'Play number'}
        </Button>

        <p
          className={cn(
            'font-tibetan text-4xl leading-[1.9] min-h-[3rem]',
            checked && (correct ? 'text-green-600 dark:text-green-400' : 'text-destructive'),
          )}
        >
          {entry || <span className="text-muted-foreground/40">⎯</span>}
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {DIGITS.map((d) => (
          <button
            key={d.value}
            onClick={() => {
              setEntry((e) => e + d.digits)
              setChecked(false)
            }}
            className="rounded-lg border border-border py-2.5 font-tibetan text-2xl leading-[1.8] transition-colors hover:bg-accent"
          >
            {d.digits}
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
            if (entry === expected) recordAndCelebrate(2, 4, String(target.value))
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
            {correct ? (
              <>
                Correct — <span className="font-tibetan">{target.word}</span> (
                {target.roman}) = {target.value}
              </>
            ) : (
              <>
                Not quite — that was{' '}
                <span className="font-tibetan">{expected}</span> ({target.roman},{' '}
                {target.value})
              </>
            )}
          </p>
          <Button variant="outline" size="sm" onClick={shuffle}>
            Next number
          </Button>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────── Read aloud

function ReadPanel() {
  const { user } = useAuth()
  const [target, shuffle] = useRandomNumeral()
  const [recording, setRecording] = useState(false)
  const [result, setResult] = useState<
    { type: 'idle' } | { type: 'checking' } | { type: 'done'; ok: boolean; heard: string }
  >({ type: 'idle' })
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    setResult({ type: 'idle' })
  }, [target])

  const handleSpeak = async () => {
    if (!user) return

    if (!recording) {
      try {
        await startRecording()
        setRecording(true)
        setResult({ type: 'idle' })
      } catch {
        setResult({ type: 'done', ok: false, heard: 'no microphone access' })
      }
      return
    }

    setRecording(false)
    setResult({ type: 'checking' })
    const wav = stopRecording()

    try {
      const form = new FormData()
      form.append('user_id', String(user.id))
      form.append('target', target.word)
      form.append('audio', wav, 'recording.wav')

      // Content-Type must be unset so the browser adds the multipart boundary.
      const res = await api.post<{ transcript: string; correct: boolean }>(
        '/api/practice/speak',
        form,
        { headers: { 'Content-Type': undefined } },
      )
      setResult({ type: 'done', ok: res.data.correct, heard: res.data.transcript })
      if (res.data.correct) recordAndCelebrate(2, 4, String(target.value))
    } catch {
      setResult({ type: 'done', ok: false, heard: 'could not check that' })
    }
  }

  const reveal = async () => {
    setPlaying(true)
    try {
      await playTts(target.word)
    } catch {
      // best-effort TTS
    } finally {
      setPlaying(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-8 text-center space-y-2">
        <p className="font-tibetan text-6xl leading-[1.7]">{target.digits}</p>
        <p className="text-sm text-muted-foreground">Say this number aloud</p>
      </div>

      <div className="flex justify-center gap-2">
        <Button
          onClick={handleSpeak}
          disabled={result.type === 'checking'}
          variant={recording ? 'destructive' : 'outline'}
          className="gap-2"
        >
          {recording ? (
            <>
              <Square className="h-4 w-4" />
              Stop
            </>
          ) : result.type === 'checking' ? (
            'Checking…'
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Record
            </>
          )}
        </Button>
        <Button variant="secondary" onClick={reveal} disabled={playing} className="gap-2">
          <Volume2 className="h-4 w-4" />
          Hear it
        </Button>
      </div>

      {result.type === 'done' && (
        <div className="space-y-3 text-center">
          <p
            className={cn(
              'text-sm',
              result.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive',
            )}
          >
            {result.ok
              ? `Correct — I heard "${result.heard}"`
              : `I heard "${result.heard || 'nothing'}" — the number is ${target.word} (${target.roman})`}
          </p>
          <Button variant="outline" size="sm" onClick={shuffle}>
            Next number
          </Button>
        </div>
      )}
    </div>
  )
}
