import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Volume2, Mic, Square } from 'lucide-react'
import {
  CASES,
  FINAL_RULES,
  CASE_WORDS,
  ABLATIVE_ITEMS,
  SPEAK_SENTENCES,
  particleFor,
  type ConditionedCase,
  type CaseWord,
} from '@/lib/level3-data'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import { playTts } from '@/lib/tts'
import { startRecording, stopRecording } from '@/lib/wav-recorder'
import { recordAndCelebrate } from '@/lib/celebrate'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Mode = 'rules' | 'examples' | 'particles' | 'speak'

export function EightCasesView() {
  const [mode, setMode] = useState<Mode>('rules')

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="rules" className="flex-1 text-xs sm:text-sm">
              Rules
            </TabsTrigger>
            <TabsTrigger value="examples" className="flex-1 text-xs sm:text-sm">
              Examples
            </TabsTrigger>
            <TabsTrigger value="particles" className="flex-1 text-xs sm:text-sm">
              Particles
            </TabsTrigger>
            <TabsTrigger value="speak" className="flex-1 text-xs sm:text-sm">
              Speak
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === 'rules' && <RulesPanel />}
        {mode === 'examples' && <ExamplesPanel />}
        {mode === 'particles' && <ParticlesPanel />}
        {mode === 'speak' && <SpeakPanel />}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────── Rules

function RulesPanel() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {CASES.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {c.number}
              </span>
              <p className="font-medium text-sm">{c.name}</p>
              <span className="font-tibetan text-sm text-muted-foreground">
                {c.tibetanName}
              </span>
              {c.conditioned && (
                <Badge className="h-auto py-0 text-[10px] bg-primary/10 text-primary">
                  suffix-conditioned
                </Badge>
              )}
            </div>
            <p className="font-tibetan text-lg leading-[1.9] mt-1">
              {c.particles.join('  ·  ')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.function}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
          Which form — by the final letter
        </p>
        <p className="text-xs text-muted-foreground px-0.5">
          The preceding syllable's last letter picks the form, not the meaning.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium px-3 py-2">Final</th>
                <th className="text-center font-medium px-2 py-2">Genitive</th>
                <th className="text-center font-medium px-2 py-2">Agentive</th>
                <th className="text-center font-medium px-2 py-2">La-don</th>
              </tr>
            </thead>
            <tbody>
              {FINAL_RULES.map((r) => (
                <tr key={r.group} className="border-t border-border">
                  <td className="px-3 py-2 font-tibetan text-base">{r.label}</td>
                  <td className="px-2 py-2 text-center font-tibetan text-lg">{r.genitive}</td>
                  <td className="px-2 py-2 text-center font-tibetan text-lg">{r.agentive}</td>
                  <td className="px-2 py-2 text-center font-tibetan text-lg">{r.dative}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground italic px-0.5">
          Ablative is the exception: ནས for a real starting point, ལས for a
          comparison — meaning, not spelling.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────── Examples

function ExamplesPanel() {
  const [playing, setPlaying] = useState<string | null>(null)

  const speak = async (id: string, text: string) => {
    setPlaying(id)
    try {
      await playTts(text)
    } catch {
      // best-effort TTS
    } finally {
      setPlaying(null)
    }
  }

  return (
    <div className="space-y-2.5">
      {SPEAK_SENTENCES.map((s) => {
        const c = CASES.find((k) => k.id === s.caseId)!
        return (
          <div key={s.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="h-auto py-0.5 font-normal text-muted-foreground">
                {c.number}. {c.name}
              </Badge>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => speak(s.id, s.text)}
                disabled={playing === s.id}
              >
                <Volume2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="font-tibetan text-xl leading-[1.9] mt-1.5">{s.text}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {s.roman} — {s.en}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────── Particles

type Combo =
  | { kind: 'conditioned'; key: string; word: CaseWord; kase: ConditionedCase }
  | { kind: 'ablative'; key: string; item: (typeof ABLATIVE_ITEMS)[number] }

function buildCombos(): Combo[] {
  const conditioned: Combo[] = CASE_WORDS.flatMap((word) =>
    (['genitive', 'agentive', 'dative'] as ConditionedCase[]).map((kase) => ({
      kind: 'conditioned' as const,
      key: `${word.id}-${kase}`,
      word,
      kase,
    })),
  )
  const ablative: Combo[] = ABLATIVE_ITEMS.map((item) => ({
    kind: 'ablative' as const,
    key: item.id,
    item,
  }))
  return [...conditioned, ...ablative].sort(() => Math.random() - 0.5)
}

const CASE_LABEL: Record<ConditionedCase, string> = {
  genitive: 'Genitive',
  agentive: 'Agentive',
  dative: 'La-don',
}

function ParticlesPanel() {
  const combos = useMemo(buildCombos, [])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState({ right: 0, asked: 0 })

  const combo = combos[index]

  const answer =
    combo.kind === 'conditioned' ? particleFor(combo.word, combo.kase) : combo.item.answer

  const options = useMemo(() => {
    if (combo.kind === 'ablative') return ['ནས', 'ལས']
    const key = combo.kase
    const forms = FINAL_RULES.map((r) => r[key])
    return [...new Set(forms)]
  }, [combo])

  const pick = (option: string) => {
    if (picked) return
    setPicked(option)
    setScore((s) => ({ right: s.right + (option === answer ? 1 : 0), asked: s.asked + 1 }))
    if (option === answer) recordAndCelebrate(3, 1, combo.key)
  }

  const next = () => {
    setIndex((i) => (i + 1) % combos.length)
    setPicked(null)
  }

  const correct = picked === answer

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-6 text-center space-y-1">
        {combo.kind === 'conditioned' ? (
          <>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {CASE_LABEL[combo.kase]} · final {combo.word.final}
            </p>
            <p className="font-tibetan text-2xl leading-[2]">
              {combo.word.text}
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
                {picked ?? '⎯⎯'}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {combo.word.roman} + {CASE_LABEL[combo.kase].toLowerCase()} — {combo.word.en}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Ablative</p>
            <p className="font-tibetan text-2xl leading-[2]">
              {combo.item.before}
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
                {picked ?? '⎯⎯'}
              </span>
              {combo.item.after}
            </p>
            <p className="text-sm text-muted-foreground">{combo.item.en}</p>
          </>
        )}
      </div>

      <div className={cn('grid gap-2', options.length > 2 ? 'grid-cols-3' : 'grid-cols-2')}>
        {options.map((option) => {
          const isAnswer = option === answer
          return (
            <button
              key={option}
              onClick={() => pick(option)}
              disabled={!!picked}
              className={cn(
                'rounded-lg border py-3 font-tibetan text-2xl leading-[1.9] transition-colors',
                picked && isAnswer
                  ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400'
                  : picked && option === picked
                    ? 'border-destructive/50 bg-destructive/5 text-destructive'
                    : picked
                      ? 'border-border text-muted-foreground opacity-50'
                      : 'border-border hover:bg-accent hover:border-accent-foreground/20',
              )}
            >
              {option}
            </button>
          )
        })}
      </div>

      {picked && !correct && (
        <p className="text-sm text-center text-destructive">
          {combo.kind === 'conditioned'
            ? `${combo.word.text} ends in ${combo.word.final} — that takes ${answer}.`
            : combo.item.hint}
        </p>
      )}
      {picked && correct && combo.kind === 'ablative' && (
        <p className="text-sm text-center text-green-600 dark:text-green-400">
          {combo.item.hint}
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

  const s = SPEAK_SENTENCES[index]
  const c = CASES.find((k) => k.id === s.caseId)!

  const go = (delta: number) => {
    setIndex((i) => (i + delta + SPEAK_SENTENCES.length) % SPEAK_SENTENCES.length)
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
      form.append('target', s.text)
      form.append('audio', wav, 'recording.wav')

      const res = await api.post<{ transcript: string; correct: boolean }>(
        '/api/practice/speak',
        form,
        { headers: { 'Content-Type': undefined } },
      )
      setResult({ type: 'done', ok: res.data.correct, heard: res.data.transcript })
      if (res.data.correct) recordAndCelebrate(3, 1, s.id)
    } catch {
      setResult({ type: 'done', ok: false, heard: 'could not check that' })
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {c.number}. {c.name} case
      </p>
      <p className="font-tibetan text-3xl text-center leading-[1.9] max-w-sm">{s.text}</p>
      <p className="text-base text-muted-foreground text-center">
        {s.roman} — {s.en}
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
          {index + 1} / {SPEAK_SENTENCES.length}
        </span>
        <Button variant="ghost" size="icon" onClick={() => go(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
