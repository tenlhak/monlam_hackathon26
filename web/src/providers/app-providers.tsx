import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryClient } from '@/lib/query-client'
import { AuthProvider } from '@/features/auth/AuthContext'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}
