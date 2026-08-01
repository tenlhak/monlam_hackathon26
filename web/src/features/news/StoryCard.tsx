import { ExternalLink } from 'lucide-react'
import type { NewsLang, WatchStory } from '@/lib/types/watch'
import { Badge } from '@/components/ui/badge'

/** One story: headline, summary, and every outlet that carried it.
 *
 * Sources are listed rather than collapsed to one link because the number of
 * independent outlets is the whole basis of the ranking — a story four
 * newsrooms covered is different from one an organisation posted about itself.
 */
export function StoryCard({ story, lang }: { story: WatchStory; lang: NewsLang }) {
  const showEn = lang === 'en' || lang === 'both'
  const showBo = lang === 'bo' || lang === 'both'
  const corroborated = story.source_count > 1

  return (
    <article className="py-5 border-b border-border last:border-0">
      {showEn && story.headline_en && (
        <h3 className="text-base font-semibold leading-snug mb-1.5">{story.headline_en}</h3>
      )}
      {showEn && story.summary_en && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{story.summary_en}</p>
      )}

      {showBo && story.headline_bo && (
        <h3 className="font-tibetan text-base font-semibold leading-loose mb-1.5">
          {story.headline_bo}
        </h3>
      )}
      {showBo && story.summary_bo && (
        <p className="font-tibetan text-sm text-muted-foreground leading-loose mb-3">
          {story.summary_bo}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={corroborated ? 'default' : 'secondary'} className="shrink-0">
          {story.source_count} outlet{story.source_count > 1 ? 's' : ''}
        </Badge>
        {story.sources.map((src) => (
          <a
            key={src.url}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            title={src.title}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {src.source}
            <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
    </article>
  )
}
