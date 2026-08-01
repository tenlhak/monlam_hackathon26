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
    <div className="min-h-svh flex items-center justify-center bg-background bg-sky-hero relative">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm px-6 flex flex-col items-center gap-7">
        {/* The logo carries the wordmark, so the heading below is the greeting
            rather than the product name. */}
        <img
          src="/logo-192.webp"
          alt="MunSel"
          width={112}
          height={112}
          className="rounded-[28px] shadow-lg shadow-primary/15 ring-1 ring-border"
        />
        <div className="text-center space-y-3">
          <p className="font-tibetan leading-relaxed tracking-wide text-foreground whitespace-nowrap text-[clamp(1.4rem,6vw,2.25rem)]">
            བཀྲ་ཤིས་བདེ་ལེགས།
          </p>
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
            className="h-11 rounded-2xl bg-card px-4"
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full h-11 rounded-2xl font-heading font-bold text-base transition-transform active:scale-[0.98]"
          >
            {loading ? 'Starting…' : 'Start learning'}
          </Button>
        </form>
      </div>
    </div>
  )
}
