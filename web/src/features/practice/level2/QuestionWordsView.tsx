import { useState } from 'react'
import { ChevronLeft, ChevronRight, Volume2, Mic, Square } from 'lucide-react'
import {
  QUESTION_WORDS,
  QUESTION_GAPS,
  formFor,
  romanFor,
  type QuestionWord,
} from '@/lib/level2-data'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import { playTts } from '@/lib/tts'
import { startRecording, stopRecording } from '@/lib/wav-recorder'
import { recordAndCelebrate } from '@/lib/celebrate'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Mode = 'learn' | 'gap' | 'speak'

export function QuestionWordsView() {
  const [mode, setMode] = useState<Mode>('learn')

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="learn" className="flex-1 text-xs sm:text-sm">
              Learn
            </TabsTrigger>
            <TabsTrigger value="gap" className="flex-1 text-xs sm:text-sm">
              Gap-fill
            </TabsTrigger>
            <TabsTrigger value="speak" className="flex-1 text-xs sm:text-sm">
              Speak
            </TabsTrigger>
          </TabsList>
        </Tabs>


        {mode === 'learn' && <LearnPanel />}
        {mode === 'gap' && <GapPanel />}
        {mode === 'speak' && <SpeakPanel />}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────── Learn

function LearnPanel() {
  const [playing, setPlaying] = useState<string | null>(null)

  const speak = async (word: QuestionWord) => {
    setPlaying(word.id)
    try {
      await playTts(formFor(word, 'spoken'))
    } catch {
      // best-effort TTS
    } finally {
      setPlaying(null)
    }
  }

  return (
    <div className="space-y-2">
      {QUESTION_WORDS.map((w) => (
        <div
          key={w.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
        >
          <div className="flex-1 min-w-0">
            <p className="font-tibetan text-2xl leading-[2]">{w.text}</p>
            <p className="text-xs text-muted-foreground">
              {w.roman} — {w.en}
            </p>
            {w.spoken && (
              <p className="text-xs text-muted-foreground mt-1">
                spoken:{' '}
                <span className="font-tibetan text-sm">{w.spoken}</span>{' '}
                <span className="text-muted-foreground/70">
                  ({w.spokenRoman})
                </span>
              </p>
            )}
          </div>
          {w.spoken && (
            <Badge variant="outline" className="h-auto py-0.5 font-normal text-muted-foreground">
              literary
            </Badge>
          )}
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => speak(w)}
            disabled={playing === w.id}
            title="Hear the spoken form"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <p className="text-xs text-muted-foreground italic pt-1">
        Literary forms are what you read; spoken forms are what you hear. The
        audio plays the spoken one.
      </p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────── Gap-fill

function GapPanel() {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)

  const gap = QUESTION_GAPS[index]
  const answer = QUESTION_WORDS.find((w) => w.id === gap.answerId)!
  const filled = gap.before + formFor(answer, gap.register) + gap.after

  const go = (delta: number) => {
    setIndex((i) => (i + delta + QUESTION_GAPS.length) % QUESTION_GAPS.length)
    setPicked(null)
  }

  const pick = async (id: string) => {
    if (picked) return
    setPicked(id)
    if (id === gap.answerId) {
      recordAndCelebrate(2, 2, gap.answerId)
      setPlaying(true)
      try {
        await playTts(filled)
      } catch {
        // best-effort TTS
      } finally {
        setPlaying(false)
      }
    }
  }

  const correct = picked === gap.answerId

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-6 text-center">
        <p className="font-tibetan text-2xl leading-[2.2]">
          {gap.before}
          <span
            className={cn(
              'mx-1 rounded px-2',
              picked
                ? correct
                  ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                  : 'bg-destructive/10 text-destructive'
                : 'bg-foreground/10 text-muted-foreground',
            )}
          >
            {picked ? formFor(QUESTION_WORDS.find((w) => w.id === picked)!, gap.register) : '⎯⎯'}
          </span>
          {gap.after}
        </p>
        <p className="text-sm text-muted-foreground mt-3">{gap.en}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {QUESTION_WORDS.map((w) => {
          const isAnswer = w.id === gap.answerId
          return (
            <button
              key={w.id}
              onClick={() => pick(w.id)}
              disabled={!!picked}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2.5 transition-colors',
                picked && isAnswer
                  ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400'
                  : picked && w.id === picked
                    ? 'border-destructive/50 bg-destructive/5 text-destructive'
                    : picked
                      ? 'border-border text-muted-foreground opacity-50'
                      : 'border-border hover:bg-accent hover:border-accent-foreground/20',
              )}
            >
              <span className="font-tibetan text-lg leading-[1.8]">
                {formFor(w, gap.register)}
              </span>
              <span className="text-[10px] text-muted-foreground leading-none">
                {w.en}
              </span>
            </button>
          )
        })}
      </div>

      {picked && (
        <p
          className={cn(
            'text-sm text-center',
            correct ? 'text-green-600 dark:text-green-400' : 'text-destructive',
          )}
        >
          {correct
            ? `Correct — ${romanFor(answer, gap.register)} (${answer.en})`
            : `Not quite — this gap wants ${answer.en}.`}
          {playing && ' · playing…'}
        </p>
      )}

      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => go(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {index + 1} / {QUESTION_GAPS.length}
        </span>
        <Button variant="ghost" size="icon" onClick={() => go(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────── Speak

function SpeakPanel() {
  const { user } = useAuth()
  const [index, setIndex] = useState(0)
  const [recording, setRecording] = useState(false)
  const [result, setResult] = useState<
    { type: 'idle' } | { type: 'checking' } | { type: 'done'; ok: boolean; heard: string }
  >({ type: 'idle' })

  const word = QUESTION_WORDS[index]
  const target = formFor(word, 'spoken')

  const go = (delta: number) => {
    setIndex((i) => (i + delta + QUESTION_WORDS.length) % QUESTION_WORDS.length)
    setResult({ type: 'idle' })
  }

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
      form.append('target', target)
      form.append('audio', wav, 'recording.wav')

      // Content-Type must be unset so the browser adds the multipart boundary;
      // the api instance defaults it to application/json.
      const res = await api.post<{ transcript: string; correct: boolean }>(
        '/api/practice/speak',
        form,
        { headers: { 'Content-Type': undefined } },
      )
      setResult({ type: 'done', ok: res.data.correct, heard: res.data.transcript })
      if (res.data.correct) recordAndCelebrate(2, 2, word.id)
    } catch {
      setResult({ type: 'done', ok: false, heard: 'could not check that' })
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <p className="font-tibetan text-5xl leading-[2.2]">{target}</p>
      <p className="text-base text-muted-foreground">
        {romanFor(word, 'spoken')} — {word.en}
      </p>

      <Button
        onClick={handleSpeak}
        disabled={result.type === 'checking'}
        variant={recording ? 'destructive' : 'outline'}
        className="gap-2 mt-2"
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

      {result.type === 'done' && (
        <p
          className={cn(
            'text-sm',
            result.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive',
          )}
        >
          {result.ok
            ? `Correct — I heard "${result.heard}"`
            : `I heard "${result.heard || 'nothing'}" — try again`}
        </p>
      )}

      <div className="flex items-center justify-center gap-4 pt-1">
        <Button variant="ghost" size="icon" onClick={() => go(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {index + 1} / {QUESTION_WORDS.length}
        </span>
        <Button variant="ghost" size="icon" onClick={() => go(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
