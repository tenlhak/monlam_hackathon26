import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { Lock, ChevronRight } from "lucide-react";
import {
  CURRICULUM,
  isLevelUnlocked,
  type CurriculumLevel,
} from "@/lib/curriculum";
import { useAuth } from "@/features/auth/AuthContext";
import { TibetanText } from "@/lib/tibetan-render";
import { Badge } from "@/components/ui/badge";
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
      <div className="mx-auto w-full max-w-2xl p-4 py-6 space-y-5">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">Practice</h1>
          <p className="text-sm text-muted-foreground">
            Structured drills, level by level.
          </p>
        </div>

        <div className="space-y-2.5">
          {CURRICULUM.map((level) => (
            <LevelCard
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

function LevelCard({
  level,
  unlocked,
}: {
  level: CurriculumLevel;
  unlocked: boolean;
}) {
  const tone = LEVEL_TONE[level.tone];
  const openSections = level.sections.filter((s) => s.available).length;
  const lockedSections = level.sections.length - openSections;
  const progress = useLevelProgress(level.id);

  const body = (
    <>
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
          tone.tint,
        )}
      >
        {level.id}
      </span>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
          <h2 className={cn("font-heading font-semibold tracking-tight", tone.title)}>
            {level.title}
          </h2>
          {!unlocked && (
            <Lock
              className="h-3 w-3 text-muted-foreground shrink-0"
              aria-label="Locked"
            />
          )}
        </div>

        <div className="text-sm leading-[1.9] text-muted-foreground">
          <TibetanText text={level.summary} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={cn("h-auto py-0.5", tone.tint)}>
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

        {unlocked && level.sections.length > 0 && (
          <div className="pt-1 space-y-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  progress.complete
                    ? "bg-gradient-to-r from-sunrise to-sun"
                    : "bg-primary",
                )}
                style={{ width: `${Math.max(progress.percent, progress.done > 0 ? 3 : 0)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {progress.complete
                ? "Complete! 🎉"
                : progress.done > 0
                  ? `${progress.percent}% · ${progress.done} of ${progress.total} items`
                  : `${openSections} ${openSections === 1 ? "section" : "sections"} ready` +
                    (lockedSections > 0 ? ` · ${lockedSections} coming soon` : "")}
            </p>
          </div>
        )}
        {unlocked && level.sections.length === 0 && (
          <p className="text-[11px] text-muted-foreground pt-0.5">
            Unlocked — sections still being built
          </p>
        )}
      </div>
    </>
  );

  if (!unlocked) {
    return (
      <div className="flex gap-3 rounded-2xl border border-dashed border-border p-4 opacity-80">
        {body}
      </div>
    );
  }

  return (
    <Link
      to="/practice/$levelId"
      params={{ levelId: String(level.id) }}
      className="group flex gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/25"
    >
      {body}
      <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
