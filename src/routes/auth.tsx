import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useSfx } from "@/hooks/useSfx";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — JEE Ranked 1v1 Duels" },
      {
        name: "description",
        content:
          "Create your JEE Ranked account to queue for live 1v1 JEE question duels and climb the ELO ladder.",
      },
      { property: "og:title", content: "Sign in — JEE Ranked" },
      {
        property: "og:description",
        content: "Join the arena. Race a real opponent through JEE questions.",
      },
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
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/play` },
      });
      if (error) throw error;
      // Browser redirects to Google's consent screen; the session is
      // picked up from the URL when Supabase redirects back.
    } catch {
      play("error");
      toast.error("Google sign-in failed — try again in a moment");
    }
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
            {mode === "signin"
              ? "Sign in to queue for a duel"
              : "Create an account to start at 1200 ELO"}
          </p>
        </div>

        <button
          onClick={() => {
            play("click");
            google();
          }}
          onMouseEnter={() => play("hover")}
          className="ticker-enter press-pop group relative flex w-full items-center justify-center gap-3 border border-black/10 bg-white px-4 py-3 text-sm font-medium tracking-normal text-[#3c4043] shadow-[0_1px_2px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] [animation-delay:400ms] hover:-translate-y-px hover:bg-[#f8f9fa] hover:shadow-[0_6px_18px_-4px_rgba(0,0,0,0.35)]"
        >
          <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="size-5 shrink-0">
            <path
              d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
              fill="#FFC107"
            ></path>
            <path
              d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
              fill="#FF3D00"
            ></path>
            <path
              d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
              fill="#4CAF50"
            ></path>
            <path
              d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
              fill="#1976D2"
            ></path>
          </svg>
          Continue with Google
          <span className="absolute right-4 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 -translate-x-1 text-black/40">
            →
          </span>
        </button>

        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <form
          key={mode}
          onSubmit={submit}
          className={`${mode === "signin" ? "slide-left" : "slide-right"} space-y-4`}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="EMAIL"
            className="input-glow w-full border border-border bg-surface px-4 py-4 font-mono text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:bg-primary/5"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="PASSWORD"
            className="input-glow w-full border border-border bg-surface px-4 py-4 font-mono text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:bg-primary/5"
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
          onClick={() => {
            play("click");
            setMode(mode === "signin" ? "signup" : "signin");
          }}
          onMouseEnter={() => play("hover")}
          className="link-underline self-start font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
        >
          {mode === "signin" ? "No account? Register" : "Already ranked? Sign in"}
        </button>

        <Link
          to="/"
          onMouseEnter={() => play("hover")}
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          ← Back to lobby
        </Link>
      </main>
    </div>
  );
}
