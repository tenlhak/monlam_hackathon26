import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { Features } from '@/lib/types/watch'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

/**
 * Artwork for the four sections.
 *
 * Anything in `web/public/` is served from the site root, so `art/chat.webp` on
 * disk is `/art/chat.webp` here. `src` may be null, which renders a sized
 * placeholder rather than a broken image — useful while art is being replaced,
 * since the placeholder is the same size and the layout never shifts.
 *
 * See `docs/landing-art.md` for dimensions and the WebP conversion.
 */
type Art = { src: string | null; alt: string; note: string }

const ART: Record<'chat' | 'practice' | 'news' | 'resources', Art> = {
  chat: {
    src: '/art/chat.webp',
    alt: 'Sherab, the AI Tibetan tutor — a speech bubble lit by a butter lamp',
    note: 'Sherab in conversation — a question answered in Tibetan and English',
  },
  practice: {
    src: '/art/practice.webp',
    alt: 'An open book showing a Tibetan letter, with a pencil and a sound wave',
    note: 'A letter being traced, stroke order showing',
  },
  news: {
    src: '/art/news.webp',
    alt: 'A stupa against Himalayan peaks and a rising sun',
    note: 'A news story read side by side in Tibetan and English',
  },
  resources: {
    src: '/art/resources.webp',
    alt: 'A stack of books beneath a butter lamp',
    note: 'Books, courses and tools — the shelf beyond the app',
  },
}

/** What MunSel is, then each part of it in turn.
 *
 * Purely descriptive — the way back into a drill lives on the home page, so
 * nothing here competes with it.
 */
function AboutPage() {
  // News depends on a crawler and its dependencies, both optional. The backend
  // says whether it mounted, so we never describe a tab that would 404.
  const { data: features } = useQuery({
    queryKey: ['features'],
    queryFn: () => api.get<Features>('/api/features').then((r) => r.data),
    staleTime: Infinity,
  })

  return (
    <div className="flex-1 overflow-y-auto">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="flex flex-col-reverse items-start gap-10 sm:flex-row sm:items-center sm:justify-between sm:gap-12">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-5xl leading-[1.05] tracking-wide sm:text-6xl lg:text-7xl">
              Welcome to MunSel
            </h1>
            <p className="mt-7 max-w-xl text-[15px] leading-loose text-muted-foreground">
              MunSel takes you from learning the script to reading, writing, listening
              and speaking with confidence. Practice with your personal Tibetan tutor,
              build your skills interactively, and eventually put them to use with real
              Tibetan news and content.
            </p>
          </div>

          <img
            src="/logo-512.webp"
            alt=""
            width={176}
            height={176}
            className="w-28 shrink-0 rounded-[28px] ring-1 ring-border sm:w-36 lg:w-44"
          />
        </div>
      </section>

      {/* ── The parts ────────────────────────────────────────────── */}
      <Part
        to="/chat"
        tibetan="སློབ་དཔོན།"
        title="Chat"
        body="Ask anything, in English or in Tibetan. Sherab explains, corrects what you write, and quizzes you when you would rather be tested than told. Conversations are kept, so you can go back to what you asked last week."
        art={ART.chat}
        cta="Open the chat"
      />

      <Part
        to="/practice"
        tibetan="སྦྱོང་བརྡར།"
        title="Practice"
        body="Five levels, starting at the thirty consonants in their traditional order. Hear each letter, trace its strokes in the right sequence, say it back, then build syllables out of it. The tracing is graded on geometry, not handwriting, so a beginner's hand is never marked wrong."
        art={ART.practice}
        reverse
        cta="See the levels"
      />

      {features?.watch && (
        <Part
          to="/news"
          tibetan="གསར་འགྱུར།"
          title="News"
          body="A week of Tibet coverage, gathered and grouped into stories, readable side by side in Tibetan and English. Real writing rather than exercises — the point at which the language stops being a subject and starts being useful."
          art={ART.news}
          cta="Read this week"
        />
      )}

      <Part
        to="/resources"
        tibetan="དཔེ་མཛོད།"
        title="Resources"
        body="Books, courses, videos and tools for when you have outgrown this app — including the ones that teach the literary language MunSel does not. Hand-picked, and every link checked by hand."
        art={ART.resources}
        reverse={!features?.watch}
        cta="Browse the shelf"
        last
      />
    </div>
  )
}

/**
 * One part of the product: its name, what it does, and a picture of it.
 *
 * Tibetan script hangs from a head line (dbu), so each part hangs from its own
 * hairline and leads with its Tibetan name. On hover that rule redraws itself in
 * the accent from left to right, the way the head line is written before the
 * letters beneath it — which is the whole affordance, in place of a card and a
 * shadow. Sides alternate so the eye has somewhere to go over four sections.
 */
function Part({
  to,
  tibetan,
  title,
  body,
  art,
  cta,
  reverse = false,
  last = false,
}: {
  to: string
  tibetan: string
  title: string
  body: string
  art: Art
  cta: string
  reverse?: boolean
  last?: boolean
}) {
  return (
    <section className={cn('group/part border-t border-border', last && 'border-b')}>
      <span
        aria-hidden
        className="block h-px w-0 -translate-y-px bg-primary transition-all duration-700 ease-out group-hover/part:w-full"
      />

      <div
        className={cn(
          'mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16 sm:py-20 lg:items-center lg:gap-16',
          reverse ? 'lg:flex-row-reverse' : 'lg:flex-row',
        )}
      >
        <div className="min-w-0 lg:flex-1">
          <p className="font-tibetan text-lg leading-none text-muted-foreground">{tibetan}</p>
          <h2 className="font-display mt-3 text-4xl leading-none tracking-wide sm:text-5xl">
            {title}
          </h2>
          <p className="mt-5 max-w-prose text-[15px] leading-loose text-muted-foreground">
            {body}
          </p>

          <div className="mt-8">
            <Link
              to={to}
              className="group/cta font-display inline-flex items-baseline gap-2 text-xl tracking-wide"
            >
              {cta}
              <span
                aria-hidden
                className="text-muted-foreground transition-transform duration-300 group-hover/cta:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>
        </div>

        <div className="lg:flex-1">
          <ArtPanel art={art} />
        </div>
      </div>
    </section>
  )
}

/** The artwork, or a clearly-unfinished stand-in at the same size. */
function ArtPanel({ art }: { art: Art }) {
  if (art.src) {
    return (
      <img
        src={art.src}
        alt={art.alt}
        loading="lazy"
        className="aspect-[16/10] w-full rounded-xl object-cover ring-1 ring-border"
      />
    )
  }

  return (
    <div className="border-border/70 grid aspect-[16/10] w-full place-items-center rounded-xl border border-dashed px-6">
      <div className="text-center">
        <p className="font-tibetan text-4xl text-muted-foreground/25 select-none">ཨ</p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground/70">{art.note}</p>
        <p className="mt-1.5 text-[11px] text-muted-foreground/45">Artwork to come</p>
      </div>
    </div>
  )
}
