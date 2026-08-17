import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/useSession";
import { useSfx } from "@/hooks/useSfx";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — JEE Ranked 1v1 Duels" },
      {
        name: "description",
        content: "Create your JEE Ranked account to queue for live 1v1 JEE question duels and climb the ELO ladder.",
      },
      { property: "og:title", content: "Sign in — JEE Ranked" },
      { property: "og:description", content: "Join the arena. Race a real opponent through JEE questions." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { session } = useSession();
  const { play } = useSfx();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate({ to: "/play", replace: true });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/play" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/play" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col gap-8 px-6 py-20">
        <div className="animate-enter">
          <h1 className="mask-reveal font-display text-6xl uppercase italic leading-none tracking-tighter">
            <span>
              Enter the <span className="text-primary">arena</span>
            </span>
          </h1>
          <p className="ticker-enter mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground [animation-delay:300ms]">
            {mode === "signin" ? "Sign in to queue for a duel" : "Create an account to start at 1200 ELO"}
          </p>
        </div>

        <button
          onClick={() => { play("click"); google(); }}
          onMouseEnter={() => play("hover")}
          className="ticker-enter border border-border bg-surface px-6 py-4 font-mono text-sm uppercase tracking-widest transition-all duration-300 [animation-delay:400ms] hover:-translate-y-0.5 hover:border-primary hover:text-primary"
        >
          Continue with Google
        </button>

        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="EMAIL"
            className="w-full border border-border bg-surface px-4 py-4 font-mono text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground focus:border-primary focus:bg-primary/5"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="PASSWORD"
            className="w-full border border-border bg-surface px-4 py-4 font-mono text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground focus:border-primary focus:bg-primary/5"
          />
          <button
            type="submit"
            disabled={busy}
            onMouseEnter={() => play("hover")}
            className="cta-sweep w-full bg-primary py-5 font-display text-2xl uppercase italic tracking-tighter text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => { play("click"); setMode(mode === "signin" ? "signup" : "signin"); }}
          onMouseEnter={() => play("hover")}
          className="link-underline self-start font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
        >
          {mode === "signin" ? "No account? Register" : "Already ranked? Sign in"}
        </button>


        <Link to="/" onMouseEnter={() => play("hover")} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
          ← Back to lobby
        </Link>
      </main>
    </div>
  );
}
