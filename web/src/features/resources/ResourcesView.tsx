import { useMemo, useState } from 'react'
import { BookOpen, ExternalLink, GraduationCap, Video, Wrench } from 'lucide-react'
import type { Cost, Register, Resource, ResourceKind } from '@/lib/resources-data'
import {
  KIND_LABELS,
  KIND_ORDER,
  REGISTER_LABELS,
  RESOURCES,
} from '@/lib/resources-data'
import { useAuth } from '@/features/auth/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const KIND_ICONS: Record<ResourceKind, typeof BookOpen> = {
  book: BookOpen,
  video: Video,
  course: GraduationCap,
  tool: Wrench,
}

const COST_LABELS: Record<Cost, string> = {
  free: 'Free',
  paid: 'Paid',
  mixed: 'Free + paid',
}

type RegisterFilter = Register | 'all'

/** Where to go when you have outgrown this app.
 *
 * Entirely static — no API, no database, nothing to rate-limit. Every link was
 * verified by fetching it rather than recalled, because a dead link here is
 * worse than an empty page.
 *
 * The spoken/literary filter is the reason this is not just a list of links.
 * Tibetan material splits hard between the two and most directories do not say
 * which is which, so beginners end up in Buddhist text readers when they wanted
 * to talk to their family.
 */
export function ResourcesView() {
  const { user } = useAuth()
  const [register, setRegister] = useState<RegisterFilter>('all')
  const [freeOnly, setFreeOnly] = useState(false)
  const [matchLevel, setMatchLevel] = useState(false)

  const level = user?.level ?? 1

  const visible = useMemo(() => {
    return RESOURCES.filter((r) => {
      // "Both" always survives a register filter: it genuinely serves either.
      if (register !== 'all' && r.register !== register && r.register !== 'both') {
        return false
      }
      if (freeOnly && r.cost === 'paid') return false
      if (matchLevel && !r.levels.includes(level)) return false
      return true
    })
  }, [register, freeOnly, matchLevel, level])

  const grouped = useMemo(() => {
    return KIND_ORDER.map((kind) => ({
      kind,
      items: visible.filter((r) => r.kind === kind),
    })).filter((g) => g.items.length > 0)
  }, [visible])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <header className="mb-6">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Resources</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Places to keep learning Tibetan beyond MunSel — hand-picked, and every
            link checked.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <FilterGroup
            value={register}
            onChange={setRegister}
            options={[
              { value: 'all', label: 'Everything' },
              { value: 'colloquial', label: 'Spoken' },
              { value: 'literary', label: 'Literary' },
            ]}
          />

          <Button
            variant={freeOnly ? 'default' : 'outline'}
            size="sm"
            className="rounded-full"
            onClick={() => setFreeOnly((v) => !v)}
          >
            Free only
          </Button>

          <Button
            variant={matchLevel ? 'default' : 'outline'}
            size="sm"
            className="rounded-full"
            onClick={() => setMatchLevel((v) => !v)}
            title={`Show only what suits level ${level}`}
          >
            For my level ({level})
          </Button>
        </div>

        <p className="text-muted-foreground mb-6 text-xs leading-relaxed">
          <strong className="text-foreground">Spoken</strong> is the everyday
          language you need to hold a conversation.{' '}
          <strong className="text-foreground">Literary</strong> is classical
          Tibetan, for reading texts. They are far enough apart that picking the
          wrong one costs beginners months — most link lists never say which is
          which.
        </p>

        {grouped.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Nothing matches those filters. Try widening them.
          </p>
        ) : (
          <div className="space-y-8">
            {grouped.map(({ kind, items }) => (
              <section key={kind}>
                <h2 className="font-heading mb-3 flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
                  {KIND_LABELS[kind]}
                  <span className="text-muted-foreground text-xs font-normal normal-case">
                    {items.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {items.map((r) => (
                    <ResourceCard key={r.id} resource={r} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="bg-muted flex items-center gap-1 rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full px-3 py-1 text-sm font-medium transition-colors',
            value === o.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ResourceCard({ resource: r }: { resource: Resource }) {
  const Icon = KIND_ICONS[r.kind]

  return (
    <a
      href={r.url}
      target="_blank"
      // noreferrer as well as noopener: without it the target page can see
      // where the click came from, and these are outbound links from a page
      // that knows who is signed in.
      rel="noopener noreferrer"
      className="border-border hover:border-primary/50 hover:bg-accent/40 group block rounded-xl border p-4 transition-colors"
    >
      <div className="flex items-start gap-3">
        <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="font-heading truncate font-bold">{r.title}</h3>
            <ExternalLink className="text-muted-foreground h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">{r.by}</p>
          <p className="mt-2 text-sm leading-relaxed">{r.note}</p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">
              {REGISTER_LABELS[r.register]}
            </Badge>
            <Badge
              variant={r.cost === 'free' ? 'default' : 'outline'}
              className="text-xs"
            >
              {COST_LABELS[r.cost]}
            </Badge>
            <span className="text-muted-foreground text-xs">
              Levels {formatLevels(r.levels)}
            </span>
          </div>
        </div>
      </div>
    </a>
  )
}

/** "1–4" rather than "1, 2, 3, 4" when the levels are contiguous. */
function formatLevels(levels: number[]): string {
  if (levels.length === 0) return '—'
  const sorted = [...levels].sort((a, b) => a - b)
  const contiguous = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1)
  if (contiguous && sorted.length > 2) return `${sorted[0]}–${sorted[sorted.length - 1]}`
  return sorted.join(', ')
}
