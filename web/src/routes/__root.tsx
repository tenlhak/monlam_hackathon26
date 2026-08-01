import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useAuth } from '@/features/auth/AuthContext'
import { SignIn } from '@/features/auth/SignIn'
import { AppShell } from '@/components/AppShell'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <span className="font-tibetan text-3xl animate-pulse">བཀྲ་ཤིས།</span>
      </div>
    )
  }

  if (!user) {
    return <SignIn />
  }

  return (
    <AppShell>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </AppShell>
  )
}
