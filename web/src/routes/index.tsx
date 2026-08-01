import { Link, createFileRoute } from '@tanstack/react-router'
import { MessageCircle, BookOpen, ArrowRight, Trophy } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { getLevel, isLevelUnlocked } from '@/lib/curriculum'
import { useLevelProgress, getSectionProgress, useProgressVersion } from '@/lib/progress'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function greetingForHour(h: number) {
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function HomePage() {
  const { user } = useAuth()
  useProgressVersion()

  // The learner's highest unlocked level with content is where they resume.
  const activeLevelId = [...Array(user?.level ?? 1)]
    .map((_, i) => i + 1)
    .filter((id) => isLevelUnlocked(id, user?.level) && (getLevel(id)?.sections.length ?? 0) > 0)
    .pop() ?? 1
  const level = getLevel(activeLevelId)
  const progress = useLevelProgress(activeLevelId)

  // First unfinished section is the "continue" target.
  const nextSection = level?.sections.find(
    (s) => s.available && !getSectionProgress(activeLevelId, s.id).complete,
  )

  return (
    <div className="flex-1 overflow-y-auto bg-sky-hero">
      <div className="mx-auto w-full max-w-2xl p-5 py-8 space-y-6">
        <div className="space-y-1">
          <p className="font-tibetan text-2xl leading-relaxed text-primary">
            བཀྲ་ཤིས་བདེ་ལེགས།
          </p>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">
            {greetingForHour(new Date().getHours())}, {user?.name}
          </h1>
        </div>

        {/* Progress card */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">
                Level {activeLevelId} · {level?.title}
              </p>
              <p className="font-heading text-xl font-extrabold mt-0.5">
                {progress.done === 0
                  ? 'Start your journey'
                  : progress.complete
                    ? 'Level complete!'
                    : `${progress.percent}% there`}
              </p>
            </div>
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                progress.complete ? 'bg-sun/25 text-sunrise' : 'bg-sunrise/15 text-sunrise'
              }`}
            >
              <Trophy className="h-6 w-6" />
            </div>
          </div>

          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sunrise to-sun transition-all duration-500"
              style={{ width: `${Math.max(progress.percent, progress.done > 0 ? 4 : 0)}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {progress.done} of {progress.total} items done
            </p>
            {nextSection ? (
              <Link
                to="/practice/$levelId/$sectionId"
                params={{ levelId: String(activeLevelId), sectionId: String(nextSection.id) }}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-heading font-bold text-primary-foreground shadow-sm transition-transform hover:scale-[1.03] active:scale-95"
              >
                {progress.done === 0 ? 'Start' : 'Continue'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                to="/practice"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-heading font-bold text-primary-foreground shadow-sm transition-transform hover:scale-[1.03] active:scale-95"
              >
                All levels
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/chat"
            className="group flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="font-heading font-extrabold">Chat with your tutor</p>
              <p className="text-sm text-muted-foreground truncate">
                Ask anything — or get quizzed
              </p>
            </div>
          </Link>

          <Link
            to="/practice"
            className="group flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-success/50 hover:-translate-y-0.5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-success/12 text-success">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="font-heading font-extrabold">Practice drills</p>
              <p className="text-sm text-muted-foreground truncate">
                Listen, trace, speak, build
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
