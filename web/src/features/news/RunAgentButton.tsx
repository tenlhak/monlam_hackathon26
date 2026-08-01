import { useCallback, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface RunEvent {
  type: 'stage' | 'log' | 'error' | 'done'
  message?: string
  issue_id?: string
  spend?: { cost?: number; calls?: number }
  error?: string
}

/** Crawl the sources, then compose a fresh issue.
 *
 * It streams rather than spins because the pipeline takes minutes, and a
 * button showing nothing for that long is indistinguishable from a hang. The
 * button disables for the duration and the server holds a lock as well — two
 * runs would contend for the same SQLite writer and each spend real money.
 */
export function RunAgentButton() {
  const qc = useQueryClient()
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])

  // The password gate is enforced server-side — this only decides whether to
  // show the prompt. A client-side check would just be a UI suggestion; the
  // real check is the 401 handling below.
  const [promptOpen, setPromptOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const run = useCallback(
    async (pw: string) => {
      setRunning(true)
      setPasswordError(null)
      setStage('Starting…')
      setLog([])

      try {
        const resp = await fetch('/api/watch/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pw, crawl: true, compose: true, use_gdelt: false }),
        })

        if (resp.status === 401) {
          setPasswordError('Incorrect password')
          setStage(null)
          return
        }
        if (resp.status === 403) {
          setStage('Refreshing is disabled on this deployment (WATCH_ADMIN=0).')
          setPromptOpen(false)
          return
        }
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`)

        // Only past this point has the password actually been accepted.
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

            if (ev.type === 'stage') {
              setStage(ev.message ?? null)
              setLog((prev) => [...prev, `— ${ev.message}`])
            } else if (ev.type === 'log') {
              setLog((prev) => [...prev, ev.message ?? ''])
            } else if (ev.type === 'error') {
              setStage('Failed')
              setLog((prev) => [...prev, ev.message ?? 'error'])
            } else if (ev.type === 'done') {
              const cost = ev.spend?.cost ? ` · cost ${ev.spend.cost.toFixed(3)}` : ''
              setStage(
                ev.error ? `Finished with a problem: ${ev.error}` : `Done — ${ev.issue_id}${cost}`,
              )
              // Pull in the issue that was just written.
              qc.invalidateQueries({ queryKey: ['watch'] })
            }
          }
        }
      } catch (err) {
        setStage(`Could not run: ${err instanceof Error ? err.message : 'unknown error'}`)
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

  return (
    <>
      {!promptOpen && (
        <Button
          variant="outline"
          size="sm"
          onClick={openPrompt}
          disabled={running}
          title="Crawl the sources, then compose a fresh issue"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {running ? 'Running…' : 'Run the agent'}
        </Button>
      )}

      {promptOpen && (
        <form onSubmit={submitPassword} className="flex items-center gap-2 mb-2">
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setPasswordError(null)
            }}
            placeholder="Password"
            disabled={running}
            className="h-8 w-40 text-sm"
          />
          <Button type="submit" size="sm" disabled={running || !password}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Run'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={running}
            onClick={() => setPromptOpen(false)}
          >
            Cancel
          </Button>
          {passwordError && (
            <span className="text-xs text-destructive">{passwordError}</span>
          )}
        </form>
      )}

      {stage && (
        <div className="w-full rounded-lg border border-border bg-muted/40 p-3 mb-4">
          <div className="text-sm font-medium mb-1.5">{stage}</div>
          {log.length > 0 && (
            <div className="max-h-44 overflow-y-auto font-mono text-xs leading-relaxed text-muted-foreground">
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
    </>
  )
}
