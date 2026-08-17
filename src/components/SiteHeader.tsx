import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useSfx } from "@/hooks/useSfx";

export function SiteHeader() {
  const { session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { muted, toggle, play } = useSfx();

  const sfx = {
    onMouseEnter: () => play("hover"),
    onFocus: () => play("hover"),
  };

  async function signOut() {
    play("whoosh");
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur-md transition-colors duration-300">
      <Link
        to="/"
        {...sfx}
        className="group font-display text-2xl italic tracking-tighter transition-transform duration-300 hover:-skew-x-6"
      >
        JEE{" "}
        <span className="text-primary transition-opacity duration-300 group-hover:opacity-80">
          RANKED
        </span>
      </Link>
      <div className="flex items-center gap-6 font-mono text-xs">
        <div className="hidden flex-col items-end sm:flex">
          <span className="uppercase text-muted-foreground">Season 01</span>
          <span className="link-underline font-bold">RESONANCE ARENA</span>
        </div>
        <button
          onClick={() => {
            play("toggle");
            toggle();
          }}
          onMouseEnter={() => play("hover")}
          onFocus={() => play("hover")}
          aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
          title={muted ? "Sound off" : "Sound on"}
          className="border border-border px-3 py-2 uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
        >
          {muted ? "SFX OFF" : "SFX ON"}
        </button>
        <Link
          to="/leaderboard"
          {...sfx}
          className="border border-border px-4 py-2 uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
        >
          Leaderboard
        </Link>

        {session ? (
          <>
            <Link
              to="/profile"
              {...sfx}
              className="border border-border px-4 py-2 uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
            >
              Profile
            </Link>
            <button
              onClick={signOut}
              onMouseEnter={() => play("hover")}
              onFocus={() => play("hover")}
              className="border border-border px-4 py-2 uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            to="/auth"
            {...sfx}
            className="border border-border px-4 py-2 uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
