import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@/lib/types/tutor'
import { api } from '@/lib/api'
import { setProgressUser } from '@/lib/progress'

const STORAGE_KEY = 'ttutor_user_id'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: (user: User) => void
  signOut: () => void
  /** Replace the cached user — used after placement changes their level. */
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Keep the practice-progress store scoped to the signed-in learner.
  useEffect(() => setProgressUser(user?.id ?? null), [user?.id])

  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY)
    if (!id) {
      setLoading(false)
      return
    }

    api
      .get<User>(`/api/user/${id}`)
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem(STORAGE_KEY))
      .finally(() => setLoading(false))
  }, [])

  const signIn = (u: User) => {
    localStorage.setItem(STORAGE_KEY, String(u.id))
    setUser(u)
  }

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
