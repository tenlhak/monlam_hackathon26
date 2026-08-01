import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  Minus,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface Phase {
  id: string
  label: string
}

type SourceStatus = 'pending' | 'ok' | 'unchanged' | 'error'

interface SourceState {
  name: string
  status: SourceStatus
  items: number
}

interface RunEvent {
  type: 'plan' | 'phase' | 'source' | 'metrics' | 'stage' | 'log' | 'error' | 'done'
  // plan
  phases?: Phase[]
  sources?: string[]
  // phase
  phase?: string
  // source
  name?: string
  status?: SourceStatus
  items?: number
  // metrics
  metrics?: Record<string, number>
  // log / error / stage
  message?: string
  // done
  issue_id?: string
  spend?: { cost?: number; calls?: number }
  error?: string
}

/** Crawl the sources, then compose a fresh issue.
 *
 * Shows the pipeline working rather than a log dump: which outlet is being
 * read, which stage the run is in, and what it has found. The server emits
 * structured events for exactly this — parsing the human-readable log to
 * recover that would break the first time someone reworded a message.
 *
 * The password gate is enforced server-side; the prompt here only decides
 * whether to ask. The real check is the 401 handling below.
 */
export function RunAgentButton() {
  const qc = useQueryClient()
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const [phases, setPhases] = useState<Phase[]>([])
  const [currentPhase, setCurrentPhase] = useState<string | null>(null)
  const [sources, setSources] = useState<SourceState[]>([])
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null)

  const [log, setLog] = useState<string[]>([])
  const [showLog, setShowLog] = useState(false)

  const [promptOpen, setPromptOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const percent = useMemo(() => {
    if (finished) return 100
    if (phases.length === 0) return 0
    const i = phases.findIndex((p) => p.id === currentPhase)
    if (i < 0) return 0
    // Reading sources is the long stage, so it advances with each outlet that
    // lands instead of sitting still while eight feeds are fetched.
    let within = 0
    if (currentPhase === 'poll' && sources.length > 0) {
      within = sources.filter((s) => s.status !== 'pending').length / sources.length
    }
    return Math.min(100, ((i + within) / phases.length) * 100)
  }, [finished, phases, currentPhase, sources])

  const reset = () => {
    setPhases([])
    setCurrentPhase(null)
    setSources([])
    setMetrics(null)
    setLog([])
    setFinished(null)
    setFailed(null)
  }

  const run = useCallback(
    async (pw: string) => {
      setRunning(true)
      setPasswordError(null)
      reset()

      try {
        const resp = await fetch('/api/watch/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pw, crawl: true, compose: true, use_gdelt: false }),
        })

        if (resp.status === 401) {
          setPasswordError('Incorrect password')
          return
        }
        if (resp.status === 403) {
          setFailed('Refreshing is disabled on this deployment.')
          setPromptOpen(false)
          return
        }
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`)

        // Only past here has the password actually been accepted.
        setPromptOpen(false)
        setPassword('')

        const reader = resp.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trim()
            if (!payload) continue

            let ev: RunEvent
            try {
              ev = JSON.parse(payload)
            } catch {
              continue
            }

            switch (ev.type) {
              case 'plan':
                setPhases(ev.phases ?? [])
                setSources(
                  (ev.sources ?? []).map((n) => ({
                    name: n,
                    status: 'pending' as const,
                    items: 0,
                  })),
                )
                break
              case 'phase':
                setCurrentPhase(ev.phase ?? null)
                break
              case 'source':
                setSources((prev) =>
                  prev.map((s) =>
                    s.name === ev.name
                      ? { ...s, status: ev.status ?? 'ok', items: ev.items ?? 0 }
                      : s,
                  ),
                )
                break
              case 'metrics':
                setMetrics(ev.metrics ?? null)
                break
              case 'log':
              case 'stage':
                setLog((prev) => [...prev, ev.message ?? ''])
                break
              case 'error':
                setFailed(ev.message ?? 'Something went wrong.')
                setLog((prev) => [...prev, ev.message ?? 'error'])
                break
              case 'done': {
                setCurrentPhase(null)
                if (ev.error) {
                  setFailed(ev.error)
                } else {
                  const cost = ev.spend?.cost ? ` · ${ev.spend.cost.toFixed(3)} spent` : ''
                  setFinished(ev.issue_id ? `${ev.issue_id}${cost}` : 'Done')
                }
                qc.invalidateQueries({ queryKey: ['watch'] })
                break
              }
            }
          }
        }
      } catch (err) {
        setFailed(err instanceof Error ? err.message : 'Could not reach the server.')
      } finally {
        setRunning(false)
      }
    },
    [qc],
  )

  const openPrompt = useCallback(() => {
    setPassword('')
    setPasswordError(null)
    setPromptOpen(true)
  }, [])

  const submitPassword = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      void run(password)
    },
    [password, run],
  )

  const showPanel = running || finished || failed

  return (
    <>
      {!promptOpen && !running && (
        <Button variant="outline" size="sm" onClick={openPrompt}>
          <RefreshCw className="h-3.5 w-3.5" />
          Run the agent
        </Button>
      )}

      {promptOpen && !running && (
        <form onSubmit={submitPassword} className="mb-2 flex items-center gap-2">
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setPasswordError(null)
            }}
            placeholder="Password"
            className="h-8 w-40 text-sm"
          />
          <Button type="submit" size="sm" disabled={!password}>
            Run
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPromptOpen(false)}
          >
            Cancel
          </Button>
          {passwordError && (
            <span className="text-destructive text-xs">{passwordError}</span>
          )}
        </form>
      )}

      {showPanel && (
        <div className="border-border bg-card/60 mb-4 w-full max-w-xl rounded-2xl border p-4 text-left">
          <RunHeader
            running={running}
            finished={finished}
            failed={failed}
            phases={phases}
            currentPhase={currentPhase}
          />

          <Progress value={percent} className="mt-3 mb-4 h-1.5" />

          {phases.length > 0 && (
            <ol className="mb-4 space-y-1.5">
              {phases.map((p, i) => {
                const active = p.id === currentPhase
                const currentIndex = phases.findIndex((x) => x.id === currentPhase)
                const complete = finished ? true : currentIndex > i
                return (
                  <li
                    key={p.id}
                    className={cn(
                      'flex items-center gap-2 text-sm transition-colors',
                      active && 'text-foreground font-medium',
                      !active && complete && 'text-muted-foreground',
                      !active && !complete && 'text-muted-foreground/50',
                    )}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {complete ? (
                        <Check className="text-primary h-3.5 w-3.5" />
                      ) : active ? (
                        <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <span className="bg-muted-foreground/30 h-1.5 w-1.5 rounded-full" />
                      )}
                    </span>
                    {p.label}
                  </li>
                )
              })}
            </ol>
          )}

          {sources.length > 0 && <SourceGrid sources={sources} />}

          {metrics && <Metrics metrics={metrics} />}

          {log.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowLog((v) => !v)}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
              >
                <ChevronDown
                  className={cn('h-3 w-3 transition-transform', showLog && 'rotate-180')}
                />
                {showLog ? 'Hide' : 'Show'} details
              </button>
              {showLog && (
                <div className="text-muted-foreground mt-2 max-h-40 overflow-y-auto font-mono text-xs leading-relaxed">
                  {log.map((line, i) => (
                    <div
                      key={i}
                      className={cn(/WARNING|FAIL|GAP/.test(line) && 'text-destructive')}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}

function RunHeader({
  running,
  finished,
  failed,
  phases,
  currentPhase,
}: {
  running: boolean
  finished: string | null
  failed: string | null
  phases: Phase[]
  currentPhase: string | null
}) {
  if (failed) {
    return (
      <div className="flex items-start gap-2">
        <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="font-heading text-sm font-bold">Run failed</div>
          <div className="text-muted-foreground text-xs">{failed}</div>
        </div>
      </div>
    )
  }

  if (finished) {
    return (
      <div className="flex items-start gap-2">
        <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="font-heading text-sm font-bold">Issue ready</div>
          <div className="text-muted-foreground text-xs">{finished}</div>
        </div>
      </div>
    )
  }

  const label = phases.find((p) => p.id === currentPhase)?.label ?? 'Starting up'
  return (
    <div className="flex items-start gap-2">
      <Loader2 className="text-primary mt-0.5 h-4 w-4 shrink-0 animate-spin" />
      <div>
        <div className="font-heading text-sm font-bold">{label}</div>
        <div className="text-muted-foreground text-xs">
          {running ? 'The agent is working — this takes a few minutes.' : ''}
        </div>
      </div>
    </div>
  )
}

const SOURCE_ICONS: Record<SourceStatus, typeof Check> = {
  pending: Loader2,
  ok: Check,
  unchanged: Minus,
  error: AlertCircle,
}

function SourceGrid({ sources }: { sources: SourceState[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
      {sources.map((s) => {
        const Icon = SOURCE_ICONS[s.status]
        return (
          <div
            key={s.name}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors',
              s.status === 'pending' && 'text-muted-foreground/50',
              s.status === 'ok' && 'text-foreground',
              s.status === 'unchanged' && 'text-muted-foreground',
              s.status === 'error' && 'text-destructive',
            )}
            // "unchanged" is a healthy 304, not a failure — worth saying,
            // because a row of dashes otherwise reads as broken.
            title={
              s.status === 'unchanged'
                ? 'Nothing new since the last run'
                : s.status === 'error'
                  ? 'Could not be read'
                  : undefined
            }
          >
            <Icon
              className={cn('h-3 w-3 shrink-0', s.status === 'pending' && 'animate-spin')}
            />
            <span className="truncate">{s.name}</span>
            {s.items > 0 && (
              <span className="text-muted-foreground ml-auto shrink-0 tabular-nums">
                {s.items}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Metrics({ metrics }: { metrics: Record<string, number> }) {
  return (
    <div className="border-border mt-4 flex gap-4 border-t pt-3">
      {Object.entries(metrics).map(([label, value]) => (
        <div key={label}>
          <div className="font-heading text-lg leading-none font-extrabold tabular-nums">
            {value}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">{label}</div>
        </div>
      ))}
    </div>
  )
}
