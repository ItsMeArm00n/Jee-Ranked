import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { getMatchState, submitAnswer } from "@/lib/game.functions";
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
  const [pending, setPending] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const { play } = useSfx();
  const lastOpp = useRef(0);
  const endedFor = useRef<string | null>(null);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => state({ data: { matchId } }),
    refetchInterval: (q) => (q.state.data?.status === "finished" ? false : 1500),
  });

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
  }, [data?.question?.index, play]);

  // Correct-answer streak.
  const streak = useRef(0);
  async function pick(choice: string, index: number) {
    setPending(choice);
    try {
      play("select");
      const res = await answer({ data: { matchId, index, choice: choice as "A" | "B" | "C" | "D" } });
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
      await refetch();
    } catch {
      play("error");
      toast.error("Could not submit answer");
    } finally {
      setPending(null);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <div className="px-6 py-32 text-center font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Loading duel…
        </div>
      </div>
    );
  }

  const total = data.total;
  const myPct = (data.me.answered / total) * 100;
  const oppPct = data.opponent ? (data.opponent.answered / total) * 100 : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl space-y-12 px-6 py-10">
        {/* VERSUS BAR */}
        <div className="wipe-enter flex items-center justify-between border-y border-border bg-surface/20 py-4">
          <div className="flex w-1/3 items-center gap-4">
            <div className="size-12 bg-surface transition-transform duration-500 hover:-skew-x-12" />
            <div className="ticker-enter [animation-delay:150ms]">
              <div className="font-bold">{data.me.username}</div>
              <div className="font-mono text-[10px] text-primary">{data.me.elo} ELO</div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div
              className={`font-mono text-4xl font-bold tabular-nums transition-transform duration-300 ${
                remaining < 30 ? "timer-pulse scale-110" : ""
              }`}
            >
              {clock(remaining)}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {data.question ? `Q${data.question.index + 1} / ${data.total} · 2 min shared` : "Shared timer"}
            </div>
          </div>

          <div className="flex w-1/3 items-center justify-end gap-4 text-right">
            <div className="ticker-enter [animation-delay:150ms]">
              <div className="font-bold">{data.opponent?.username ?? "—"}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{data.opponent?.elo ?? "—"} ELO</div>
            </div>
            <div className="size-12 bg-surface transition-transform duration-500 hover:skew-x-12" />
          </div>
        </div>


        {data.status === "finished" && data.result ? (
          <div className="flare relative animate-enter overflow-hidden border border-primary bg-surface p-12">
            <div className="absolute top-0 right-0 h-full w-64 -skew-x-12 translate-x-32 bg-primary/5" />
            <div className="relative z-10">
              <div className="impact-enter font-display text-7xl uppercase italic tracking-tighter text-primary sm:text-8xl">
                {data.result.outcome === "win" ? "Victory" : data.result.outcome === "loss" ? "Defeat" : "Draw"}
              </div>
              <div className="ticker-enter mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground [animation-delay:400ms]">
                {data.me.username} {data.result.myScore} — {data.result.oppScore} {data.opponent?.username ?? "—"}
              </div>
              <div className="mt-8 flex items-center gap-12">
                <div className="ticker-enter [animation-delay:550ms]">
                  <p className="mb-1 font-mono text-xs uppercase text-muted-foreground">New ELO</p>
                  <div className="font-display text-5xl">{data.result.newElo}</div>
                </div>
                <div className="ticker-enter flex items-center gap-2 text-primary [animation-delay:700ms]">
                  <span className="font-mono text-2xl">
                    {data.result.delta >= 0 ? "+" : ""}
                    {data.result.delta}
                  </span>
                  <div className="size-4 rotate-45 bg-primary transition-transform duration-500 hover:rotate-[135deg]" />
                </div>
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
                  onClick={() => play("click")}
                  className="cta-sweep border border-primary px-8 py-3 font-mono text-sm uppercase tracking-widest text-primary"
                >
                  Watch replay
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
                    <span className="ticker-enter block font-mono text-xs uppercase text-primary">
                      {data.question.subject} / {data.question.topic} / Q{data.question.index + 1}
                    </span>
                    <h1 className="mask-reveal max-w-[50ch] text-2xl font-medium leading-relaxed">
                      <span>{data.question.stem}</span>
                    </h1>
                  </div>

                  <div key={`opts-${data.question.index}`} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {data.question.options.map((opt, i) => (
                      <button
                        key={opt.key}
                        disabled={pending !== null}
                        onMouseEnter={() => play("hover")}
                        onFocus={() => play("hover")}
                        style={{ animationDelay: `${120 + i * 80}ms` }}
                        onClick={() => pick(opt.key, data.question!.index)}
                        className={`option-fill ticker-enter group border border-border p-6 text-left font-mono hover:border-primary disabled:opacity-50 ${
                          pending === opt.key ? "border-primary bg-primary/10" : ""
                        }`}
                      >
                        <span className="mr-3 inline-block text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary">
                          {opt.key}.
                        </span>
                        {opt.text}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="animate-enter border border-border bg-surface/40 p-12 text-center font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {data.status === "waiting"
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

              <div className="border-t border-border pt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Correct so far:{" "}
                <span key={data.me.correct} className="impact-enter inline-block text-primary">
                  {data.me.correct}
                </span>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
