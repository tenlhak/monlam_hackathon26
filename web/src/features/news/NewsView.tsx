import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Newspaper } from 'lucide-react'
import type {
  NewsLang,
  WatchIssue,
  WatchIssueSummary,
  WatchStats,
} from '@/lib/types/watch'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StoryCard } from './StoryCard'

/** The newsletter: a week of Tibet coverage, grouped into stories.
 *
 * Everything here is read from SQLite that the crawler and composer already
 * filled, so no model is called and nothing waits on an API. That is the point
 * — the reading view stays fast and stays up even when melong is throttled.
 */
export function NewsView() {
  const [issueId, setIssueId] = useState<string | null>(null)
  const [lang, setLang] = useState<NewsLang>('en')

  const { data: stats } = useQuery({
    queryKey: ['watch', 'stats'],
    queryFn: () => api.get<WatchStats>('/api/watch/stats').then((r) => r.data),
  })

  const { data: issueList, isLoading: listLoading } = useQuery({
    queryKey: ['watch', 'issues'],
    queryFn: () =>
      api
        .get<{ issues: WatchIssueSummary[] }>('/api/watch/issues')
        .then((r) => r.data.issues),
  })

  const activeId = issueId ?? issueList?.[0]?.id ?? null

  const { data: issue } = useQuery({
    queryKey: ['watch', 'issue', activeId],
    queryFn: () =>
      api.get<WatchIssue>(`/api/watch/issues/${activeId}`).then((r) => r.data),
    enabled: !!activeId,
  })

  if (listLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading the newsletter…</div>
  }

  if (!issueList?.length) {
    return (
      <div className="flex-1 grid place-items-center p-8">
        <div className="max-w-md text-center">
          <Newspaper className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <h2 className="font-semibold mb-1">No issue yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The crawler has {stats?.corpus.articles ?? 0} articles stored and{' '}
            {stats?.window_ready ?? 0} ready for the next issue. Compose one to read it here.
          </p>
          <pre className="text-xs text-left bg-muted rounded-md p-3 overflow-x-auto">
            <code>
              cd t_tutor{'\n'}python crawl.py --once{'\n'}python compose.py
            </code>
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Issue picker and language choice */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <select
            value={activeId ?? ''}
            onChange={(e) => setIssueId(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            {issueList.map((i) => (
              <option key={i.id} value={i.id}>
                {i.id} — {i.story_count} stories
              </option>
            ))}
          </select>

          {issue && (
            <span className="text-xs text-muted-foreground">
              {issue.window_start?.slice(0, 10)} to {issue.window_end?.slice(0, 10)}
            </span>
          )}
          {issue?.status && (
            <Badge variant="outline" className="shrink-0">
              {issue.status}
            </Badge>
          )}

          {/* One language choice for the whole issue reads better than a
              toggle on every story. */}
          <Tabs
            value={lang}
            onValueChange={(v) => setLang(v as NewsLang)}
            className="ml-auto"
          >
            <TabsList>
              <TabsTrigger value="en">English</TabsTrigger>
              <TabsTrigger value="bo" className="font-tibetan">
                བོད་ཡིག
              </TabsTrigger>
              <TabsTrigger value="both">Both</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {issue?.intro && (
          <p className="text-sm leading-relaxed border-l-2 border-primary pl-4 py-1 mb-6">
            {issue.intro}
          </p>
        )}

        {issue?.sections.map((section) => (
          <section key={section.section} className="mb-2">
            <div className="flex items-center gap-3 mt-6 mb-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.section}
              </h2>
              <Separator className="flex-1" />
            </div>
            {section.stories.map((story) => (
              <StoryCard key={story.id} story={story} lang={lang} />
            ))}
          </section>
        ))}

        {stats && (
          <p className="text-xs text-muted-foreground pt-6">
            {stats.corpus.articles} articles crawled · {stats.window_ready} ready for the next
            issue · {stats.feeds.length - stats.unhealthy}/{stats.feeds.length} feeds healthy
          </p>
        )}
      </div>
    </div>
  )
}
