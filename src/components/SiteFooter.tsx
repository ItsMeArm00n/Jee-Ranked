import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSfx } from "@/hooks/useSfx";
import { getGlobalStats } from "@/lib/game.functions";

export function SiteFooter() {
  const { play } = useSfx();
  const statsFn = useServerFn(getGlobalStats);
  const stats = useQuery({ queryKey: ["globalStats"], queryFn: () => statsFn({}) });

  const sfx = {
    onMouseEnter: () => play("hover"),
    onFocus: () => play("hover"),
  };

  return (
    <footer className="border-t border-border bg-surface/30">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
          {/* Brand */}
          <div className="text-center md:text-left">
            <Link
              to="/"
              {...sfx}
              className="font-display text-2xl italic tracking-tighter transition-transform duration-300 hover:-skew-x-6"
            >
              JEE <span className="text-primary">RANKED</span>
            </Link>
            <p className="mt-2 max-w-xs font-mono text-xs uppercase tracking-widest text-muted-foreground">
              1v1 JEE question duels with ELO ranking.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-12 font-mono text-xs uppercase tracking-widest">
            <div className="flex flex-col gap-3">
              <span className="text-muted-foreground">Legal</span>
              <Link to="/privacy" {...sfx} className="transition-colors hover:text-primary">
                Privacy Policy
              </Link>
              <Link to="/terms" {...sfx} className="transition-colors hover:text-primary">
                Terms & Conditions
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-muted-foreground">Play</span>
              <Link to="/play" {...sfx} className="transition-colors hover:text-primary">
                Find a Duel
              </Link>
              <Link to="/leaderboard" {...sfx} className="transition-colors hover:text-primary">
                Leaderboard
              </Link>
            </div>
          </div>
        </div>

        {/* Stats line */}
        <div className="mt-10 border-t border-border pt-6 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          JEE Ranked // Competitive exam protocol — {stats.data?.players ?? 0} ranked players ·{" "}
          {stats.data?.duels ?? 0} duels · {stats.data?.questions ?? 0} questions
        </div>

        <div className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          &copy; {new Date().getFullYear()} JEE Ranked. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
