import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Volume2, Mic, Square } from 'lucide-react'
import { DIALOGUES, type DialogueLine } from '@/lib/level2-data'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import { playTts } from '@/lib/tts'
import { startRecording, stopRecording } from '@/lib/wav-recorder'
import { recordAndCelebrate } from '@/lib/celebrate'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type Mode = 'read' | 'speak'

export function SimpleDialoguesView() {
  const [mode, setMode] = useState<Mode>('read')

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="read" className="flex-1 text-xs sm:text-sm">
              Read
            </TabsTrigger>
            <TabsTrigger value="speak" className="flex-1 text-xs sm:text-sm">
              Speak
            </TabsTrigger>
          </TabsList>
        </Tabs>


        {mode === 'read' ? <ReadPanel /> : <SpeakPanel />}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────── Read

function ReadPanel() {
  const [dialogueIndex, setDialogueIndex] = useState(0)
  const [playing, setPlaying] = useState<number | null>(null)
  const dialogue = DIALOGUES[dialogueIndex]

  const speak = async (i: number, line: DialogueLine) => {
    setPlaying(i)
    try {
      await playTts(line.text)
    } catch {
      // best-effort TTS
    } finally {
      setPlaying(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 justify-center">
        {DIALOGUES.map((d, i) => (
          <button
            key={d.id}
            onClick={() => setDialogueIndex(i)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
              i === dialogueIndex
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {d.title}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {dialogue.lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              'flex items-start gap-3 rounded-xl border border-border bg-card p-3',
              line.speaker === 'B' && 'flex-row-reverse text-right',
            )}
          >
            <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
              {line.speaker}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-tibetan text-xl leading-[1.9]">{line.text}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {line.roman} — {line.en}
              </p>
            </div>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => speak(i, line)}
              disabled={playing === i}
              title="Hear this line"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────── Speak

interface FlatLine {
  key: string
  dialogueTitle: string
  line: DialogueLine
}

function flattenLines(): FlatLine[] {
  return DIALOGUES.flatMap((d) =>
    d.lines.map((line, i) => ({ key: `${d.id}.${i}`, dialogueTitle: d.title, line })),
  )
}

function SpeakPanel() {
  const { user } = useAuth()
  const lines = useMemo(flattenLines, [])
  const [index, setIndex] = useState(0)
  const [recording, setRecording] = useState(false)
  const [result, setResult] = useState<
    { type: 'idle' } | { type: 'checking' } | { type: 'done'; ok: boolean; heard: string }
  >({ type: 'idle' })

  const item = lines[index]

  const go = (delta: number) => {
    setIndex((i) => (i + delta + lines.length) % lines.length)
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
      form.append('target', item.line.text)
      form.append('audio', wav, 'recording.wav')

      const res = await api.post<{ transcript: string; correct: boolean }>(
        '/api/practice/speak',
        form,
        { headers: { 'Content-Type': undefined } },
      )
      setResult({ type: 'done', ok: res.data.correct, heard: res.data.transcript })
      if (res.data.correct) recordAndCelebrate(2, 5, item.key)
    } catch {
      setResult({ type: 'done', ok: false, heard: 'could not check that' })
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {item.dialogueTitle} · speaker {item.line.speaker}
      </p>
      <p className="font-tibetan text-3xl text-center leading-[1.9] max-w-sm">
        {item.line.text}
      </p>
      <p className="text-base text-muted-foreground text-center">
        {item.line.roman} — {item.line.en}
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
          {index + 1} / {lines.length}
        </span>
        <Button variant="ghost" size="icon" onClick={() => go(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
