import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import {
  QUESTIONS,
  PHASE_LABELS,
  PHASE_NAMES,
  type Phase,
  type QuizQuestion,
} from "./quiz-data";
import {
  phaseTotal,
  routeToLevel,
  savePlacement,
  NON_READER_CEILING,
  PHASE_PASS_MARK,
  scoreAnswers,
  submitPlacement,
  type PhaseScores,
} from "./routing";
import { CURRICULUM, getLevel } from "@/lib/curriculum";
import { useAuth } from "@/features/auth/AuthContext";
import { LEVEL_TONE } from "@/lib/level-tone";
import { TibetanText } from "@/lib/tibetan-render";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Screen = "intro" | "heritage" | "quiz" | "result";

export function PlacementQuiz() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [heritage, setHeritage] = useState(false);

  const restart = () => {
    setScreen("intro");
    setIndex(0);
    setAnswers({});
    setHeritage(false);
  };

  const finish = () => setScreen("result");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl p-4 space-y-4">
        {screen === "intro" && (
          <IntroScreen onStart={() => setScreen("heritage")} />
        )}

        {screen === "heritage" && (
          <HeritageScreen
            onAnswer={(isHeritage) => {
              setHeritage(isHeritage);
              setScreen("quiz");
            }}
          />
        )}

        {screen === "quiz" && (
          <QuizScreen
            index={index}
            answers={answers}
            onAnswer={(questionId, optionId) =>
              setAnswers((prev) =>
                prev[questionId] ? prev : { ...prev, [questionId]: optionId },
              )
            }
            onNext={() =>
              index < QUESTIONS.length - 1 ? setIndex(index + 1) : finish()
            }
          />
        )}

        {screen === "result" && (
          <ResultScreen
            answers={answers}
            heritage={heritage}
            onRestart={restart}
          />
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────── intro

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Find your starting point
        </h1>
        <p className="text-sm text-muted-foreground">
          3 phases · {QUESTIONS.length} questions · about 4 minutes. Your
          answers route you directly to the right level.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CURRICULUM.map((level) => (
          <div
            key={level.id}
            className={cn(
              "rounded-lg px-3 py-2.5",
              LEVEL_TONE[level.tone].tint,
            )}
          >
            <p className="text-sm font-medium">Level {level.id}</p>
            <p className="text-xs opacity-80">{level.title}</p>
          </div>
        ))}
      </div>

      <Button onClick={onStart} className="gap-2">
        Start quiz
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────── heritage

/**
 * Speaking and reading are independent, so the gate asks about both. Only
 * speaking sets the flag: reading is measured directly by Phase 1, and a
 * self-report the quiz is about to test is not worth acting on.
 */
const SPEAKER_OPTIONS = [
  { label: "Yes — I speak and read Tibetan", speaks: true },
  { label: "Yes — I speak Tibetan but can't read it", speaks: true },
  { label: "No — I'm starting from scratch", speaks: false },
];

function HeritageScreen({
  onAnswer,
}: {
  onAnswer: (heritage: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="space-y-1.5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Before we begin
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          Can you speak Tibetan already?
        </h1>
        <p className="text-sm text-muted-foreground">
          If you speak Tibetan, the script lessons in Level 1 are skipped and
          the quiz places you on your grammar instead.
        </p>
      </div>

      <div className="space-y-2">
        {SPEAKER_OPTIONS.map((option) => (
          <Button
            key={option.label}
            variant="outline"
            className="w-full justify-start h-auto py-3 text-left"
            onClick={() => onAnswer(option.speaks)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────── quiz

interface QuizScreenProps {
  index: number;
  answers: Record<string, string>;
  onAnswer: (questionId: string, optionId: string) => void;
  onNext: () => void;
}

function QuizScreen({ index, answers, onAnswer, onNext }: QuizScreenProps) {
  const question = QUESTIONS[index];
  const picked = answers[question.id];
  const answered = !!picked;
  const wasCorrect = question.options.find((o) => o.id === picked)?.correct;
  const isLast = index === QUESTIONS.length - 1;
  const progress = (Object.keys(answers).length / QUESTIONS.length) * 100;

  return (
    <div className="space-y-3">
      <div className="h-1 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-[oklch(0.5_0.16_275)] transition-[width] duration-300 dark:bg-[oklch(0.72_0.13_275)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-2">
        <Badge className={cn("h-auto py-0.5", LEVEL_TONE.indigo.tint)}>
          {PHASE_NAMES[question.phase]}
        </Badge>
        <span className="text-xs text-muted-foreground tabular-nums">
          Q{index + 1} of {QUESTIONS.length}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        {/* p1q3 keeps ཚེག inline in the prompt, so this needs the same
            Tibetan-aware rendering the hint and feedback get. */}
        <div className="text-base font-medium leading-[1.9]">
          <TibetanText text={question.question} />
        </div>

        {question.subject && (
          <div className="rounded-lg bg-muted/40 px-4 py-7 text-center">
            <p className="font-tibetan text-4xl leading-[1.7] sm:text-5xl">
              {question.subject}
            </p>
          </div>
        )}

        {/* Any Tibetan left inline gets the Tibetan face — it would otherwise
            fall back to the Latin sans and render as boxes or tofu. */}
        <div className="text-xs leading-[1.9] text-muted-foreground">
          <TibetanText text={question.hint} />
        </div>
      </div>

      <div className="space-y-2">
        {question.options.map((option, i) => (
          <OptionRow
            key={option.id}
            letter={String.fromCharCode(65 + i)}
            option={option}
            answered={answered}
            picked={picked === option.id}
            onClick={() => onAnswer(question.id, option.id)}
          />
        ))}
      </div>

      {answered && (
        <>
          <div className="rounded-lg bg-muted/50 px-3.5 py-3 text-sm leading-[1.9] text-muted-foreground">
            <TibetanText
              text={
                wasCorrect ? question.feedback.pass : question.feedback.fail
              }
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={onNext} className="gap-2">
              {isLast ? "See your result" : "Next question"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

interface OptionRowProps {
  letter: string;
  option: QuizQuestion["options"][number];
  answered: boolean;
  picked: boolean;
  onClick: () => void;
}

function OptionRow({
  letter,
  option,
  answered,
  picked,
  onClick,
}: OptionRowProps) {
  // Once answered, the correct option is always highlighted — including when
  // the learner picked something else, so the feedback text has a referent.
  const showCorrect = answered && option.correct;
  const showWrong = answered && picked && !option.correct;

  return (
    <button
      onClick={onClick}
      disabled={answered}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
        showCorrect && "border-green-500 bg-green-500/10",
        showWrong && "border-destructive/50 bg-destructive/5",
        answered && !showCorrect && !showWrong && "border-border opacity-50",
        !answered &&
          "border-border hover:bg-accent hover:border-accent-foreground/20",
      )}
    >
      <span
        className={cn(
          "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border text-[11px]",
          showCorrect && "border-green-600 bg-green-600 text-white",
          showWrong && "border-destructive bg-destructive text-white",
          !showCorrect && !showWrong && "border-border text-muted-foreground",
        )}
      >
        {letter}
      </span>

      <span
        className={cn(
          "flex-1 text-sm",
          option.tibetan && "font-tibetan text-xl leading-[1.9]",
          showCorrect && "text-green-700 dark:text-green-400",
          showWrong && "text-destructive",
        )}
      >
        {option.text}
      </span>

      {picked &&
        (option.correct ? (
          <Check className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
        ) : (
          <X className="h-4 w-4 shrink-0 text-destructive" />
        ))}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────── result

interface ResultScreenProps {
  answers: Record<string, string>;
  heritage: boolean;
  onRestart: () => void;
}

function ResultScreen({ answers, heritage, onRestart }: ResultScreenProps) {
  const { user, setUser } = useAuth();
  const scores = scoreAnswers(answers);
  const placedLevel = routeToLevel(scores, heritage);
  const [saving, setSaving] = useState(true);
  const [saveFailed, setSaveFailed] = useState(false);

  // Persist once when the result is reached — never during render. The local
  // copy is a cache; the account level is what actually unlocks levels.
  useEffect(() => {
    savePlacement(placedLevel, scores, heritage);
    if (!user) return;

    let cancelled = false;
    submitPlacement(user.id, placedLevel)
      .then((updated) => {
        if (!cancelled) setUser(updated);
      })
      .catch(() => {
        if (!cancelled) setSaveFailed(true);
      })
      .finally(() => {
        if (!cancelled) setSaving(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const level = getLevel(placedLevel)!;
  const tone = LEVEL_TONE[level.tone];
  // The script phase is only forgiven when a speaker actually failed it.
  const skippedScript = heritage && scores.p1 < PHASE_PASS_MARK;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Quiz complete
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your starting point
          </h1>
        </div>

        <div className={cn("rounded-xl px-5 py-4", tone.tint)}>
          <p className="text-xl font-semibold">Level {level.id}</p>
          <p className="text-sm opacity-80">{level.title}</p>
        </div>

        {skippedScript && (
          <p className="text-sm text-muted-foreground">
            Heritage speaker — Level 1 script lessons skipped, and your grammar
            answers placed you here.
            {placedLevel === NON_READER_CEILING &&
              " Level 5 stays closed until you can read: its specialist tracks are built on classical and cursive texts."}{" "}
            Reading is still worth catching up on — Level 1 is open whenever you
            want it.
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          {saveFailed
            ? "Could not save your result — levels stay locked until this reaches your account. Retake the quiz when you are back online."
            : `Levels 1–${placedLevel} are now unlocked on your account.`}
        </p>

        {saveFailed && (
          <p className="text-xs text-destructive">
            Saving failed. Check the tutor server is running.
          </p>
        )}

        <div className="grid grid-cols-3 gap-2">
          {([1, 2, 3] as Phase[]).map((phase) => (
            <PhaseTile
              key={phase}
              phase={phase}
              score={scores[`p${phase}` as keyof PhaseScores]}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRestart} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Retake quiz
          </Button>
          {/* `disabled` does not reach an anchor through Slot, so while the
              result is still saving this is a real button, not a link. */}
          {saving || saveFailed ? (
            <Button disabled className="gap-2">
              {saving ? "Saving…" : "Not saved"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button asChild className="gap-2">
              <Link to="/practice">
                Go to Practice
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium mb-1">All 5 levels</p>
        {CURRICULUM.map((s, i) => {
          const here = s.id === placedLevel;
          return (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-2.5 py-2.5",
                i < CURRICULUM.length - 1 && "border-b border-border",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  here ? LEVEL_TONE[s.tone].tint : "bg-border",
                )}
              />
              <span
                className={cn(
                  "text-sm",
                  here
                    ? cn("font-medium", LEVEL_TONE[s.tone].title)
                    : "text-foreground",
                )}
              >
                Level {s.id}
              </span>
              <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
                {s.title}
              </span>
              {here && (
                <Badge
                  className={cn(
                    "h-auto shrink-0 py-0.5",
                    LEVEL_TONE[s.tone].tint,
                  )}
                >
                  You are here
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PhaseTile({ phase, score }: { phase: Phase; score: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-3 text-center">
      <p className="text-[11px] text-muted-foreground">Phase {phase}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {score}/{phaseTotal(phase)}
      </p>
      <p className="text-[11px] text-muted-foreground">{PHASE_LABELS[phase]}</p>
    </div>
  );
}
