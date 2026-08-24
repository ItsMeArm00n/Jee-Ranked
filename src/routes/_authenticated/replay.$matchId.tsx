import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { Avatar } from "@/components/Avatar";
import { AdminTag } from "@/components/AdminTag";
import { ReportQuestionDialog } from "@/components/report-question-dialog";
import { getMatchReplay } from "@/lib/game.functions";
import { renderLatex } from "@/lib/latex";
import { useSfx } from "@/hooks/useSfx";

export const Route = createFileRoute("/_authenticated/replay/$matchId")({
  component: ReplayPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-16 text-center font-mono text-xs uppercase tracking-widest">
      {error.message}
    </div>
  ),
});

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const SPEEDS = [1, 2, 4, 8] as const;

function ReplayPage() {
  const { matchId } = Route.useParams();
  const replayFn = useServerFn(getMatchReplay);
  const { play } = useSfx();

  const { data, isLoading, error } = useQuery({
    queryKey: ["replay", matchId],
    queryFn: () => replayFn({ data: { matchId } }),
    retry: false,
  });

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const raf = useRef<number | null>(null);
  const lastFired = useRef(-1);

  const duration = data?.durationMs ?? 0;

  // Playback loop
  useEffect(() => {
    if (!playing || !duration) return;
    let prev = performance.now();
    const step = (now: number) => {
      const dt = (now - prev) * speed;
      prev = now;
      setT((cur) => {
        const next = cur + dt;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, speed, duration]);

  const events = useMemo(
    () => (data?.events ?? []).slice().sort((a, b) => a.atMs - b.atMs),
    [data],
  );
  const past = useMemo(() => events.filter((e) => e.atMs <= t), [events, t]);

  // Fire sfx as the playhead crosses events
  useEffect(() => {
    if (!playing) return;
    const idx = past.length - 1;
    if (idx < 0 || idx === lastFired.current) return;
    if (idx < lastFired.current) {
      lastFired.current = idx;
      return;
    }
    lastFired.current = idx;
    const e = past[idx]!;
    play(e.side === "me" ? (e.isCorrect ? "correct" : "wrong") : "click");
  }, [past, playing, play]);

  const mine = useMemo(() => past.filter((e) => e.side === "me"), [past]);
  const theirs = useMemo(() => past.filter((e) => e.side === "opponent"), [past]);
  const current = useMemo(
    () =>
      events.filter((e) => e.side === "me").length
        ? Math.min((data?.total ?? 1) - 1, mine.length)
        : 0,
    [events, data?.total, mine.length],
  );
  const q = data?.questions[current];
  const myAnswerHere = events.find((e) => e.side === "me" && e.index === current);
  const oppAnswerHere = events.find((e) => e.side === "opponent" && e.index === current);

  const qStemHtml = useMemo(() => (q ? renderLatex(q.stem) : ""), [q?.stem]);
  const qOptionsHtml = useMemo(
    () => (q ? q.options.map((o) => ({ key: o.key, html: renderLatex(o.text) })) : []),
    [q?.options],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <div className="px-6 py-32 text-center font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Loading replay…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <div className="px-6 py-32 text-center font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {(error as Error | null)?.message ?? "Replay unavailable"}
        </div>
      </div>
    );
  }

  const myScore = mine.filter((e) => e.isCorrect).length;
  const oppScore = theirs.filter((e) => e.isCorrect).length;

  function seek(next: number) {
    setT(next);
    lastFired.current = events.filter((e) => e.atMs <= next).length - 1;
    play("scrub");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl space-y-10 px-6 py-10">
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
                Match replay
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
                      {data.opponent.isBot ? (
                        <span className="font-mono text-xs not-italic">BOT</span>
                      ) : null}
                    </>
                  ) : null}
                </span>
              </h1>
            </div>
          </div>
          <div className="text-right font-mono text-xs uppercase tracking-widest">
            <div className="text-muted-foreground">Final</div>
            <div className="text-2xl text-primary">
              {data.isSolo ? (
                "Complete"
              ) : (
                <>
                  {data.outcome === "win" ? "Victory" : data.outcome === "loss" ? "Defeat" : "Draw"}{" "}
                  <span className="text-foreground">
                    {data.delta >= 0 ? "+" : ""}
                    {data.delta}
                  </span>
                </>
              )}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {data.me.marks} — {data.opponent?.marks ?? 0} marks
            </div>
          </div>
        </div>

        {/* SCRUBBER */}
        <div className="space-y-4 border border-border bg-surface/40 p-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setPlaying((p) => {
                  play(p ? "pause" : "play");
                  return !p;
                });
                if (t >= duration) setT(0);
              }}
              onMouseEnter={() => play("hover")}
              className="cta-sweep bg-primary px-6 py-3 font-mono text-xs uppercase tracking-widest text-primary-foreground"
            >
              {playing ? "Pause" : t >= duration ? "Replay" : "Play"}
            </button>
            <div className="font-mono text-2xl tabular-nums">{clock(t)}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              / {clock(duration)}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSpeed(s);
                    play("toggle");
                  }}
                  className={`border px-3 py-1 font-mono text-[11px] transition-colors duration-200 ${
                    speed === s
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <input
              type="range"
              min={0}
              max={duration}
              step={100}
              value={Math.round(t)}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Scrub through the match timeline"
              className="w-full accent-[var(--color-primary,#ff5c1a)]"
            />
            <div className="pointer-events-none relative mt-1 h-6">
              {events.map((e, i) => (
                <span
                  key={`${e.side}-${e.index}-${i}`}
                  style={{ left: `${(e.atMs / duration) * 100}%` }}
                  className={`absolute top-0 -translate-x-1/2 ${
                    e.side === "me"
                      ? e.isCorrect
                        ? "text-primary"
                        : "text-destructive"
                      : "text-muted-foreground"
                  } ${e.atMs <= t ? "opacity-100" : "opacity-25"} transition-opacity duration-200`}
                >
                  <span className="block size-2 rotate-45 bg-current" />
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* LIVE STATE AT PLAYHEAD */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            {q ? (
              <div key={current} className="animate-enter border border-border bg-surface/30 p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-mono text-xs uppercase text-primary">
                        {q.subject} / {q.topic} / Q{q.index + 1}
                      </span>
                      <ReportQuestionDialog
                        questionId={q.id}
                        matchId={matchId}
                        questionIndex={q.index}
                      />
                    </div>
                    <h2
                      className="max-w-[55ch] text-xl font-medium leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: qStemHtml }}
                    />
                  </div>
                  <div className="shrink-0 space-y-1 text-right">
                    <div className="border border-primary bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                      Correct: {q.correct}
                    </div>
                    {myAnswerHere && (myAnswerHere.atMs ?? Infinity) <= t ? (
                      <div className="font-mono text-[10px] uppercase tracking-widest">
                        <span
                          className={myAnswerHere.isCorrect ? "text-success" : "text-destructive"}
                        >
                          {data.me.username}: {myAnswerHere.isCorrect ? "+4" : "−1"}
                        </span>
                        {oppAnswerHere && (oppAnswerHere.atMs ?? Infinity) <= t ? (
                          <>
                            <span className="text-muted-foreground/40"> / </span>
                            <span
                              className={
                                oppAnswerHere.isCorrect ? "text-success" : "text-destructive"
                              }
                            >
                              {data.opponent?.username ?? "Opp"}:{" "}
                              {oppAnswerHere.isCorrect ? "+4" : "−1"}
                            </span>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {qOptionsHtml.map((o) => {
                    const isCorrect = o.key === q.correct;
                    const isMine =
                      myAnswerHere?.choice === o.key && (myAnswerHere?.atMs ?? Infinity) <= t;
                    const isTheirs =
                      oppAnswerHere?.choice === o.key && (oppAnswerHere?.atMs ?? Infinity) <= t;
                    return (
                      <div
                        key={o.key}
                        className={`relative border p-4 font-mono text-sm transition-colors duration-300 ${
                          isCorrect
                            ? "border-primary bg-primary/10 text-primary"
                            : isMine
                              ? "border-destructive bg-destructive/5 text-destructive"
                              : isTheirs
                                ? "border-foreground/40 bg-foreground/5 text-foreground/70"
                                : "border-border text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="mr-2 font-bold">{o.key}.</span>
                            <span dangerouslySetInnerHTML={{ __html: o.html }} />
                          </div>
                          {isCorrect ? (
                            <span className="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-primary">
                              correct
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {isMine ? (
                            <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-destructive">
                              {data.me.username}
                            </span>
                          ) : null}
                          {isTheirs ? (
                            <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-foreground/60">
                              {data.opponent?.username ?? "opponent"}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Timeline
              </h3>
              {events.map((e, i) => (
                <button
                  key={`row-${i}`}
                  onClick={() => seek(e.atMs)}
                  className={`flex w-full items-center justify-between border border-border/60 px-4 py-2 text-left font-mono text-xs transition-all duration-300 hover:border-primary ${
                    e.atMs <= t ? "opacity-100" : "opacity-30"
                  }`}
                >
                  <span className="tabular-nums text-muted-foreground">{clock(e.atMs)}</span>
                  <span>
                    {e.side === "me" ? data.me.username : (data.opponent?.username ?? "Opponent")}
                  </span>
                  <span>Q{e.index + 1}</span>
                  <span className={e.isCorrect ? "text-primary" : "text-destructive"}>
                    {e.isCorrect ? "CORRECT" : "WRONG"}
                    {e.choice ? ` · ${e.choice}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-10 lg:col-span-4">
            <ProgressBlock
              label={`${data.me.username} — ${data.me.marks} marks`}
              answered={mine.length}
              total={data.total}
              accent="bg-primary"
            />
            {data.opponent ? (
              <ProgressBlock
                label={`${data.opponent.username} — ${data.opponent.marks} marks`}
                answered={theirs.length}
                total={data.total}
                accent="bg-foreground/40"
              />
            ) : null}
            <Link
              to="/play"
              className="block border border-foreground px-6 py-3 text-center font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:bg-foreground hover:text-background"
            >
              Queue again
            </Link>
            <Link
              to="/"
              className="block border border-border px-6 py-3 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
            >
              Back to lobby
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProgressBlock({
  label,
  answered,
  total,
  accent,
}: {
  label: string;
  answered: number;
  total: number;
  accent: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between font-mono text-xs">
        <span className="text-muted-foreground">{label.toUpperCase()}</span>
        <span key={answered} className="ticker-enter inline-block">
          {answered}/{total}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden bg-surface">
        <div
          className={`absolute inset-y-0 left-0 ${accent} transition-[width] duration-300 ease-out`}
          style={{ width: `${(answered / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
