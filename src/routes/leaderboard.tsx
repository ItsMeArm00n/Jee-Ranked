import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Avatar } from "@/components/Avatar";
import { getFullLeaderboard } from "@/lib/game.functions";
import { useSfx } from "@/hooks/useSfx";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — JEE Ranked" },
      { name: "description", content: "Global ELO leaderboard for JEE Ranked. See every ranked player on the ladder." },
    ],
  }),
  component: LeaderboardPage,
});

const TIERS = [
  { name: "Rookie", min: 0, max: 1199, color: "text-muted-foreground" },
  { name: "Aspirant", min: 1200, max: 1399, color: "text-muted-foreground" },
  { name: "Contender", min: 1400, max: 1599, color: "text-foreground" },
  { name: "Topper", min: 1600, max: 1799, color: "text-foreground" },
  { name: "Elite II", min: 1800, max: 2099, color: "text-primary" },
  { name: "Elite I", min: 2100, max: 2399, color: "text-primary" },
  { name: "Grandmaster", min: 2400, max: Infinity, color: "text-primary" },
];

function LeaderboardPage() {
  const { play } = useSfx();
  const [filter, setFilter] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["full-leaderboard"],
    queryFn: () => getFullLeaderboard(),
  });

  const players = data ?? [];
  const filtered = filter ? players.filter((p) => p.rank === filter.toUpperCase()) : players;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl space-y-10 px-6 py-10">
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
                Global leaderboard
              </span>
              <h1 className="mask-reveal font-display text-6xl uppercase italic leading-none tracking-tighter">
                <span>The Ladder</span>
              </h1>
            </div>
          </div>
          <div className="text-right font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {players.length} player{players.length !== 1 ? "s" : ""} ranked
          </div>
        </div>

        {/* TIER FILTER */}
        <div className="wipe-enter flex flex-wrap gap-2">
          <button
            onClick={() => {
              setFilter(null);
              play("click");
            }}
            onMouseEnter={() => play("hover")}
            className={`border px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-all duration-300 ${
              filter === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            All
          </button>
          {TIERS.map((t) => (
            <button
              key={t.name}
              onClick={() => {
                setFilter(filter === t.name ? null : t.name);
                play("click");
              }}
              onMouseEnter={() => play("hover")}
              className={`border px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-all duration-300 ${
                filter === t.name
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* LOADING */}
        {isLoading ? (
          <div className="py-32 text-center font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Loading leaderboard…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-32 text-center font-mono text-sm text-muted-foreground">
            {filter ? "No players in this tier yet." : "No ranked players yet. Be the first on the ladder."}
          </div>
        ) : (
          /* PLAYER LIST */
          <div className="space-y-2">
            {/* Column headers */}
            <div className="flex items-center justify-between border-b border-border pb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="w-8 text-center">#</span>
                <span className="w-26">Player</span>
                <span className="hidden sm:inline">Tier</span>
              </div>
              <div className="flex items-center gap-8">
                <span className="hidden text-center md:inline">W / L / D</span>
                <span className="hidden text-center md:inline">Played</span>
                <span className="w-20 text-right">ELO</span>
              </div>
            </div>

            {filtered.map((p, i) => {
              const tier = TIERS.find((t) => p.elo >= t.min && p.elo <= t.max);
              const isTop3 = (data?.findIndex((x) => x.id === p.id) ?? -1) < 3;
              return (
                <div
                  key={p.id}
                  onMouseEnter={() => play("hover")}
                  style={{ animationDelay: `${40 + i * 30}ms` }}
                  className={`ticker-enter row-slide flex items-center justify-between border border-foreground/5 p-3 font-mono text-sm transition-all duration-300 hover:border-primary/40 hover:bg-primary/5 ${
                    isTop3 && !filter
                      ? i === 0
                        ? "bg-foreground/5"
                        : i === 1
                          ? "opacity-80"
                          : "opacity-60"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`w-8 text-center ${
                        isTop3 && !filter ? "text-primary font-bold" : "text-muted-foreground"
                      }`}
                    >
                      {String(p.position).padStart(2, "0")}
                    </span>
                    <Avatar url={p.avatar_url} name={p.username} size={32} />
                    <div className="flex flex-col">
                      <span className="font-bold">{p.username.toUpperCase()}</span>
                      <span className={`text-[10px] uppercase tracking-widest ${tier?.color ?? "text-muted-foreground"}`}>
                        {p.rank}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <span className="hidden text-center text-xs text-muted-foreground md:inline">
                      <span className="text-foreground">{p.wins}</span>W{" / "}
                      <span className="text-foreground">{p.losses}</span>L{" / "}
                      <span className="text-foreground">{p.draws}</span>D
                    </span>
                    <span className="hidden text-center text-xs text-muted-foreground md:inline">
                      {p.matches_played}
                    </span>
                    <span className="w-20 text-right text-muted-foreground">
                      {p.elo.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TIER LEGEND */}
        <div className="wipe-enter border-t border-border pt-8">
          <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Tier thresholds
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TIERS.map((t, i) => (
              <div
                key={t.name}
                style={{ animationDelay: `${i * 60}ms` }}
                className="ticker-enter border border-border p-4"
              >
                <div className={`font-display text-lg uppercase italic ${t.color}`}>
                  {t.name}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t.max === Infinity ? `${t.min.toLocaleString()}+` : `${t.min.toLocaleString()} – ${t.max.toLocaleString()}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
