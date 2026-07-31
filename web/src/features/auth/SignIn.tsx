import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '@/lib/api'
import type { User } from '@/lib/types/tutor'
import { useAuth } from './AuthContext'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SignIn() {
  const { signIn } = useAuth()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setLoading(true)
    setError('')

    try {
      const res = await api.post<User>('/api/user', { name: trimmed })
      signIn(res.data)
    } catch {
      setError('Could not connect. Is the server running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-background relative">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm px-6 flex flex-col items-center gap-6">
        <p className="font-tibetan text-5xl leading-relaxed tracking-wide text-foreground">
          བཀྲ་ཤིས་བདེ་ལེགས།
        </p>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to T-Tutor</h1>
          <p className="text-muted-foreground text-sm">
            Your personal Tibetan tutor. What should I call you?
          </p>
        </div>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="given-name"
            autoFocus
            disabled={loading}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" disabled={loading || !name.trim()} className="w-full">
            {loading ? 'Starting…' : 'Start learning'}
          </Button>
        </form>
      </div>
    </div>
  )
}
