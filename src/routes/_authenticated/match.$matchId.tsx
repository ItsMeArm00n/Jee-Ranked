import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { Avatar } from "@/components/Avatar";
import { ReportQuestionDialog } from "@/components/report-question-dialog";
import { getMatchState, submitAnswer, forfeitMatch, confirmActive } from "@/lib/game.functions";
import { renderLatex } from "@/lib/latex";
import { useSfx } from "@/hooks/useSfx";

export const Route = createFileRoute("/_authenticated/match/$matchId")({
  component: MatchPage,
});

function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function MatchPage() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const state = useServerFn(getMatchState);
  const answer = useServerFn(submitAnswer);
  const forfeitFn = useServerFn(forfeitMatch);
  const hereFn = useServerFn(confirmActive);
  const [pending, setPending] = useState<string | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [afkLeft, setAfkLeft] = useState(0);
  const [reportHint, setReportHint] = useState(true);
  const { play } = useSfx();
  const lastOpp = useRef(0);
  const endedFor = useRef<string | null>(null);

  // Per-round result overlay.
  const [showResult, setShowResult] = useState(false);
  const lastResultIdx = useRef<number | null>(null);

  const { data, refetch, isLoading, isError } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => state({ data: { matchId } }),
    refetchInterval: (q) => (q.state.data?.status === "finished" ? false : 1500),
    retry: 3,
  });

  useEffect(() => {
    if (data?.status !== "active") {
      setShowResult(false);
      return;
    }
    const ri = data.lastResult?.index ?? null;
    if (ri === null || ri === lastResultIdx.current) return;
    lastResultIdx.current = ri;
    setShowResult(true);
  }, [data?.lastResult, data?.status]);
  useEffect(() => {
    if (!showResult || !data) return;
    play(data.lastResult?.mine.correct ? "correct" : "wrong");
    const t = setTimeout(() => setShowResult(false), 4000);
    return () => clearTimeout(t);
  }, [showResult]);

  // Per-question shared clock: falls back to the match clock when between questions.
  const deadline = data?.questionEndsAt ?? data?.endsAt ?? null;
  useEffect(() => {
    if (!deadline || !data?.serverNow) return;
    const drift = Date.now() - new Date(data.serverNow).getTime();
    const update = () => setRemaining((new Date(deadline).getTime() - (Date.now() - drift)) / 1000);
    update();
    const t = setInterval(update, 500);
    return () => clearInterval(t);
  }, [deadline, data?.serverNow]);

  // Anti-AFK countdown until the auto-forfeit fires.
  const afkForfeit = data?.afk?.flagged ? (data.afk.forfeitAt ?? null) : null;
  useEffect(() => {
    if (!afkForfeit || !data?.serverNow) {
      setAfkLeft(0);
      return;
    }
    const drift = Date.now() - new Date(data.serverNow).getTime();
    const update = () => setAfkLeft((new Date(afkForfeit).getTime() - (Date.now() - drift)) / 1000);
    update();
    const t = setInterval(update, 500);
    return () => clearInterval(t);
  }, [afkForfeit, data?.serverNow]);

  // Warn sound when the anti-AFK flag first appears.
  const lastAfk = useRef(false);
  useEffect(() => {
    const flagged = !!data?.afk?.flagged;
    if (flagged && !lastAfk.current) play("warn");
    lastAfk.current = flagged;
  }, [data?.afk?.flagged, play]);

  // Opponent answered — subtle cue.
  useEffect(() => {
    const answered = data?.opponent?.answered ?? 0;
    if (answered > lastOpp.current) play("opponent");
    lastOpp.current = answered;
  }, [data?.opponent?.answered, play]);

  // Result fanfare, once — then the ELO swing.
  useEffect(() => {
    if (data?.status !== "finished" || !data.result) return;
    if (endedFor.current === matchId) return;
    endedFor.current = matchId;
    if (data.isSolo) {
      play("victory");
      return;
    }
    play(data.result.outcome === "loss" ? "defeat" : "victory");
    const delta = data.result.delta;
    const t = setTimeout(() => play(delta >= 0 ? "elo_up" : "elo_down"), 900);
    return () => clearTimeout(t);
  }, [data?.status, data?.result, matchId, play]);

  // Countdown: soft ticks in the last 30s, hard "final" beeps in the last 10.
  useEffect(() => {
    if (remaining <= 0 || remaining > 30 || data?.status !== "active") return;
    play(remaining <= 10 ? "final" : "tick");
  }, [Math.ceil(remaining), data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // New question on screen.
  const lastQ = useRef<number | null>(null);
  useEffect(() => {
    const idx = data?.question?.index ?? null;
    if (idx === null || idx === lastQ.current) return;
    if (lastQ.current !== null) play("question");
    lastQ.current = idx;
    setSelectedChoice(null);
  }, [data?.question?.index, play]);

  // Coach-mark: point at the report button when the match's first question
  // appears; auto-dismiss after a few seconds (or on click).
  const showReportHint = reportHint && !!data?.question;
  useEffect(() => {
    if (!showReportHint) return;
    const t = setTimeout(() => setReportHint(false), 8000);
    return () => clearTimeout(t);
  }, [showReportHint]);

  // Correct-answer streak.
  const streak = useRef(0);
  function selectChoice(choice: string) {
    play("select");
    setSelectedChoice(choice);
  }

  async function confirmAnswer() {
    if (!selectedChoice || !data?.question || pending) return;
    setPending(selectedChoice);
    try {
      const res = await answer({
        data: {
          matchId,
          index: data.question.index,
          choice: selectedChoice as "A" | "B" | "C" | "D",
        },
      });
      if (!res.ok) {
        play("error");
        toast.error(res.reason ?? "Answer rejected");
      } else if (res.isCorrect) {
        streak.current += 1;
        play(streak.current >= 3 ? "streak" : "correct");
      } else {
        streak.current = 0;
        play("wrong");
      }
      setSelectedChoice(null);
      await refetch();
    } catch (e: unknown) {
      play("error");
      const msg = e instanceof Error ? e.message : "Could not submit answer";
      toast.error(msg);
    } finally {
      setPending(null);
    }
  }

  async function doForfeit() {
    setConfirmForfeit(false);
    play("cancel");
    try {
      const res = await forfeitFn({ data: { matchId } });
      if (!res.ok) {
        play("error");
        toast.error(res.reason ?? "Could not forfeit");
      }
      await refetch();
    } catch {
      play("error");
      toast.error("Could not forfeit");
    }
  }

  async function confirmHere() {
    play("click");
    try {
      await hereFn({ data: { matchId } });
      await refetch();
    } catch {
      play("error");
      toast.error("Could not confirm");
    }
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        {isError ? (
          <div className="px-6 py-32 text-center">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Could not load this match
            </div>
            <Link
              to="/play"
              className="cta-sweep mt-6 inline-block border border-primary bg-primary/10 px-8 py-3 font-mono text-sm uppercase tracking-widest text-primary transition-all hover:bg-primary/20"
            >
              Back to Play
            </Link>
          </div>
        ) : (
          <div className="px-6 py-32 text-center font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Loading duel…
          </div>
        )}
      </div>
    );
  }

  const total = data.total;
  const myPct = (data.me.answered / total) * 100;
  const oppPct = data.opponent ? (data.opponent.answered / total) * 100 : 0;

  const stemHtml = useMemo(
    () => (data.question ? renderLatex(data.question.stem) : ""),
    [data.question?.stem],
  );
  const optionsHtml = useMemo(
    () =>
      data.question
        ? data.question.options.map((o) => ({ key: o.key, html: renderLatex(o.text) }))
        : [],
    [data.question?.options],
  );
  const resultStemHtml = useMemo(
    () => (data.lastResult?.stem ? renderLatex(data.lastResult.stem) : ""),
    [data.lastResult?.stem],
  );
  const resultOptionsHtml = useMemo(
    () =>
      data.lastResult
        ? data.lastResult.options.map((o) => ({ key: o.key, html: renderLatex(o.text) }))
        : [],
    [data.lastResult?.options],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl space-y-12 px-6 py-10">
        {/* VERSUS BAR */}
        <div className="wipe-enter flex items-center justify-between border-y border-border bg-surface/20 py-4">
          <div className={`flex items-center gap-4 ${data.isSolo ? "w-full" : "w-1/3"}`}>
            <Avatar
              url={data.me.avatar_url}
              name={data.me.username}
              size={48}
              className="border border-border"
            />
            <div className="ticker-enter [animation-delay:150ms]">
              <div className="font-bold">{data.me.username}</div>
              <div className="font-mono text-[10px] text-primary">{data.me.elo} ELO</div>
            </div>
          </div>

          {!data.isSolo && (
            <div className="flex flex-col items-center gap-1">
              <div
                className={`font-mono text-4xl font-bold tabular-nums transition-transform duration-300 ${
                  remaining < 30 ? "timer-pulse scale-110" : ""
                }`}
              >
                {clock(remaining)}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {data.question
                  ? `Q${data.question.index + 1} / ${data.total} · ${clock(data.secondsPerQuestion)} shared`
                  : "Shared timer"}
              </div>
            </div>
          )}

          {data.isSolo && (
            <div className="flex flex-col items-center gap-1">
              <div
                className={`font-mono text-4xl font-bold tabular-nums transition-transform duration-300 ${
                  remaining < 30 ? "timer-pulse scale-110" : ""
                }`}
              >
                {clock(remaining)}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {data.question
                  ? `Q${data.question.index + 1} / ${data.total} · ${clock(data.secondsPerQuestion)} per question`
                  : "Solo practice"}
              </div>
            </div>
          )}

          {!data.isSolo && (
            <div className="flex w-1/3 items-center justify-end gap-4 text-right">
              <div className="ticker-enter [animation-delay:150ms]">
                <div className="font-bold">{data.opponent?.username ?? "—"}</div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {data.opponent?.elo ?? "—"} ELO
                </div>
              </div>
              <Avatar
                url={data.opponent?.avatar_url ?? null}
                name={data.opponent?.username ?? "?"}
                size={48}
                className="border border-border"
              />
            </div>
          )}
        </div>

        {data.status === "finished" && data.result ? (
          <div className="flare relative animate-enter overflow-hidden border border-primary bg-surface p-12">
            <div className="absolute top-0 right-0 h-full w-64 -skew-x-12 translate-x-32 bg-primary/5" />
            <div className="relative z-10">
              <div className="impact-enter font-display text-7xl uppercase italic tracking-tighter text-primary sm:text-8xl">
                {data.isSolo
                  ? "Complete"
                  : data.result.outcome === "win"
                    ? "Victory"
                    : data.result.outcome === "loss"
                      ? "Defeat"
                      : "Draw"}
              </div>
              <div className="ticker-enter mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground [animation-delay:400ms]">
                {data.isSolo
                  ? `${data.me.username} scored ${data.result.myMarks} marks (${data.result.myScore}/${data.total} correct)`
                  : `${data.me.username} ${data.result.myMarks} — ${data.result.oppMarks} ${data.opponent?.username ?? "—"} marks`}
              </div>
              {data.forfeitedByMe || data.forfeitReason ? (
                <div className="ticker-enter mt-2 font-mono text-[10px] uppercase tracking-widest text-destructive [animation-delay:460ms]">
                  {data.forfeitedByMe
                    ? data.forfeitReason === "afk"
                      ? "You were forfeited for inactivity"
                      : "You forfeited"
                    : data.forfeitReason === "afk"
                      ? `${data.opponent?.username ?? "Opponent"} was forfeited for inactivity`
                      : `${data.opponent?.username ?? "Opponent"} forfeited`}
                </div>
              ) : null}
              <div className="mt-8 flex items-center gap-12">
                {data.isRanked ? (
                  <>
                    <div className="ticker-enter [animation-delay:550ms]">
                      <p className="mb-1 font-mono text-xs uppercase text-muted-foreground">
                        New ELO
                      </p>
                      <div className="font-display text-5xl">{data.result.newElo}</div>
                    </div>
                    <div className="ticker-enter flex items-center gap-2 text-primary [animation-delay:700ms]">
                      <span className="font-mono text-2xl">
                        {data.result.delta >= 0 ? "+" : ""}
                        {data.result.delta}
                      </span>
                      <div className="size-4 rotate-45 bg-primary transition-transform duration-500 hover:rotate-[135deg]" />
                    </div>
                  </>
                ) : (
                  <div className="ticker-enter [animation-delay:550ms]">
                    <p className="mb-1 font-mono text-xs uppercase text-muted-foreground">
                      Practice match
                    </p>
                    <div className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
                      No ELO change
                    </div>
                  </div>
                )}
              </div>
              <div className="ticker-enter mt-12 flex flex-wrap gap-4 [animation-delay:850ms]">
                <button
                  onMouseEnter={() => play("hover")}
                  onClick={() => {
                    play("whoosh");
                    navigate({ to: "/play" });
                  }}
                  className="cta-sweep bg-primary px-8 py-3 font-mono text-sm uppercase tracking-widest text-primary-foreground"
                >
                  Queue again
                </button>
                <Link
                  to="/replay/$matchId"
                  params={{ matchId }}
                  onMouseEnter={() => play("hover")}
                  className="cta-sweep border border-primary px-8 py-3 font-mono text-sm uppercase tracking-widest text-primary"
                >
                  Watch replay
                </Link>
                <Link
                  to="/review/$matchId"
                  params={{ matchId }}
                  onMouseEnter={() => play("hover")}
                  className="cta-sweep border border-primary px-8 py-3 font-mono text-sm uppercase tracking-widest text-primary"
                >
                  Review questions
                </Link>
                <Link
                  to="/"
                  className="border border-foreground px-8 py-3 font-mono text-sm uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:bg-foreground hover:text-background"
                >
                  Return to lobby
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="space-y-8 lg:col-span-8">
              {data.question ? (
                <>
                  <div key={data.question.index} className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="ticker-enter block font-mono text-xs uppercase text-primary">
                        {data.question.subject} / {data.question.topic} / Q{data.question.index + 1}
                      </span>
                      <ReportQuestionDialog
                        questionId={data.question.id}
                        matchId={matchId}
                        questionIndex={data.question.index}
                        hint={showReportHint}
                        onHintDismiss={() => setReportHint(false)}
                      />
                    </div>
                    <h1
                      className="mask-reveal max-w-[50ch] text-2xl font-medium leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: stemHtml }}
                    />
                  </div>

                  <div
                    key={`opts-${data.question.index}`}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                  >
                    {optionsHtml.map((opt, i) => (
                      <button
                        key={opt.key}
                        disabled={pending !== null || data.waitingForOpponent}
                        onMouseEnter={() => play("hover")}
                        onFocus={() => play("hover")}
                        style={{ animationDelay: `${120 + i * 80}ms` }}
                        onClick={() => selectChoice(opt.key)}
                        className={`option-fill ticker-enter group border border-border p-6 text-left font-mono hover:border-primary disabled:opacity-50 ${
                          selectedChoice === opt.key
                            ? "border-primary bg-primary/10"
                            : data.myChoice === opt.key
                              ? "border-primary bg-primary/10"
                              : ""
                        }`}
                      >
                        <span className="mr-3 inline-block text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary">
                          {opt.key}.
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: opt.html }} />
                      </button>
                    ))}
                  </div>

                  {selectedChoice && !data.waitingForOpponent && !data.myChoice ? (
                    <button
                      onClick={confirmAnswer}
                      onMouseEnter={() => play("hover")}
                      onFocus={() => play("hover")}
                      disabled={pending !== null}
                      className="cta-sweep mt-4 w-full bg-primary py-4 font-mono text-sm uppercase tracking-widest text-primary-foreground transition-all disabled:opacity-50"
                    >
                      Confirm {selectedChoice}
                    </button>
                  ) : null}

                  {data.waitingForOpponent ? (
                    <div className="animate-enter border border-primary/40 bg-primary/5 p-6 text-center font-mono text-xs uppercase tracking-[0.3em] text-primary">
                      Answer locked in — waiting for your opponent to answer this question
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="animate-enter border border-border bg-surface/40 p-12 text-center font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {data.isSolo
                    ? "All questions answered!"
                    : data.status === "waiting"
                      ? "Waiting for an opponent to join…"
                      : "All questions answered — waiting for your opponent's clock to run out."}
                </div>
              )}
            </div>

            <div className="space-y-12 lg:col-span-4">
              <div className="space-y-4">
                <div className="flex items-end justify-between font-mono text-xs">
                  <span className="text-muted-foreground">YOUR PROGRESS</span>
                  <span key={data.me.answered} className="ticker-enter inline-block">
                    {data.me.answered}/{total}
                  </span>
                </div>
                <div className="relative h-2 overflow-hidden bg-surface">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{ width: `${myPct}%` }}
                  >
                    <div className="bar-live absolute inset-0" />
                  </div>
                </div>
              </div>

              {!data.isSolo && (
                <div className="space-y-4 opacity-50 transition-opacity duration-300 hover:opacity-80">
                  <div className="flex items-end justify-between font-mono text-xs">
                    <span className="text-muted-foreground">OPPONENT PROGRESS</span>
                    <span key={data.opponent?.answered ?? 0} className="ticker-enter inline-block">
                      {data.opponent?.answered ?? 0}/{total}
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden bg-surface">
                    <div
                      className="absolute inset-y-0 left-0 bg-foreground/40 transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      style={{ width: `${oppPct}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Marks:{" "}
                <span key={data.me.correct} className="impact-enter inline-block text-primary">
                  {data.me.marks}
                </span>
                <span className="ml-2 text-muted-foreground/60">
                  ({data.me.correct}/{data.total} correct)
                </span>
              </div>

              {data.status === "active" && !data.isSolo ? (
                <button
                  onMouseEnter={() => play("hover")}
                  onFocus={() => play("hover")}
                  onClick={() => {
                    play("click");
                    setConfirmForfeit(true);
                  }}
                  className="mt-8 w-full border border-border px-6 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-destructive hover:text-destructive"
                >
                  Forfeit duel
                </button>
              ) : null}
            </div>
          </div>
        )}
      </main>

      {showResult && data.lastResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-lg border border-border bg-surface p-8 scale-in">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Round result · Q{data.lastResult.index + 1}
            </div>

            {resultStemHtml ? (
              <p
                className="mt-4 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: resultStemHtml }}
              />
            ) : null}

            <div className="mt-6 space-y-2">
              {resultOptionsHtml.map((o) => {
                const isCorrect = o.key === data.lastResult!.correctOption;
                const isMine = o.key === data.lastResult!.mine.choice;
                const isTheirs = data.lastResult!.theirs
                  ? o.key === data.lastResult!.theirs.choice
                  : false;
                return (
                  <div
                    key={o.key}
                    className={`border p-3 font-mono text-xs transition-colors ${
                      isCorrect
                        ? "border-success bg-success/10 text-success"
                        : isMine && !isCorrect
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    <span className="mr-2 font-bold">{o.key}.</span>
                    <span dangerouslySetInnerHTML={{ __html: o.html }} />
                    {isMine && !data.lastResult!.mine.missed ? (
                      <span className="ml-2 text-[10px] uppercase">(your pick)</span>
                    ) : null}
                    {isTheirs && !data.lastResult!.theirs!.missed ? (
                      <span className="ml-2 text-[10px] uppercase">
                        ({data.opponent?.username ?? "opponent"})
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-widest">
                <span className="text-muted-foreground">You</span>
                <span
                  className={`font-bold ${
                    data.lastResult.mine.correct ? "text-success" : "text-destructive"
                  }`}
                >
                  {data.lastResult.mine.missed
                    ? "No answer"
                    : data.lastResult.mine.correct
                      ? "Right"
                      : "Wrong"}
                </span>
              </div>
              {data.lastResult.theirs ? (
                <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-widest">
                  <span className="text-muted-foreground">
                    {data.opponent?.username ?? "Opponent"}
                  </span>
                  <span
                    className={`font-bold ${
                      data.lastResult.theirs.correct ? "text-success" : "text-destructive"
                    }`}
                  >
                    {data.lastResult.theirs.missed
                      ? "No answer"
                      : data.lastResult.theirs.correct
                        ? "Right"
                        : "Wrong"}
                  </span>
                </div>
              ) : null}
            </div>

            <button
              onClick={() => setShowResult(false)}
              className="cta-sweep mt-8 w-full bg-primary py-3 font-mono text-xs uppercase tracking-widest text-primary-foreground"
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {data.status === "active" && data.afk?.flagged ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-6 backdrop-blur-sm">
          <div className="animate-enter w-full max-w-md border border-destructive/60 bg-surface p-8 text-center">
            <div className="timer-pulse mx-auto size-12">
              <div className="size-full rotate-45 border border-destructive" />
            </div>
            <h2 className="mask-reveal mt-6 font-display text-4xl uppercase italic leading-none tracking-tighter">
              <span>Are you still there?</span>
            </h2>
            <p className="mt-4 font-mono text-xs uppercase leading-relaxed tracking-widest text-muted-foreground">
              You haven't answered the open question. If you don't confirm within{" "}
              <span className="tabular-nums text-destructive">{clock(afkLeft)}</span>, the duel will
              be forfeited automatically.
            </p>
            <button
              onClick={confirmHere}
              onMouseEnter={() => play("hover")}
              onFocus={() => play("hover")}
              className="cta-sweep mt-8 w-full bg-primary py-3 font-mono text-xs uppercase tracking-widest text-primary-foreground"
            >
              Yes, I'm here
            </button>
          </div>
        </div>
      ) : null}

      {confirmForfeit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="animate-enter w-full max-w-md border border-border bg-surface p-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Forfeit duel
            </div>
            <p className="mt-4 text-lg leading-relaxed">
              You'll forfeit this duel and{" "}
              <span className="text-primary">{data.opponent?.username ?? "your opponent"}</span>{" "}
              takes the win. This counts as a loss.
            </p>
            <div className="mt-8 flex gap-4">
              <button
                onClick={() => setConfirmForfeit(false)}
                onMouseEnter={() => play("hover")}
                onFocus={() => play("hover")}
                className="flex-1 border border-border px-6 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground"
              >
                Keep playing
              </button>
              <button
                onClick={doForfeit}
                onMouseEnter={() => play("hover")}
                onFocus={() => play("hover")}
                className="flex-1 border border-destructive px-6 py-3 font-mono text-xs uppercase tracking-widest text-destructive transition-all duration-300 hover:-translate-y-0.5 hover:bg-destructive hover:text-background"
              >
                Forfeit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
