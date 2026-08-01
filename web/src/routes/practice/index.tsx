import { Link, createFileRoute } from "@tanstack/react-router";
import { Lock, ChevronRight } from "lucide-react";
import {
  CURRICULUM,
  type CurriculumLevel,
  type StageTone,
} from "@/lib/curriculum";
import { TibetanText } from "@/lib/tibetan-render";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/practice/")({
  component: PracticeLevelsPage,
});

/** Per-stage accent. `tint` backs the number badge and the capability chip. */
const TONE: Record<StageTone, { tint: string; title: string }> = {
  indigo: {
    tint: "bg-[oklch(0.94_0.03_275)] text-[oklch(0.42_0.14_275)] dark:bg-[oklch(0.3_0.06_275)] dark:text-[oklch(0.83_0.11_275)]",
    title: "text-[oklch(0.45_0.16_275)] dark:text-[oklch(0.78_0.12_275)]",
  },
  green: {
    tint: "bg-[oklch(0.93_0.04_155)] text-[oklch(0.4_0.1_155)] dark:bg-[oklch(0.29_0.05_155)] dark:text-[oklch(0.82_0.1_155)]",
    title: "text-[oklch(0.42_0.11_155)] dark:text-[oklch(0.77_0.11_155)]",
  },
  amber: {
    tint: "bg-[oklch(0.94_0.04_75)] text-[oklch(0.44_0.09_60)] dark:bg-[oklch(0.3_0.05_70)] dark:text-[oklch(0.84_0.09_75)]",
    title: "text-[oklch(0.45_0.1_60)] dark:text-[oklch(0.79_0.1_75)]",
  },
  violet: {
    tint: "bg-[oklch(0.94_0.035_300)] text-[oklch(0.43_0.14_300)] dark:bg-[oklch(0.3_0.06_300)] dark:text-[oklch(0.83_0.11_300)]",
    title: "text-[oklch(0.46_0.16_300)] dark:text-[oklch(0.79_0.12_300)]",
  },
};

function PracticeLevelsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl p-4 space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Practice</h1>
        </div>

        <div className="space-y-2.5">
          {CURRICULUM.map((level) => (
            <StageCard key={level.id} level={level} />
          ))}
        </div>

        <p className="text-xs text-muted-foreground/70">
          CEFR bands are approximate — Tibetan's script-only opening has no CEFR
          equivalent. Hours are a rough guide, not a target.
        </p>
      </div>
    </div>
  );
}

function StageCard({ level }: { level: CurriculumLevel }) {
  const tone = TONE[level.tone];
  const openSections = level.sections.filter((s) => s.available).length;
  const lockedSections = level.sections.length - openSections;

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
          <h2 className={cn("font-semibold tracking-tight", tone.title)}>
            {level.title}
          </h2>
          <span className="text-xs text-muted-foreground">
            ≈ CEFR {level.cefr}
          </span>
          {!level.available && (
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

        {level.available && (
          <p className="text-[11px] text-muted-foreground pt-0.5">
            {openSections} {openSections === 1 ? "section" : "sections"} ready
            {lockedSections > 0 && ` · ${lockedSections} coming soon`}
          </p>
        )}
      </div>
    </>
  );

  if (!level.available) {
    return (
      <div className="flex gap-3 rounded-xl border border-dashed border-border p-4">
        {body}
      </div>
    );
  }

  return (
    <Link
      to="/practice/$levelId"
      params={{ levelId: String(level.id) }}
      className="group flex gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40"
    >
      {body}
      <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
