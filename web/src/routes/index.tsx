import { Link, createFileRoute } from '@tanstack/react-router'
import { MessageCircle, BookOpen, ArrowRight } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { user } = useAuth()

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center space-y-2">
        <p className="font-tibetan text-4xl leading-relaxed">བཀྲ་ཤིས་བདེ་ལེགས།</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user?.name}
        </h1>
        <p className="text-muted-foreground text-sm">What would you like to do?</p>
      </div>

      <div className="grid w-full max-w-lg gap-3 sm:grid-cols-2">
        <Link
          to="/chat"
          className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <MessageCircle className="h-5 w-5 text-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              Chat
              <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
            </p>
            <p className="text-sm text-muted-foreground">
              Ask your tutor anything — alphabet, phrases, or a quiz.
            </p>
          </div>
        </Link>

        <Link
          to="/practice"
          className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <BookOpen className="h-5 w-5 text-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              Practice
              <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
            </p>
            <p className="text-sm text-muted-foreground">
              Listen, trace, speak, and build — structured drills by level.
            </p>
          </div>
        </Link>
      </div>
    </div>
  )
}
