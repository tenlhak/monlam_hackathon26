import { useMemo, useState } from 'react'
import { ChevronRight, Volume2 } from 'lucide-react'
import { VERBS, type Verb } from '@/lib/level2-data'
import { playTts } from '@/lib/tts'
import { recordAndCelebrate } from '@/lib/celebrate'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Mode = 'stems' | 'quiz'
type Tense = 'present' | 'past'

export function VerbsView() {
  const [mode, setMode] = useState<Mode>('stems')

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="stems" className="flex-1 text-xs sm:text-sm">
              Stems
            </TabsTrigger>
            <TabsTrigger value="quiz" className="flex-1 text-xs sm:text-sm">
              Quiz
            </TabsTrigger>
          </TabsList>
        </Tabs>


        {mode === 'stems' ? <StemsPanel /> : <QuizPanel />}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────── Stems

function StemsPanel() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)

  const speak = async (key: string, text: string) => {
    setPlaying(key)
    try {
      await playTts(text)
    } catch {
      // best-effort TTS
    } finally {
      setPlaying(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>Verb</span>
        <span className="text-center w-20">Present</span>
        <span className="text-center w-20">Past</span>
      </div>

      {VERBS.map((v) => {
        const open = openId === v.id
        return (
          <div key={v.id} className="rounded-xl border border-border bg-card">
            <button
              onClick={() => setOpenId(open ? null : v.id)}
              className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-x-3 p-3 text-left"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{v.en}</span>
                <span className="flex gap-1.5 mt-1">
                  {v.collapsed && (
                    <Badge
                      variant="outline"
                      className="h-auto py-0 text-[10px] font-normal text-muted-foreground"
                    >
                      collapsed
                    </Badge>
                  )}
                  {v.irregular && (
                    <Badge className="h-auto py-0 text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400">
                      irregular
                    </Badge>
                  )}
                </span>
              </span>
              <span className="w-20 text-center">
                <span className="block font-tibetan text-xl leading-[1.9]">
                  {v.present}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  {v.presentRoman}
                </span>
              </span>
              <span className="w-20 text-center">
                <span
                  className={cn(
                    'block font-tibetan text-xl leading-[1.9]',
                    v.collapsed && 'text-muted-foreground',
                  )}
                >
                  {v.past}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  {v.pastRoman}
                </span>
              </span>
            </button>

            {open && (
              <div className="border-t border-border px-3 py-2.5 space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => speak(`${v.id}-p`, v.present)}
                    disabled={playing === `${v.id}-p`}
                  >
                    <Volume2 className="h-3 w-3" />
                    Present
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => speak(`${v.id}-q`, v.past)}
                    disabled={playing === `${v.id}-q`}
                  >
                    <Volume2 className="h-3 w-3" />
                    Past
                  </Button>
                </div>
                {v.note && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {v.note}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      <p className="text-xs text-muted-foreground italic pt-1">
        Tap a verb for audio and notes. Two of these seven have collapsed stems —
        the written form does not change, and only the auxiliary marks tense.
      </p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────── Quiz

interface Question {
  verb: Verb
  tense: Tense
  options: string[]
}

/** One question per verb per tense, shuffled once per mount. */
function buildQuestions(): Question[] {
  const all: Question[] = []
  for (const verb of VERBS) {
    for (const tense of ['present', 'past'] as Tense[]) {
      const answer = tense === 'present' ? verb.present : verb.past
      const distractors = VERBS.filter((v) => v.id !== verb.id)
        .flatMap((v) => [v.present, v.past])
        .filter((t) => t !== answer)
      const picked = [...new Set(distractors)]
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
      all.push({
        verb,
        tense,
        options: [...picked, answer].sort(() => Math.random() - 0.5),
      })
    }
  }
  return all.sort(() => Math.random() - 0.5)
}

function QuizPanel() {
  const questions = useMemo(buildQuestions, [])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState({ right: 0, asked: 0 })

  const q = questions[index]
  const answer = q.tense === 'present' ? q.verb.present : q.verb.past
  const correct = picked === answer

  const pick = (option: string) => {
    if (picked) return
    setPicked(option)
    setScore((s) => ({
      right: s.right + (option === answer ? 1 : 0),
      asked: s.asked + 1,
    }))
    if (option === answer) recordAndCelebrate(2, 3, q.verb.en)
  }

  const next = () => {
    setIndex((i) => (i + 1) % questions.length)
    setPicked(null)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-6 text-center space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {q.tense} stem
        </p>
        <p className="text-xl font-medium">{q.verb.en}</p>
        {q.verb.collapsed && picked && (
          <p className="text-xs text-muted-foreground pt-1">
            Collapsed verb — both stems are the same form.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {q.options.map((option) => {
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

      {picked && (
        <p
          className={cn(
            'text-sm text-center',
            correct ? 'text-green-600 dark:text-green-400' : 'text-destructive',
          )}
        >
          {correct
            ? `Correct — ${q.tense === 'present' ? q.verb.presentRoman : q.verb.pastRoman}`
            : `The ${q.tense} stem is ${answer} (${q.tense === 'present' ? q.verb.presentRoman : q.verb.pastRoman})`}
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
