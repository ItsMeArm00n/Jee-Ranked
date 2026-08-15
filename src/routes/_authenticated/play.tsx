import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { findMatch, getMatchState, getMyProfile, leaveQueue, matchWithBot } from "@/lib/game.functions";
import { useSfx } from "@/hooks/useSfx";

export const Route = createFileRoute("/_authenticated/play")({
  component: PlayPage,
});

function PlayPage() {
  const navigate = useNavigate();
  const find = useServerFn(findMatch);
  const cancel = useServerFn(leaveQueue);
  const state = useServerFn(getMatchState);
  const profileFn = useServerFn(getMyProfile);
  const bot = useServerFn(matchWithBot);
  const { play } = useSfx();
  const [matchId, setMatchId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(false);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn({}) });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setSearching(true);
    play("queue");
    find({})
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
  }, [find, navigate, play]);

  // No human opponent after 30s — drop in a ranked bot.
  const botTried = useRef(false);
  useEffect(() => {
    if (!matchId || elapsed < 30 || botTried.current) return;
    botTried.current = true;
    play("whoosh");
    bot({ data: { matchId } }).catch(() => {
      /* the poller keeps looking for a human */
    });
  }, [matchId, elapsed, bot, play]);

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
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-10 px-6 py-20 text-center">
        <div className="animate-enter">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Matchmaking</div>
          <h1 className="mask-reveal mt-4 font-display text-6xl uppercase italic leading-none tracking-tighter sm:text-7xl">
            <span>
              Searching for <span className="text-primary">an opponent</span>
            </span>
          </h1>
        </div>

        <div className="radar flex size-24 items-center justify-center rounded-full border border-border">
          <div className="size-3 rotate-45 bg-primary" />
        </div>

        <div className="wipe-enter flex w-full max-w-md items-center justify-between border-y border-border bg-surface/40 px-6 py-5 font-mono text-sm [animation-delay:200ms]">
          <span className="text-muted-foreground uppercase">Your rating</span>
          <span className="text-primary">{profile.data ? `${profile.data.elo} ELO` : "—"}</span>
        </div>

        <div className="font-mono text-4xl tabular-nums timer-pulse">
          {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
        </div>

        <p className="ticker-enter max-w-sm font-mono text-xs uppercase tracking-widest text-muted-foreground [animation-delay:350ms]">
          {searching
            ? elapsed >= 25
              ? "No human in the arena — dropping in a ranked bot opponent…"
              : "You will be paired with the next ranked player who queues. 10 questions, 2 shared minutes on each."
            : "Matchmaking unavailable"}
        </p>

        <button
          onClick={abort}
          onMouseEnter={() => play("hover")}
          onFocus={() => play("hover")}
          className="border border-border px-8 py-3 font-mono text-sm uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
        >
          Cancel search
        </button>

      </main>
    </div>
  );
}
