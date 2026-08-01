import { Link, createFileRoute } from '@tanstack/react-router'
import { Lock, ChevronRight } from 'lucide-react'
import { CURRICULUM } from '@/lib/curriculum'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/practice/')({
  component: PracticeLevelsPage,
})

function PracticeLevelsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-lg p-4 space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Practice</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a level. Each level has sections you work through in order.
          </p>
        </div>

        <div className="space-y-2">
          {CURRICULUM.map((level) => {
            if (level.available) {
              return (
                <Link
                  key={level.id}
                  to="/practice/$levelId"
                  params={{ levelId: String(level.id) }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold tabular-nums">
                    {level.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{level.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{level.focus}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {level.sections.length} sections
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              )
            }

            return (
              <div
                key={level.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-border p-4 opacity-55',
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold tabular-nums text-muted-foreground">
                  {level.id}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-muted-foreground">{level.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{level.focus}</p>
                </div>
                <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
