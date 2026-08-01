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
import { useSectionProgress } from "@/lib/progress";
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

function PracticeSectionsPage() {
  const { levelId } = Route.useParams();
  const { user } = useAuth();
  const level = getLevel(Number(levelId))!;

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
              Level {level.id}
            </p>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight">
              {level.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{level.focus}</p>
          </div>
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
                className="flex items-center gap-3 rounded-2xl border border-border p-4 opacity-55"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-heading font-bold tabular-nums text-muted-foreground">
                  {section.id}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-muted-foreground">
                    {section.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
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
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{section.title}</p>
        <p className="text-xs text-muted-foreground">{section.subtitle}</p>
        {progress.done > 0 && !progress.complete ? (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="h-1.5 flex-1 max-w-40 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {progress.done}/{progress.total}
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground mt-1">
            {progress.complete
              ? "Complete! 🎉"
              : [
                  section.itemCount > 0 && `${section.itemCount} items`,
                  ...section.drills,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
