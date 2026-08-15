import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { Avatar } from "@/components/Avatar";
import { getMatchReplay } from "@/lib/game.functions";
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
    play(e.side === "me" ? (e.isCorrect ? "correct" : "wrong") : "opponent");
  }, [past, playing, play]);

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

  const mine = past.filter((e) => e.side === "me");
  const theirs = past.filter((e) => e.side === "opponent");
  const myScore = mine.filter((e) => e.isCorrect).length;
  const oppScore = theirs.filter((e) => e.isCorrect).length;
  const current = events.filter((e) => e.side === "me").length
    ? Math.min(data.total - 1, mine.length)
    : 0;
  const q = data.questions[current];
  const myAnswerHere = events.find((e) => e.side === "me" && e.index === current);

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
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Match replay
            </span>
            <h1 className="mask-reveal font-display text-6xl uppercase italic leading-none tracking-tighter">
              <span className="flex flex-wrap items-center gap-3">
                <Avatar url={data.me.avatar_url} name={data.me.username} size={40} />
                {data.me.username}
                <span className="text-primary">vs</span>
                <Avatar url={data.opponent.avatar_url} name={data.opponent.username} size={40} />
                {data.opponent.username}
                {data.opponent.isBot ? (
                  <span className="font-mono text-xs not-italic">BOT</span>
                ) : null}
              </span>
            </h1>
          </div>
          <div className="text-right font-mono text-xs uppercase tracking-widest">
            <div className="text-muted-foreground">Final</div>
            <div className="text-2xl text-primary">
              {data.outcome === "win" ? "Victory" : data.outcome === "loss" ? "Defeat" : "Draw"}{" "}
              <span className="text-foreground">
                {data.delta >= 0 ? "+" : ""}
                {data.delta}
              </span>
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
              <div
                key={current}
                className="animate-enter space-y-4 border border-border bg-surface/30 p-8"
              >
                <span className="font-mono text-xs uppercase text-primary">
                  {q.subject} / {q.topic} / Q{q.index + 1}
                </span>
                <h2 className="max-w-[55ch] text-xl font-medium leading-relaxed">{q.stem}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {q.options.map((o) => {
                    const isCorrect = o.key === q.correct;
                    const isMine =
                      myAnswerHere?.choice === o.key && (myAnswerHere?.atMs ?? Infinity) <= t;
                    return (
                      <div
                        key={o.key}
                        className={`border p-4 font-mono text-sm transition-colors duration-300 ${
                          isMine && !isCorrect
                            ? "border-destructive text-destructive"
                            : isCorrect && mine.some((m) => m.index === current)
                              ? "border-primary text-primary"
                              : "border-border text-muted-foreground"
                        }`}
                      >
                        <span className="mr-3">{o.key}.</span>
                        {o.text}
                        {isMine ? (
                          <span className="ml-2 text-[10px] uppercase">your pick</span>
                        ) : null}
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
                  <span>{e.side === "me" ? data.me.username : data.opponent.username}</span>
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
              label={`${data.me.username} — ${myScore} correct`}
              answered={mine.length}
              total={data.total}
              accent="bg-primary"
            />
            <ProgressBlock
              label={`${data.opponent.username} — ${oppScore} correct`}
              answered={theirs.length}
              total={data.total}
              accent="bg-foreground/40"
            />
            <Link
              to="/play"
              className="block border border-foreground px-6 py-3 text-center font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:bg-foreground hover:text-background"
            >
              Queue again
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
