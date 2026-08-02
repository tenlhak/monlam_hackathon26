import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Volume2, Mic, Square } from 'lucide-react'
import {
  THEMED_VOCAB,
  VOCAB_CATEGORIES,
  LEVEL2_META,
  type VocabItem,
} from '@/lib/level2-data'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import { playTts } from '@/lib/tts'
import { startRecording, stopRecording } from '@/lib/wav-recorder'
import { recordAndCelebrate } from '@/lib/celebrate'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type Mode = 'learn' | 'quiz' | 'speak'

export function ThemedVocabularyView() {
  const [mode, setMode] = useState<Mode>('learn')

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="learn" className="flex-1 text-xs sm:text-sm">
              Learn
            </TabsTrigger>
            <TabsTrigger value="quiz" className="flex-1 text-xs sm:text-sm">
              Quiz
            </TabsTrigger>
            <TabsTrigger value="speak" className="flex-1 text-xs sm:text-sm">
              Speak
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <p className="text-sm text-muted-foreground text-center">
          {LEVEL2_META.vocab.title} — {LEVEL2_META.vocab.focus}
        </p>

        <Separator />

        {mode === 'learn' && <LearnPanel />}
        {mode === 'quiz' && <QuizPanel />}
        {mode === 'speak' && <SpeakPanel />}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────── Learn

function LearnPanel() {
  const [playing, setPlaying] = useState<string | null>(null)

  const speak = async (word: VocabItem) => {
    setPlaying(word.id)
    try {
      await playTts(word.text)
    } catch {
      // best-effort TTS
    } finally {
      setPlaying(null)
    }
  }

  return (
    <div className="space-y-5">
      {VOCAB_CATEGORIES.map((cat) => (
        <div key={cat.id} className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
            {cat.label}
          </p>
          <div className="space-y-2">
            {THEMED_VOCAB.filter((w) => w.category === cat.id).map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-tibetan text-2xl leading-[2]">{w.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.roman} — {w.en}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => speak(w)}
                  disabled={playing === w.id}
                  title="Hear it"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────── Quiz

interface Question {
  word: VocabItem
  options: VocabItem[]
}

function buildQuestions(): Question[] {
  return THEMED_VOCAB.map((word) => {
    const distractors = THEMED_VOCAB.filter(
      (w) => w.id !== word.id && w.category === word.category,
    )
    const pool = distractors.length >= 3 ? distractors : THEMED_VOCAB.filter((w) => w.id !== word.id)
    const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, 3)
    return { word, options: [...picked, word].sort(() => Math.random() - 0.5) }
  }).sort(() => Math.random() - 0.5)
}

function QuizPanel() {
  const questions = useMemo(buildQuestions, [])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState({ right: 0, asked: 0 })

  const q = questions[index]
  const correct = picked === q.word.id

  const pick = (id: string) => {
    if (picked) return
    setPicked(id)
    setScore((s) => ({ right: s.right + (id === q.word.id ? 1 : 0), asked: s.asked + 1 }))
    if (id === q.word.id) recordAndCelebrate(2, 1, q.word.id)
  }

  const next = () => {
    setIndex((i) => (i + 1) % questions.length)
    setPicked(null)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-6 text-center space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          which word means
        </p>
        <p className="text-xl font-medium">{q.word.en}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {q.options.map((option) => {
          const isAnswer = option.id === q.word.id
          return (
            <button
              key={option.id}
              onClick={() => pick(option.id)}
              disabled={!!picked}
              className={cn(
                'rounded-lg border py-3 font-tibetan text-2xl leading-[1.9] transition-colors',
                picked && isAnswer
                  ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400'
                  : picked && option.id === picked
                    ? 'border-destructive/50 bg-destructive/5 text-destructive'
                    : picked
                      ? 'border-border text-muted-foreground opacity-50'
                      : 'border-border hover:bg-accent hover:border-accent-foreground/20',
              )}
            >
              {option.text}
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
          {correct ? `Correct — ${q.word.roman}` : `That means ${q.word.en} (${q.word.roman})`}
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground tabular-nums">
          {score.right} / {score.asked} correct
        </span>
        <Button variant="outline" size="sm" onClick={next} disabled={!picked} className="gap-1">
          Next
          <ChevronRight className="h-4 w-4" />
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

  const word = THEMED_VOCAB[index]

  const go = (delta: number) => {
    setIndex((i) => (i + delta + THEMED_VOCAB.length) % THEMED_VOCAB.length)
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
      form.append('target', word.text)
      form.append('audio', wav, 'recording.wav')

      const res = await api.post<{ transcript: string; correct: boolean }>(
        '/api/practice/speak',
        form,
        { headers: { 'Content-Type': undefined } },
      )
      setResult({ type: 'done', ok: res.data.correct, heard: res.data.transcript })
      if (res.data.correct) recordAndCelebrate(2, 1, word.id)
    } catch {
      setResult({ type: 'done', ok: false, heard: 'could not check that' })
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <p className="font-tibetan text-5xl leading-[2.2]">{word.text}</p>
      <p className="text-base text-muted-foreground">
        {word.roman} — {word.en}
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
          {index + 1} / {THEMED_VOCAB.length}
        </span>
        <Button variant="ghost" size="icon" onClick={() => go(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
