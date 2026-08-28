import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { useSfx } from "@/hooks/useSfx";
import { renderLatex } from "@/lib/latex";
import {
  answerGuestQuestion,
  getSnapshot,
  type GuestGame,
  type GuestSnapshot,
} from "@/lib/guest.engine";
import { getGuestGame } from "@/lib/guest.clientstore";
import { useServerFn } from "@tanstack/react-start";
import { recordGuestPlay } from "@/lib/guest.functions";

export const Route = createFileRoute("/guest/match")({
  validateSearch: (search: Record<string, unknown>) =>
    ({
      token: typeof search["token"] === "string" ? (search["token"] as string) : "",
    }) as { token: string },
  component: GuestMatch,
});

function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function GuestMatch() {
  const { token } = Route.useSearch();
  const { play } = useSfx();

  const gameRef = useRef<GuestGame | null>(null);
  const [mounted, setMounted] = useState(false);
  const [game, setGame] = useState<GuestGame | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [snap, setSnap] = useState<GuestSnapshot | null>(null);

  // Resolve the game on the client only (after mount). This avoids rendering
  // SSR markup from a server that has no client-side memory, and lets the game
  // be recovered from sessionStorage after a full page reload.
  useEffect(() => {
    setMounted(true);
    const g = getGuestGame(token);
    gameRef.current = g;
    setGame(g);
    setSnap(g ? getSnapshot(g) : null);
  }, [token]);

  // Refresh the snapshot on an interval + whenever a mutation happens.
  useEffect(() => {
    if (!gameRef.current) return;
    const t = setInterval(() => {
      if (gameRef.current) setSnap(getSnapshot(gameRef.current));
    }, 400);
    return () => clearInterval(t);
  }, []);

  // Countdown to the current round's deadline.
  useEffect(() => {
    if (!snap?.roundEndsAt || snap.status !== "active") {
      setRemaining(0);
      return;
    }
    const update = () => setRemaining((snap.roundEndsAt! - Date.now()) / 1000);
    update();
    const t = setInterval(update, 400);
    return () => clearInterval(t);
  }, [snap?.roundEndsAt, snap?.status]);

  // New question onboarding.
  const lastQ = useRef<number | null>(null);
  useEffect(() => {
    const idx = snap?.question?.index ?? null;
    if (idx === null || idx === lastQ.current) return;
    if (lastQ.current !== null) play("question");
    lastQ.current = idx;
    setSelected(null);
  }, [snap?.question?.index, play]);

  // Result fanfare + anonymous guest-play analytics, once per finished match.
  const guestFn = useServerFn(recordGuestPlay);
  const endedFor = useRef<string | null>(null);
  useEffect(() => {
    if (snap?.status !== "finished" || !snap.result || endedFor.current === token) return;
    endedFor.current = token;
    play(snap.result.outcome === "loss" ? "defeat" : "victory");
    guestFn({
      data: {
        token,
        mode: snap.mode,
        subject: snap.subject,
        correct: snap.result.myCorrect,
        total: snap.total,
      },
    }).catch(() => {});
  }, [snap?.status, snap?.result, token, play, guestFn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown ticks.
  useEffect(() => {
    if (remaining <= 0 || remaining > 30 || snap?.status !== "active") return;
    play(remaining <= 10 ? "final" : "tick");
  }, [Math.ceil(remaining), snap?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const stemHtml = useMemo(
    () => (snap?.question ? renderLatex(snap.question.stem) : ""),
    [snap?.question?.stem], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const optionsHtml = useMemo(
    () =>
      snap?.question
        ? snap.question.options.map((o) => ({ key: o.key, html: renderLatex(o.text) }))
        : [],
    [snap?.question?.options], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function confirm() {
    if (!selected || !snap?.question || pending || !gameRef.current) return;
    setPending(true);
    try {
      const res = answerGuestQuestion(
        gameRef.current,
        snap.question.index,
        selected as "A" | "B" | "C" | "D",
      );
      if (!res.ok) {
        play("error");
        toast.error(res.reason ?? "Answer rejected");
      } else if (res.isCorrect) {
        play("correct");
      } else {
        play("wrong");
      }
      setSelected(null);
      setSnap(getSnapshot(gameRef.current));
    } finally {
      setPending(false);
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <div className="px-6 py-32 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Starting your guest game…
          </p>
        </div>
      </div>
    );
  }

  if (!game || !snap) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <div className="px-6 py-32 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            This guest game is no longer available.
          </p>
          <Link
            to="/guest"
            onMouseEnter={() => play("hover")}
            className="cta-sweep mt-6 inline-block bg-primary px-8 py-3 font-mono text-sm uppercase tracking-widest text-primary-foreground"
          >
            Start a new game
          </Link>
        </div>
      </div>
    );
  }

  const data = snap;
  const total = data.total;

  if (data.status === "finished" && data.result) {
    const r = data.result;
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center gap-8 px-6 py-20 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Guest game · {data.mode === "solo" ? "Solo" : "vs Bot"}
          </div>
          <div className="flare relative animate-enter overflow-hidden border border-primary bg-surface p-12">
            <div className="relative z-10">
              <div className="impact-enter font-display text-7xl uppercase italic tracking-tighter text-primary sm:text-8xl">
                {data.mode === "solo"
                  ? "Complete"
                  : r.outcome === "win"
                    ? "Victory"
                    : r.outcome === "loss"
                      ? "Defeat"
                      : "Draw"}
              </div>
              <div className="ticker-enter mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground [animation-delay:400ms]">
                {data.mode === "solo"
                  ? `${data.name} scored ${r.myMarks} marks (${r.myCorrect}/${total} correct)`
                  : `${data.name} ${r.myMarks} — ${r.botMarks ?? 0} BOT marks`}
              </div>
              <div className="mt-8 h-px w-full bg-border" />
              <p className="ticker-enter mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground [animation-delay:500ms]">
                Nothing from this guest game was saved — no ELO, no leaderboard, no history. We
                count games anonymously.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Link
              to="/guest"
              onMouseEnter={() => play("hover")}
              className="cta-sweep bg-primary px-8 py-3 font-mono text-sm uppercase tracking-widest text-primary-foreground"
            >
              Play again
            </Link>
            <Link
              to="/auth"
              onMouseEnter={() => play("hover")}
              className="cta-sweep border border-primary px-8 py-3 font-mono text-sm uppercase tracking-widest text-primary"
            >
              Sign up for ranked
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl space-y-12 px-6 py-10">
        {/* VERSUS BAR */}
        <div className="wipe-enter flex items-center justify-between border-y border-border bg-surface/20 py-4">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full border border-border font-display uppercase">
              {data.name.slice(0, 1)}
            </div>
            <div>
              <div className="font-bold">{data.name}</div>
              <div className="font-mono text-[10px] text-primary">
                {data.me.correct}/{total} correct
              </div>
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
              {data.question
                ? `Q${data.question.index + 1} / ${total} · ${clock(data.secondsPerQuestion)}`
                : "Guest practice"}
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 text-right">
            <div>
              <div className="font-bold">{data.bot ? data.bot.name : "Solo"}</div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {data.bot ? `${data.bot.correct}/${total} correct` : "No opponent"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            {data.question ? (
              <>
                <div className="space-y-4">
                  <span className="ticker-enter block font-mono text-xs uppercase text-primary">
                    {data.question.subject} / {data.question.topic} / Q{data.question.index + 1}
                  </span>
                  <h1
                    className="mask-reveal max-w-[50ch] text-2xl font-medium leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: stemHtml }}
                  />
                </div>

                <div
                  key={`opts-${data.question.index}`}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                >
                  {optionsHtml.map((opt, i) => {
                    const mine = data.myChoice === opt.key;
                    const botPicked = data.bot && data.botChoice === opt.key;
                    return (
                      <button
                        key={opt.key}
                        disabled={!!data.myChoice}
                        onMouseEnter={() => play("hover")}
                        onFocus={() => play("hover")}
                        style={{ animationDelay: `${120 + i * 80}ms` }}
                        onClick={() => {
                          play("select");
                          setSelected(opt.key);
                        }}
                        className={`option-fill ticker-enter group border border-border p-6 text-left font-mono hover:border-primary disabled:opacity-80 ${
                          selected === opt.key || mine ? "border-primary bg-primary/10" : ""
                        }`}
                      >
                        <span className="mr-3 inline-block text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary">
                          {opt.key}.
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: opt.html }} />
                        {mine ? (
                          <span className="ml-2 text-[10px] uppercase text-primary">(you)</span>
                        ) : null}
                        {botPicked ? (
                          <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                            (bot)
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {selected && !data.myChoice ? (
                  <button
                    onClick={confirm}
                    disabled={pending}
                    onMouseEnter={() => play("hover")}
                    className="cta-sweep mt-4 w-full bg-primary py-4 font-mono text-sm uppercase tracking-widest text-primary-foreground disabled:opacity-50"
                  >
                    Confirm {selected}
                  </button>
                ) : null}

                {data.myChoice && (
                  <div className="animate-enter border border-primary/40 bg-primary/5 p-6 text-center font-mono text-xs uppercase tracking-[0.3em] text-primary">
                    Answer locked in — waiting for the round to close
                  </div>
                )}
              </>
            ) : (
              <div className="animate-enter border border-border bg-surface/40 p-12 text-center font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Starting your guest game…
              </div>
            )}
          </div>

          <div className="space-y-12 lg:col-span-4">
            <div className="space-y-4">
              <div className="flex items-end justify-between font-mono text-xs">
                <span className="text-muted-foreground">YOUR PROGRESS</span>
                <span>
                  {data.me.answered}/{total}
                </span>
              </div>
              <div className="relative h-2 overflow-hidden bg-surface">
                <div
                  className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-700"
                  style={{ width: `${(data.me.answered / total) * 100}%` }}
                />
              </div>
            </div>

            {data.bot ? (
              <div className="space-y-4">
                <div className="flex items-end justify-between font-mono text-xs">
                  <span className="text-muted-foreground">BOT PROGRESS</span>
                  <span>
                    {data.bot.answered}/{total}
                  </span>
                </div>
                <div className="relative h-2 overflow-hidden bg-surface">
                  <div
                    className="absolute inset-y-0 left-0 bg-foreground/40 transition-[width] duration-700"
                    style={{ width: `${(data.bot.answered / total) * 100}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="border-t border-border pt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Marks: <span className="impact-enter inline-block text-primary">{data.me.marks}</span>
              <span className="ml-2 text-muted-foreground/60">
                ({data.me.correct}/{total} correct)
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
