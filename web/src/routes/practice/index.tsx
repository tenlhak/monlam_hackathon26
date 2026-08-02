import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { Lock, ChevronRight } from "lucide-react";
import {
  CURRICULUM,
  isLevelUnlocked,
  type CurriculumLevel,
} from "@/lib/curriculum";
import { useAuth } from "@/features/auth/AuthContext";
import { TibetanText } from "@/lib/tibetan-render";
import { LEVEL_TONE } from "@/lib/level-tone";
import { useLevelProgress } from "@/lib/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/practice/")({
  component: PracticeLevelsPage,
});

function PracticeLevelsPage() {
  const { user } = useAuth();

  // A learner who has never been placed takes the quiz first — it is what
  // decides which levels they can open.
  if (user && !user.placed_at) {
    return <Navigate to="/placement" replace />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-xl p-4 py-6 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">
            Practice
          </h1>
          <p className="text-xs text-muted-foreground">
            Level {user?.level ?? 1} of {CURRICULUM.length} unlocked
          </p>
        </div>

        <div className="space-y-2">
          {CURRICULUM.map((level) => (
            <LevelRow
              key={level.id}
              level={level}
              unlocked={isLevelUnlocked(level.id, user?.level)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * One level, one row.
 *
 * This list answers a single question — where do I go next — so it carries only
 * what that decision needs: the level, one line on what it covers, and how far
 * in you are. The summary, capability and meta chips live on the level's own
 * page, where there is room for them and the learner has already chosen.
 *
 * Locked rows shrink to a single line: they are not actionable, so they should
 * not cost the same vertical space as the levels that are.
 */
function LevelRow({
  level,
  unlocked,
}: {
  level: CurriculumLevel;
  unlocked: boolean;
}) {
  const tone = LEVEL_TONE[level.tone];
  const openSections = level.sections.filter((s) => s.available).length;
  const progress = useLevelProgress(level.id);

  const marker = (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-heading font-bold tabular-nums",
        unlocked ? tone.tint : "bg-muted text-muted-foreground",
      )}
    >
      {level.id}
    </span>
  );

  const heading = (
    <div className="flex items-baseline gap-2 min-w-0">
      <h2
        className={cn(
          "font-heading font-bold tracking-tight truncate",
          unlocked ? tone.title : "text-muted-foreground",
        )}
      >
        {level.title}
      </h2>
      <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
        {level.cefr}
      </span>
    </div>
  );

  if (!unlocked) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-2.5">
        {marker}
        <div className="flex-1 min-w-0">{heading}</div>
        <Lock
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-label="Locked"
        />
      </div>
    );
  }

  return (
    <Link
      to="/practice/$levelId"
      params={{ levelId: String(level.id) }}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition-all hover:shadow-md hover:border-primary/25"
    >
      {marker}

      <div className="flex-1 min-w-0 space-y-1">
        {heading}
        <div className="text-xs text-muted-foreground line-clamp-1">
          <TibetanText text={level.focus} />
        </div>

        {openSections > 0 ? (
          <div className="flex items-center gap-2 pt-0.5">
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
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
            <span className="text-[11px] shrink-0 tabular-nums text-muted-foreground">
              {progress.complete
                ? "Complete 🎉"
                : `${progress.done}/${progress.total}`}
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Unlocked — sections still being built
          </p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
