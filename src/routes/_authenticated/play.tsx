import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import {
  findMatch,
  findUnrankedMatch,
  getMatchState,
  getMyProfile,
  leaveQueue,
  matchWithBot,
  unrankedWithBot,
} from "@/lib/game.functions";
import { useSfx } from "@/hooks/useSfx";

export const Route = createFileRoute("/_authenticated/play")({
  component: PlayPage,
});

type GameMode = null | "ranked" | "unranked";
type UnrankedSubject = "Physics" | "Chemistry" | "Mathematics" | "All";
type UnrankedPlayMode = "solo" | "random";

function PlayPage() {
  const navigate = useNavigate();
  const findRanked = useServerFn(findMatch);
  const findUnranked = useServerFn(findUnrankedMatch);
  const cancel = useServerFn(leaveQueue);
  const state = useServerFn(getMatchState);
  const profileFn = useServerFn(getMyProfile);
  const rankedBot = useServerFn(matchWithBot);
  const unrankedBot = useServerFn(unrankedWithBot);
  const { play } = useSfx();

  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [subject, setSubject] = useState<UnrankedSubject>("All");
  const [playMode, setPlayMode] = useState<UnrankedPlayMode>("solo");
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(120);
  const [unrankedReady, setUnrankedReady] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(false);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn({}) });

  // Ranked flow
  useEffect(() => {
    if (gameMode !== "ranked" || started.current) return;
    started.current = true;
    setSearching(true);
    play("queue");
    findRanked({})
      .then((res) => {
        if (res.status === "active") {
          play("matched");
          navigate({ to: "/match/$matchId", params: { matchId: res.matchId } });
          return;
        }
        setMatchId(res.matchId);
      })
      .catch(() => {
        toast.error("Could not join matchmaking");
        setSearching(false);
      });
  }, [gameMode, findRanked, navigate, play]);

  // Unranked flow
  useEffect(() => {
    if (gameMode !== "unranked" || !unrankedReady || started.current) return;
    started.current = true;
    setSearching(true);
    play("queue");
    findUnranked({
      data: {
        subject,
        mode: playMode,
        secondsPerQuestion: playMode === "solo" ? secondsPerQuestion : undefined,
      },
    })
      .then((res) => {
        if (res.status === "active") {
          play("matched");
          navigate({ to: "/match/$matchId", params: { matchId: res.matchId } });
          return;
        }
        setMatchId(res.matchId);
      })
      .catch(() => {
        toast.error("Could not join matchmaking");
        setSearching(false);
      });
  }, [
    gameMode,
    unrankedReady,
    subject,
    playMode,
    secondsPerQuestion,
    findUnranked,
    navigate,
    play,
  ]);

  // No human opponent after 30s — drop in a bot.
  const botTried = useRef(false);
  useEffect(() => {
    if (!matchId || elapsed < 30 || botTried.current) return;
    botTried.current = true;
    play("whoosh");
    const botFn = gameMode === "ranked" ? rankedBot : unrankedBot;
    botFn({ data: { matchId } }).catch(() => {
      /* the poller keeps looking for a human */
    });
  }, [matchId, elapsed, gameMode, rankedBot, unrankedBot, play]);

  // Poll for match start.
  useEffect(() => {
    if (!matchId) return;
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000);
    const poll = setInterval(async () => {
      try {
        const s = await state({ data: { matchId } });
        if (s.status === "active" || s.status === "finished") {
          play("matched");
          navigate({ to: "/match/$matchId", params: { matchId } });
        }
      } catch {
        /* keep waiting */
      }
    }, 1500);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [matchId, state, navigate, play]);

  async function abort() {
    play("cancel");
    if (matchId) await cancel({ data: { matchId } });
    setGameMode(null);
    setUnrankedReady(false);
    setMatchId(null);
    setSearching(false);
    setElapsed(0);
    started.current = false;
    botTried.current = false;
  }

  function selectMode(mode: GameMode) {
    play("click");
    setGameMode(mode);
  }

  function startUnranked() {
    play("click");
    started.current = false;
    botTried.current = false;
    setElapsed(0);
    setUnrankedReady(true);
  }

  // ── Mode selection screen ──
  if (!gameMode) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-10 px-6 py-20 text-center">
          <div className="animate-enter">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Choose your mode
            </div>
            <h1 className="mask-reveal mt-4 font-display text-6xl uppercase italic leading-none tracking-tighter sm:text-7xl">
              <span>
                Pick a <span className="text-primary">game mode</span>
              </span>
            </h1>
          </div>

          <div className="flex w-full max-w-md flex-col gap-4 [animation-delay:200ms]">
            <button
              onClick={() => selectMode("ranked")}
              onMouseEnter={() => play("hover")}
              onFocus={() => play("hover")}
              className="cta-sweep group border border-primary bg-primary/10 p-8 text-left transition-all duration-400 hover:-translate-y-1 hover:bg-primary/20 hover:shadow-[0_0_32px_-8px_var(--color-primary)]"
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                Competitive
              </div>
              <div className="mt-2 font-display text-3xl uppercase italic tracking-tighter transition-all duration-300 group-hover:tracking-normal">
                Ranked
              </div>
              <div className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                10 questions · 2 min each · ELO on the line
              </div>
            </button>

            <button
              onClick={() => selectMode("unranked")}
              onMouseEnter={() => play("hover")}
              onFocus={() => play("hover")}
              className="cta-sweep group border border-border p-8 text-left transition-all duration-400 hover:-translate-y-1 hover:border-primary hover:text-primary hover:shadow-[0_0_32px_-8px_var(--color-primary)]"
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-colors duration-300 group-hover:text-primary">
                Practice
              </div>
              <div className="mt-2 font-display text-3xl uppercase italic tracking-tighter transition-all duration-300 group-hover:tracking-normal">
                Unranked
              </div>
              <div className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                No ELO change · pick subjects & time
              </div>
            </button>
          </div>

          <div className="wipe-enter flex w-full max-w-md items-center justify-between border-y border-border bg-surface/40 px-6 py-5 font-mono text-sm [animation-delay:400ms]">
            <span className="text-muted-foreground uppercase">Your rating</span>
            <span className="text-primary">{profile.data ? `${profile.data.elo} ELO` : "—"}</span>
          </div>
        </main>
      </div>
    );
  }

  // ── Unranked config screen ──
  if (gameMode === "unranked" && !unrankedReady) {
    const subjects: { value: UnrankedSubject; label: string }[] = [
      { value: "All", label: "All Subjects" },
      { value: "Physics", label: "Physics" },
      { value: "Chemistry", label: "Chemistry" },
      { value: "Mathematics", label: "Mathematics" },
    ];
    const modes: { value: UnrankedPlayMode; label: string; desc: string }[] = [
      { value: "solo", label: "Solo", desc: "Practice Solo" },
      { value: "random", label: "Random", desc: "Play vs a stranger" },
    ];

    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-10 px-6 py-20 text-center">
          <div className="animate-enter">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Unranked practice
            </div>
            <h1 className="mask-reveal mt-4 font-display text-5xl uppercase italic leading-none tracking-tighter sm:text-6xl">
              <span>
                Set up your <span className="text-primary">practice</span>
              </span>
            </h1>
          </div>

          {/* Subject picker */}
          <div className="w-full max-w-md space-y-3 [animation-delay:100ms]">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Subject
            </div>
            <div className="grid grid-cols-2 gap-3">
              {subjects.map((s) => (
                <button
                  key={s.value}
                  onClick={() => {
                    play("select");
                    setSubject(s.value);
                    if (s.value !== "All" && playMode === "random") setPlayMode("solo");
                  }}
                  onMouseEnter={() => play("hover")}
                  className={`border p-4 font-mono text-sm uppercase tracking-widest transition-all duration-400 hover:-translate-y-0.5 ${
                    subject === s.value
                      ? "border-primary bg-primary/10 text-primary shadow-[0_0_20px_-6px_var(--color-primary)]"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Play mode picker */}
          <div className="w-full max-w-md space-y-3 [animation-delay:200ms]">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Opponent
            </div>
            <div className="grid grid-cols-2 gap-3">
              {modes.map((m) => {
                const disabled = subject !== "All" && m.value === "random";
                return (
                  <button
                    key={m.value}
                    onClick={() => {
                      if (disabled) return;
                      play("select");
                      setPlayMode(m.value);
                    }}
                    onMouseEnter={() => play("hover")}
                    disabled={disabled}
                    className={`border p-4 text-left transition-all duration-300 ${
                      disabled
                        ? "cursor-not-allowed border-border/40 opacity-40"
                        : playMode === m.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div
                      className={`font-mono text-sm uppercase tracking-widest ${playMode === m.value && !disabled ? "text-primary" : ""}`}
                    >
                      {m.label}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {disabled ? "Solo only for single subject" : m.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time per question — solo only */}
          {playMode === "solo" && (
            <div className="w-full max-w-md space-y-3 [animation-delay:300ms]">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Time per question
                </div>
                <div className="font-mono text-sm tabular-nums text-primary">
                  {Math.floor(secondsPerQuestion / 60)}:
                  {String(secondsPerQuestion % 60).padStart(2, "0")}
                </div>
              </div>
              <input
                type="range"
                min={30}
                max={300}
                step={15}
                value={secondsPerQuestion}
                onChange={(e) => setSecondsPerQuestion(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>0:30</span>
                <span>5:00</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex w-full max-w-md gap-4 [animation-delay:400ms]">
            <button
              onClick={abort}
              onMouseEnter={() => play("hover")}
              onFocus={() => play("hover")}
              className="flex-1 border border-border px-6 py-3 font-mono text-sm uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
            >
              Back
            </button>
            <button
              onClick={startUnranked}
              onMouseEnter={() => play("hover")}
              onFocus={() => play("hover")}
              className="cta-sweep flex-1 bg-primary px-6 py-3 font-mono text-sm uppercase tracking-widest text-primary-foreground"
            >
              Start
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Searching / matchmaking screen (ranked & unranked random) ──
  const isSoloUnranked = gameMode === "unranked" && playMode === "solo";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-10 px-6 py-20 text-center">
        {/* Heading */}
        <div className="animate-enter">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            {isSoloUnranked
              ? "Solo practice"
              : `${gameMode === "ranked" ? "Ranked" : "Unranked"} matchmaking`}
          </div>
          <h1 className="mask-reveal mt-4 font-display text-6xl uppercase italic leading-none tracking-tighter sm:text-7xl">
            <span>
              {isSoloUnranked ? (
                <>
                  Starting your <span className="text-primary">practice</span>
                </>
              ) : (
                <>
                  Searching for <span className="text-primary">an opponent</span>
                </>
              )}
            </span>
          </h1>
        </div>

        {/* Radar + scanning animation */}
        {!isSoloUnranked && (
          <div className="radar flex size-24 items-center justify-center rounded-full border border-border">
            <div className="size-3 rotate-45 bg-primary" />
          </div>
        )}

        {/* Your rating bar */}
        <div className="wipe-enter flex w-full max-w-md items-center justify-between border-y border-border bg-surface/40 px-6 py-5 font-mono text-sm [animation-delay:200ms]">
          <span className="text-muted-foreground uppercase">Your rating</span>
          <span className="text-primary">{profile.data ? `${profile.data.elo} ELO` : "—"}</span>
        </div>

        {/* Timer with animated border */}
        {!isSoloUnranked && (
          <div
            className="timer-border relative px-8 py-3 [animation-delay:300ms]"
            style={{ animation: "scale-in 0.5s var(--ease-out-expo) 0.3s both" }}
          >
            <div className="font-mono text-5xl tabular-nums timer-pulse">
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
            </div>
          </div>
        )}

        {/* Status message with pulsing dots */}
        <p className="ticker-enter max-w-sm font-mono text-xs uppercase tracking-widest text-muted-foreground [animation-delay:350ms]">
          {isSoloUnranked
            ? "Loading your match…"
            : gameMode === "ranked"
              ? searching
                ? elapsed >= 25
                  ? "No human in the arena — dropping in a ranked bot opponent…"
                  : "You will be paired with the next ranked player who queues. 10 questions, 2 shared minutes on each."
                : "Matchmaking unavailable"
              : searching
                ? elapsed >= 25
                  ? "No human found — dropping in a practice bot…"
                  : `Searching for a random opponent · ${subject === "All" ? "All subjects" : subject}`
                : "Matchmaking unavailable"}
        </p>

        {/* Searching indicator dots */}
        {!isSoloUnranked && searching && elapsed < 25 && (
          <div className="flex items-center gap-2 [animation-delay:500ms]" style={{ animation: "fade-up 0.5s var(--ease-out-expo) 0.5s both" }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="size-1.5 rounded-full bg-primary"
                style={{
                  animation: `dot-live 1.4s ease-in-out ${i * 0.3}s infinite`,
                }}
              />
            ))}
          </div>
        )}

        {/* Cancel button */}
        <button
          onClick={abort}
          onMouseEnter={() => play("hover")}
          onFocus={() => play("hover")}
          className="focus-ring border border-border px-8 py-3 font-mono text-sm uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
          style={{ animation: "fade-up 0.5s var(--ease-out-expo) 0.6s both" }}
        >
          {isSoloUnranked ? "Cancel" : "Cancel search"}
        </button>
      </main>
    </div>
  );
}
