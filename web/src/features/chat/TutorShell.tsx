import { useState } from 'react'
import { MessageCircle, BookOpen, LogOut } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { ChatView } from '@/features/chat/ChatView'
import { PracticeView } from '@/features/practice/PracticeView'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type View = 'chat' | 'practice'

export function TutorShell() {
  const { user, signOut } = useAuth()
  const [view, setView] = useState<View>('chat')

  return (
    <div className="h-svh flex flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-4 h-12 border-b border-border">
        <span className="font-semibold text-sm">T-Tutor</span>

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* View toggle */}
        <nav className="flex items-center gap-1">
          {(['chat', 'practice'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-sm transition-colors capitalize',
                view === v
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              {v === 'chat' ? <MessageCircle className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
              {v}
            </button>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side controls */}
        <div className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground hidden sm:inline mr-1">{user?.name}</span>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            Level {user?.level}
          </span>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={signOut}
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col min-h-0">
        {view === 'chat' ? <ChatView /> : <PracticeView />}
      </main>
    </div>
  )
}
