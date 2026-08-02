import {
  Link,
  Navigate,
  createFileRoute,
  redirect,
} from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import {
  getLevel,
  isLevelUnlocked,
  type CurriculumSection,
} from "@/lib/curriculum";
import { useAuth } from "@/features/auth/AuthContext";
import {
  getSectionProgress,
  useLevelProgress,
  useSectionProgress,
} from "@/lib/progress";
import { TibetanText } from "@/lib/tibetan-render";
import { LEVEL_TONE } from "@/lib/level-tone";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/practice/$levelId/")({
  beforeLoad: ({ params }) => {
    // Only "is this a real level" — whether the learner has reached it depends
    // on their placement, which beforeLoad cannot see.
    if (!getLevel(Number(params.levelId))) {
      throw redirect({ to: "/practice" });
    }
  },
  component: PracticeSectionsPage,
});

/**
 * "Section 4 — Punctuation" → "Punctuation". The numbered badge beside the row
 * already says which section it is, so the prefix is read twice. The stored
 * title keeps it for the places that show a section without its badge.
 */
function shortTitle(title: string): string {
  return title.replace(/^Section\s+\d+\s*—\s*/, "");
}

function PracticeSectionsPage() {
  const { levelId } = Route.useParams();
  const { user } = useAuth();
  const level = getLevel(Number(levelId))!;
  const progress = useLevelProgress(level.id);

  // The first unfinished section — this page's one obvious next action, so the
  // learner does not have to scan five rows to work out where they stopped.
  const resumeSection = level.sections.find(
    (s) => s.available && !getSectionProgress(level.id, s.id).complete,
  );

  // Same placement gate as /practice — direct links (e.g. the home page's
  // "Continue" card) can land here before beforeLoad has any user to check.
  if (user && !user.placed_at) {
    return <Navigate to="/placement" replace />;
  }

  if (!isLevelUnlocked(level.id, user?.level)) {
    return <Navigate to="/practice" replace />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-lg p-4 space-y-5">
        <div className="space-y-2">
          <Link
            to="/practice"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            All levels
          </Link>
          <div>
            <p className="text-[11px] font-heading font-bold text-primary uppercase tracking-[0.14em]">
              Level {level.id} · {level.cefr}
            </p>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight">
              {level.title}
            </h1>
            {/* The full description belongs here rather than on the level list:
                the learner has already chosen, so detail is welcome. */}
            <div className="text-sm leading-[1.8] text-muted-foreground mt-1">
              <TibetanText text={level.summary} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <Badge className={cn("h-auto py-0.5", LEVEL_TONE[level.tone].tint)}>
                {level.capability}
              </Badge>
              {level.meta.map((m) => (
                <Badge
                  key={m}
                  variant="outline"
                  className="h-auto py-0.5 font-normal text-muted-foreground"
                >
                  {m}
                </Badge>
              ))}
            </div>
          </div>

          {progress.total > 0 && (
            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      progress.complete
                        ? "bg-gradient-to-r from-sunrise to-sun"
                        : "bg-primary",
                    )}
                    style={{
                      width: `${Math.max(progress.percent, progress.done > 0 ? 3 : 0)}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {progress.done} of {progress.total} items done
                </p>
              </div>
              {resumeSection && (
                <Link
                  to="/practice/$levelId/$sectionId"
                  params={{ levelId, sectionId: String(resumeSection.id) }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-heading font-bold text-primary-foreground shadow-sm transition-transform hover:scale-[1.03] active:scale-95"
                >
                  {progress.done === 0 ? "Start" : "Continue"}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {level.sections.map((section) =>
            section.available ? (
              <SectionCard
                key={section.id}
                levelId={levelId}
                section={section}
              />
            ) : (
              <div
                key={section.id}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-2.5 opacity-70"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-heading font-bold tabular-nums text-muted-foreground">
                  {section.id}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-muted-foreground truncate">
                    {shortTitle(section.title)}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {section.subtitle}
                  </p>
                </div>
                <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
            ),
          )}
        </div>

        {level.sections.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Sections for this level are coming soon.
            </p>
            <Link
              to="/practice"
              className="inline-flex text-sm text-primary underline-offset-4 hover:underline"
            >
              Back to levels
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  levelId,
  section,
}: {
  levelId: string;
  section: CurriculumSection;
}) {
  const progress = useSectionProgress(Number(levelId), section.id);

  return (
    <Link
      to="/practice/$levelId/$sectionId"
      params={{ levelId, sectionId: String(section.id) }}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-heading font-bold tabular-nums",
          progress.complete
            ? "bg-success/15 text-success"
            : "bg-primary/10 text-primary",
        )}
      >
        {progress.complete ? <Check className="h-5 w-5" /> : section.id}
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-baseline gap-2">
          <p className="font-medium text-sm truncate">
            {shortTitle(section.title)}
          </p>
          {/* Counts sit on the title line so the drill list below stays put
              whether or not the learner has started — no row reflow. */}
          <span
            className={cn(
              "ml-auto shrink-0 text-[11px] tabular-nums",
              progress.complete ? "text-success" : "text-muted-foreground",
            )}
          >
            {progress.complete
              ? "Done"
              : `${progress.done}/${progress.total}`}
          </span>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-1">
          {section.subtitle}
        </p>

        <div className="flex items-center gap-2 pt-0.5">
          <div className="h-1 w-16 shrink-0 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                progress.complete ? "bg-success" : "bg-primary",
              )}
              style={{
                width: `${Math.max(progress.percent, progress.done > 0 ? 6 : 0)}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {section.drills.join(" · ")}
          </p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
