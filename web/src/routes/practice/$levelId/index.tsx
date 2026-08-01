import { Link, Navigate, createFileRoute, redirect } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { getLevel, isLevelUnlocked } from '@/lib/curriculum'
import { useAuth } from '@/features/auth/AuthContext'

export const Route = createFileRoute('/practice/$levelId/')({
  beforeLoad: ({ params }) => {
    // Only "is this a real level" — whether the learner has reached it depends
    // on their placement, which beforeLoad cannot see.
    if (!getLevel(Number(params.levelId))) {
      throw redirect({ to: '/practice' })
    }
  },
  component: PracticeSectionsPage,
})

function PracticeSectionsPage() {
  const { levelId } = Route.useParams()
  const { user } = useAuth()
  const level = getLevel(Number(levelId))!

  if (!isLevelUnlocked(level.id, user?.level)) {
    return <Navigate to="/practice" replace />
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-lg p-4 space-y-5">
        <div className="space-y-2">
          <Link
            to="/practice"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            All levels
          </Link>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Level {level.id} · ≈ CEFR {level.cefr}
            </p>
            <h1 className="text-xl font-semibold tracking-tight">{level.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{level.focus}</p>
          </div>
        </div>

        <div className="space-y-2">
          {level.sections.map((section) => {
            if (section.available) {
              return (
                <Link
                  key={section.id}
                  to="/practice/$levelId/$sectionId"
                  params={{ levelId, sectionId: String(section.id) }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold tabular-nums">
                    {section.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{section.title}</p>
                    <p className="text-xs text-muted-foreground">{section.subtitle}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {[
                        section.itemCount > 0 && `${section.itemCount} items`,
                        ...section.drills,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              )
            }

            return (
              <div
                key={section.id}
                className="flex items-center gap-3 rounded-xl border border-border p-4 opacity-55"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold tabular-nums text-muted-foreground">
                  {section.id}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-muted-foreground">{section.title}</p>
                  <p className="text-xs text-muted-foreground">{section.subtitle}</p>
                </div>
                <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
            )
          })}
        </div>

        {level.sections.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Sections for this level are coming soon.</p>
            <Link
              to="/practice"
              className="inline-flex text-sm text-primary underline-offset-4 hover:underline"
            >
              Back to levels
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
