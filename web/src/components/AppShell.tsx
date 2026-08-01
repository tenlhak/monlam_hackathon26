import type { ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { MessageCircle, BookOpen, LogOut, Home, Newspaper } from 'lucide-react'
import type { Features } from '@/lib/types/watch'
import { useAuth } from '@/features/auth/AuthContext'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // News depends on a crawler and its dependencies, both optional. The backend
  // says whether it mounted, so we never offer a tab that would 404.
  const { data: features } = useQuery({
    queryKey: ['features'],
    queryFn: () => api.get<Features>('/api/features').then((r) => r.data),
    staleTime: Infinity,
  })

  const nav = [
    { to: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' },
    { to: '/chat', label: 'Chat', icon: MessageCircle, match: (p: string) => p.startsWith('/chat') },
    {
      to: '/practice',
      label: 'Practice',
      icon: BookOpen,
      match: (p: string) => p.startsWith('/practice'),
    },
    ...(features?.watch
      ? [
          {
            to: '/news',
            label: 'News',
            icon: Newspaper,
            match: (p: string) => p.startsWith('/news'),
          } as const,
        ]
      : []),
  ] as const

  return (
    <div className="h-svh flex flex-col bg-background">
      <header className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-border bg-card/70 backdrop-blur-sm">
        <Link
          to="/"
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <img
            src="/logo-32.webp"
            alt=""
            width={26}
            height={26}
            className="rounded-[8px]"
          />
          <span className="font-heading font-extrabold text-base leading-none">MunSel</span>
        </Link>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <nav className="flex items-center gap-1">
          {nav.map(({ to, label, icon: Icon, match }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-heading font-bold transition-all active:scale-95',
                match(pathname)
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground hidden sm:inline mr-1">{user?.name}</span>
          <span className="text-xs font-heading font-bold bg-sunrise/15 text-sunrise border border-sunrise/30 px-2.5 py-0.5 rounded-full">
            Lv {user?.level}
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

      <main className="flex-1 flex flex-col min-h-0">{children}</main>
    </div>
  )
}
