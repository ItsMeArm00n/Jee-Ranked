import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Instagram, Mail, Youtube } from "lucide-react";
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
    <footer className="relative border-t border-border bg-surface/30">
      {/* Decorative top accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <div className="mx-auto max-w-7xl px-6 py-16">
        {/* Main grid */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-8">
          {/* Brand column */}
          <div className="space-y-5 md:col-span-5">
            <Link
              to="/"
              {...sfx}
              className="inline-block font-display text-3xl italic tracking-tighter transition-transform duration-300 hover:-skew-x-6"
            >
              JEE <span className="text-primary">RANKED</span>
            </Link>
            <p className="max-w-sm font-mono text-xs uppercase leading-relaxed tracking-widest text-muted-foreground">
              1v1 JEE question duels with ELO ranking. Same paper, same clock, most correct answers
              takes the rating.
            </p>

            {/* Live stats */}
            <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border/60 pt-5">
              {[
                { label: "Players", value: stats.data?.players ?? 0 },
                { label: "Duels", value: stats.data?.duels ?? 0 },
                { label: "Questions", value: stats.data?.questions ?? 0 },
              ].map((s) => (
                <div key={s.label} className="flex items-baseline gap-2">
                  <span className="font-display text-2xl tabular-nums text-primary">
                    {s.value.toLocaleString()}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation columns + connect */}
          <div className="flex flex-col gap-10 md:col-span-7 md:pl-8">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div className="space-y-4">
                <span className="block font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
                  Play
                </span>
                <ul className="space-y-2.5">
                  <li>
                    <Link
                      to="/play"
                      {...sfx}
                      className="link-underline font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      Find a Duel
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/leaderboard"
                      {...sfx}
                      className="link-underline font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      Leaderboard
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <span className="block font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
                  Account
                </span>
                <ul className="space-y-2.5">
                  <li>
                    <Link
                      to="/profile"
                      {...sfx}
                      className="link-underline font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      Profile
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/auth"
                      {...sfx}
                      className="link-underline font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      Sign In
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <span className="block font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
                  Legal
                </span>
                <ul className="space-y-2.5">
                  <li>
                    <Link
                      to="/privacy"
                      {...sfx}
                      className="link-underline font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/terms"
                      {...sfx}
                      className="link-underline font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      Terms & Conditions
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Connect */}
            <div className="flex flex-col items-start gap-3.5 border-t border-border/60 pt-6 sm:items-end">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
                Connect
              </span>
              <div className="flex items-center gap-2.5">
                <a
                  href="https://www.instagram.com/jeeranked/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  {...sfx}
                  className="press-pop flex size-9 items-center justify-center border border-border text-muted-foreground transition-colors duration-200 hover:border-primary hover:text-primary"
                >
                  <Instagram className="size-4" />
                </a>
                <a
                  href="https://www.youtube.com/@jeeranked"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  {...sfx}
                  className="press-pop flex size-9 items-center justify-center border border-border text-muted-foreground transition-colors duration-200 hover:border-primary hover:text-primary"
                >
                  <Youtube className="size-4" />
                </a>
                <a
                  href="mailto:info@jeeranked.com"
                  aria-label="Email us"
                  {...sfx}
                  className="link-underline ml-1 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  <Mail className="size-3.5 text-primary" />
                  info@jeeranked.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-7 sm:flex-row">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            &copy; {new Date().getFullYear()} JEE Ranked. All rights reserved.
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
            Competitive exam protocol
          </span>
        </div>
      </div>
    </footer>
  );
}
