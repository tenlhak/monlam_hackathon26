import { useMemo } from 'react'
import { BookOpen, ExternalLink, GraduationCap, Video, Wrench } from 'lucide-react'
import type { Cost, Resource, ResourceKind } from '@/lib/resources-data'
import {
  KIND_LABELS,
  KIND_ORDER,
  REGISTER_LABELS,
  RESOURCES,
} from '@/lib/resources-data'
import { Badge } from '@/components/ui/badge'

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

/** Where to go when you have outgrown this app.
 *
 * Entirely static — no API, no database, nothing to rate-limit. Every link was
 * verified by fetching it rather than recalled, because a dead link here is
 * worse than an empty page.
 *
 * Deliberately unfiltered: thirteen entries fit on one screen, and controls
 * that only ever narrow thirteen things down cost more attention than they
 * save. The spoken/literary distinction that matters most still travels with
 * each entry as a badge.
 */
export function ResourcesView() {
  const grouped = useMemo(() => {
    return KIND_ORDER.map((kind) => ({
      kind,
      items: RESOURCES.filter((r) => r.kind === kind),
    })).filter((g) => g.items.length > 0)
  }, [])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <header className="mb-8">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Resources</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Places to keep learning Tibetan beyond MunSel — hand-picked, and every
            link checked.
          </p>
        </header>

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
      </div>
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
