import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { Avatar } from "@/components/Avatar";
import { AdminTag } from "@/components/AdminTag";
import { ReportQuestionDialog } from "@/components/report-question-dialog";
import { getMatchState, getQuestionExplanations } from "@/lib/game.functions";
import { renderLatex, wrapBareLatex } from "@/lib/latex";
import { useSfx } from "@/hooks/useSfx";

export const Route = createFileRoute("/_authenticated/review/$matchId")({
  component: ReviewPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-16 text-center font-mono text-xs uppercase tracking-widest">
      {error.message}
    </div>
  ),
});

function ReviewPage() {
  const { matchId } = Route.useParams();
  const stateFn = useServerFn(getMatchState);
  const explanationsFn = useServerFn(getQuestionExplanations);
  const { play } = useSfx();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [explanations, setExplanations] = useState<
    | {
        index: number;
        concepts: string[];
        formulas: string[];
        solution: string;
        whyWrong: Record<string, string>;
      }[]
    | null
  >(null);
  const [loadingExplanations, setLoadingExplanations] = useState(false);
  const fetchedRef = useRef(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["match-state", matchId],
    queryFn: () => stateFn({ data: { matchId } }),
    retry: false,
  });

  const questions = useMemo(() => data?.questionReview ?? [], [data]);

  useEffect(() => {
    if (!questions.length || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoadingExplanations(true);
    explanationsFn({
      data: {
        questions: questions.map((qr) => ({
          index: qr.index,
          subject: qr.subject,
          topic: qr.topic,
          stem: qr.stem,
          options: qr.options,
          correctOption: qr.correctOption,
          myChoice: qr.myChoice,
          myCorrect: qr.myCorrect,
        })),
      },
    })
      .then((result) => setExplanations(result.explanations))
      .catch(() => {})
      .finally(() => setLoadingExplanations(false));
  }, [questions, explanationsFn]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <div className="px-6 py-32 text-center font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Loading review…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <div className="px-6 py-32 text-center font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {(error as Error | null)?.message ?? "Review unavailable"}
        </div>
      </div>
    );
  }

  const total = questions.length;
  const qr = questions[currentIdx];
  const exp = explanations?.find((e) => e.index === qr?.index);

  function goNext() {
    if (currentIdx < total - 1) {
      play("click");
      setCurrentIdx((i) => i + 1);
    }
  }

  function goPrev() {
    if (currentIdx > 0) {
      play("click");
      setCurrentIdx((i) => i - 1);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl space-y-10 px-6 py-10">
        {/* HEADER */}
        <div className="wipe-enter flex flex-wrap items-end justify-between gap-6 border-b border-border pb-6">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              onMouseEnter={() => play("hover")}
              className="border border-border px-3 py-2 font-mono text-xs uppercase tracking-widest text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
            >
              ← Back
            </Link>
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Question review
              </span>
              <h1 className="mask-reveal font-display text-6xl uppercase italic leading-none tracking-tighter">
                <span className="flex flex-wrap items-center gap-3">
                  <Avatar url={data.me.avatar_url} name={data.me.username} size={40} />
                  {data.me.username}
                  {data.me.is_admin ? <AdminTag /> : null}
                  {data.opponent ? (
                    <>
                      <span className="text-primary">vs</span>
                      <Avatar
                        url={data.opponent.avatar_url}
                        name={data.opponent.username}
                        size={40}
                      />
                      {data.opponent.username}
                      {data.opponent.is_admin ? <AdminTag /> : null}
                    </>
                  ) : null}
                </span>
              </h1>
            </div>
          </div>
          <div className="text-right font-mono text-xs uppercase tracking-widest">
            <div className="text-muted-foreground">Final</div>
            <div className="text-2xl text-primary">
              {data.isSolo
                ? "Complete"
                : data.result?.outcome === "win"
                  ? "Victory"
                  : data.result?.outcome === "loss"
                    ? "Defeat"
                    : "Draw"}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {data.me.marks} marks · {data.me.correct}/{data.total} correct
            </div>
          </div>
        </div>

        {/* NAVIGATION BAR */}
        <div className="flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={currentIdx === 0}
            onMouseEnter={() => play("hover")}
            className="border border-border px-6 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary disabled:opacity-30 disabled:hover:translate-y-0 disabled:hover:border-border disabled:hover:text-foreground"
          >
            ← Previous
          </button>
          <div className="font-mono text-sm tabular-nums text-muted-foreground">
            Q{currentIdx + 1} / {total}
          </div>
          <button
            onClick={goNext}
            disabled={currentIdx === total - 1}
            onMouseEnter={() => play("hover")}
            className="border border-border px-6 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary disabled:opacity-30 disabled:hover:translate-y-0 disabled:hover:border-border disabled:hover:text-foreground"
          >
            Next →
          </button>
        </div>

        {/* QUESTION DOTS */}
        <div className="flex flex-wrap justify-center gap-2">
          {questions.map((q, i) => (
            <button
              key={q.index}
              onClick={() => {
                play("select");
                setCurrentIdx(i);
              }}
              onMouseEnter={() => play("hover")}
              className={`size-8 border font-mono text-[11px] transition-all duration-200 ${
                i === currentIdx
                  ? "border-primary bg-primary/10 text-primary"
                  : q.myCorrect
                    ? "border-success/50 bg-success/5 text-success"
                    : q.myMissed
                      ? "border-border text-muted-foreground"
                      : "border-destructive/50 bg-destructive/5 text-destructive"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* QUESTION + ANSWERS */}
        {qr ? (
          <div key={qr.index} className="animate-enter border border-border bg-surface/30 p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs uppercase text-primary">
                    {qr.subject} / {qr.topic} / Q{qr.index + 1}
                  </span>
                  <ReportQuestionDialog
                    questionId={qr.id}
                    matchId={matchId}
                    questionIndex={qr.index}
                  />
                </div>
                <h2
                  className="max-w-[55ch] text-xl font-medium leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderLatex(qr.stem) }}
                />
              </div>
              <div className="shrink-0 space-y-1 text-right">
                <div className="border border-success bg-success/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-success">
                  Correct: {qr.correctOption}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest">
                  <span
                    className={
                      qr.myCorrect
                        ? "text-success"
                        : qr.myMissed
                          ? "text-muted-foreground"
                          : "text-destructive"
                    }
                  >
                    {data.me.username}: {qr.myMissed ? "0" : qr.myCorrect ? "+4" : "−1"}
                  </span>
                  {!data.isSolo ? (
                    <>
                      <span className="text-muted-foreground/40"> / </span>
                      <span
                        className={
                          qr.oppCorrect
                            ? "text-success"
                            : qr.oppMissed
                              ? "text-muted-foreground"
                              : "text-destructive"
                        }
                      >
                        {data.opponent?.username ?? "Opp"}:{" "}
                        {qr.oppMissed ? "0" : qr.oppCorrect ? "+4" : "−1"}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {qr.options.map((o) => {
                const isCorrect = o.key === qr.correctOption;
                const isMine = o.key === qr.myChoice;
                const isTheirs = !data.isSolo && o.key === qr.oppChoice;
                return (
                  <div
                    key={o.key}
                    className={`relative border p-4 font-mono text-sm transition-colors duration-300 ${
                      isCorrect
                        ? "border-success bg-success/10 text-success"
                        : isMine
                          ? "border-destructive bg-destructive/5 text-destructive"
                          : isTheirs
                            ? "border-foreground/40 bg-foreground/5 text-foreground/70"
                            : "border-border text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: `<span class="mr-2 font-bold">${o.key}.</span>${renderLatex(o.text)}`,
                        }}
                      />
                      {isCorrect ? (
                        <span className="shrink-0 rounded bg-success/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-success">
                          correct
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {isMine && !qr.myMissed ? (
                        <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-destructive">
                          {data.me.username}
                        </span>
                      ) : null}
                      {isTheirs && !qr.oppMissed ? (
                        <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-foreground/60">
                          {data.opponent?.username ?? "opponent"}
                        </span>
                      ) : null}
                      {isMine && qr.myMissed ? (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-destructive">
                          {data.me.username} — no answer
                        </span>
                      ) : null}
                      {isTheirs && qr.oppMissed ? (
                        <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-foreground/60">
                          {data.opponent?.username ?? "opponent"} — no answer
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* AI EXPLANATION */}
        {loadingExplanations && !exp ? (
          <div className="border border-primary/20 bg-primary/5 p-8">
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="relative">
                <div className="ai-pulse-ring absolute inset-0 rounded-full bg-primary/20" />
                <div
                  className="ai-pulse-ring absolute inset-0 rounded-full bg-primary/10"
                  style={{ animationDelay: "0.5s" }}
                />
                <div className="relative flex size-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                  <svg
                    className="size-8 text-primary ai-icon-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L9.5 8.5 3 12l6.5 3.5L12 22l2.5-6.5L21 12l-6.5-3.5Z" />
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                  </svg>
                </div>
              </div>
              <div className="text-center space-y-2">
                <div className="font-display text-2xl uppercase italic tracking-tighter text-primary">
                  AI is thinking
                </div>
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Generating explanations for {questions.length} questions…
                </div>
              </div>
              <div className="flex gap-1.5">
                <span className="ai-dot size-2 rounded-full bg-primary" />
                <span
                  className="ai-dot size-2 rounded-full bg-primary"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="ai-dot size-2 rounded-full bg-primary"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            </div>
          </div>
        ) : exp ? (
          <div className="animate-enter space-y-6 border border-primary/30 bg-primary/5 p-8">
            <h3 className="font-display text-2xl uppercase italic tracking-tighter text-primary">
              Explanation
            </h3>

            {exp.concepts.length > 0 ? (
              <div>
                <h4 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-primary">
                  Key Concepts
                </h4>
                <div className="flex flex-wrap gap-2">
                  {exp.concepts.map((c, i) => (
                    <span
                      key={i}
                      className="rounded border border-primary/30 bg-primary/5 px-2 py-1 font-mono text-[11px] text-primary"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {exp.formulas.length > 0 ? (
              <div>
                <h4 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-primary">
                  Formulas
                </h4>
                <div className="space-y-2">
                  {exp.formulas.map((f, i) => (
                    <div
                      key={i}
                      className="border-l-2 border-primary/40 bg-primary/5 px-4 py-2 text-sm text-foreground/80"
                      dangerouslySetInnerHTML={{ __html: renderLatex(wrapBareLatex(f)) }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <h4 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-primary">
                Step-by-step Solution
              </h4>
              <div
                className="text-sm leading-relaxed text-foreground/80"
                dangerouslySetInnerHTML={{ __html: renderLatex(exp.solution) }}
              />
            </div>

            {Object.keys(exp.whyWrong).length > 0 ? (
              <div>
                <h4 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-destructive">
                  Why other options are wrong
                </h4>
                <div className="space-y-2">
                  {Object.entries(exp.whyWrong).map(([opt, reason]) => (
                    <div key={opt} className="flex gap-2 text-sm">
                      <span className="shrink-0 font-bold text-destructive">{opt}.</span>
                      <span
                        className="text-foreground/70"
                        dangerouslySetInnerHTML={{ __html: renderLatex(reason) }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* BOTTOM NAVIGATION */}
        <div className="flex items-center justify-between border-t border-border pt-6">
          <button
            onClick={goPrev}
            disabled={currentIdx === 0}
            onMouseEnter={() => play("hover")}
            className="border border-border px-6 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary disabled:opacity-30 disabled:hover:translate-y-0 disabled:hover:border-border disabled:hover:text-foreground"
          >
            ← Previous
          </button>
          <div className="font-mono text-xs tabular-nums text-muted-foreground">
            {currentIdx + 1} of {total}
          </div>
          <button
            onClick={goNext}
            disabled={currentIdx === total - 1}
            onMouseEnter={() => play("hover")}
            className="border border-border px-6 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary disabled:opacity-30 disabled:hover:translate-y-0 disabled:hover:border-border disabled:hover:text-foreground"
          >
            Next →
          </button>
        </div>

        {/* SIDEBAR LINKS */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Link
            to="/replay/$matchId"
            params={{ matchId }}
            onMouseEnter={() => play("hover")}
            className="block border border-primary px-6 py-3 text-center font-mono text-xs uppercase tracking-widest text-primary transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/10"
          >
            Watch replay
          </Link>
          <Link
            to="/play"
            onMouseEnter={() => play("hover")}
            className="block border border-foreground px-6 py-3 text-center font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:bg-foreground hover:text-background"
          >
            Queue again
          </Link>
          <Link
            to="/"
            onMouseEnter={() => play("hover")}
            className="block border border-border px-6 py-3 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
          >
            Back to lobby
          </Link>
        </div>
      </main>
    </div>
  );
}
