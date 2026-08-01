/** Types for the news feature, mirroring `tutor/watch/routes.py`. */

export interface WatchSource {
  source: string
  url: string
  title: string
}

export interface WatchStory {
  id: number
  issue_id: string
  section: string
  rank: number
  /** Headline in the source article's own language. */
  headline: string
  headline_en: string | null
  headline_bo: string | null
  summary_en: string | null
  summary_bo: string | null
  /** How newsworthy the composer judged it — driven mostly by source_count. */
  salience: number
  /** Distinct outlets that covered the story. More than one is the signal. */
  source_count: number
  article_ids: string[]
  primary_url: string
  sources: WatchSource[]
}

export interface WatchSection {
  section: string
  stories: WatchStory[]
}

export interface WatchIssue {
  id: string
  created_at: string
  window_start: string
  window_end: string
  status: string
  intro: string | null
  story_count: number
  cost: number
  sent_at: string | null
  stories: WatchStory[]
  /** Grouped server-side so section order lives next to the taxonomy. */
  sections: WatchSection[]
}

export interface WatchIssueSummary {
  id: string
  created_at: string
  status: string
  story_count: number
  cost: number
}

export interface WatchStats {
  corpus: {
    articles: number
    relevant: number
    with_text: number
    extract_failed: number
    never_published: number
  }
  window_ready: number
  feeds: { name: string; consecutive_failures: number; last_success: string | null }[]
  unhealthy: number
  latest_issue: WatchIssueSummary | null
  admin: boolean
}

/** Which languages to show. A whole-issue choice, not per story. */
export type NewsLang = 'en' | 'bo' | 'both'

export interface Features {
  agent: boolean
  watch: boolean
}
