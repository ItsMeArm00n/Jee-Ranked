import { useEffect, useState } from "react";
import { useSfx } from "@/hooks/useSfx";

const BETA_SEEN_KEY = "jee-ranked-beta-seen";

export function hasSeenBetaNotice(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(BETA_SEEN_KEY) === "1";
}

export function markBetaNoticeSeen() {
  if (typeof window === "undefined") return;
  localStorage.setItem(BETA_SEEN_KEY, "1");
}

interface BetaNoticeProps {
  onDismiss: () => void;
}

export function BetaNotice({ onDismiss }: BetaNoticeProps) {
  const [open, setOpen] = useState(false);
  const { play } = useSfx();

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function dismiss() {
    play("whoosh");
    setOpen(false);
    setTimeout(() => {
      markBetaNoticeSeen();
      onDismiss();
    }, 400);
  }

  return (
    <div
      className={`fixed inset-0 z-[9998] flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm transition-opacity duration-400 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`relative w-full max-w-md border border-border bg-surface p-10 transition-all duration-500 ${
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-4 scale-95 opacity-0"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {/* Corner accent */}
        <div className="absolute top-0 right-0 h-16 w-16 overflow-hidden">
          <div className="absolute top-0 right-0 h-24 w-24 -translate-x-4 -translate-y-4 rotate-45 bg-primary/10" />
        </div>

        {/* Beta badge */}
        <div className="mb-6 inline-flex items-center gap-2 border border-primary/30 bg-primary/10 px-3 py-1.5">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            Beta
          </span>
        </div>

        <h2 className="font-display text-4xl uppercase italic leading-none tracking-tighter text-foreground">
          Early <span className="text-primary">Access</span>
        </h2>

        <p className="mt-5 font-mono text-xs uppercase leading-relaxed tracking-widest text-muted-foreground">
          JEE Ranked is still under active development. You may encounter bugs,
          incomplete features, or periodic data resets as we improve the
          platform.
        </p>

        <p className="mt-3 font-mono text-[10px] uppercase leading-relaxed tracking-widest text-muted-foreground/60">
          Your matches and progress help us shape the final product. Thank you
          for being an early player.
        </p>

        <button
          onClick={dismiss}
          onMouseEnter={() => play("hover")}
          className="cta-sweep mt-8 w-full bg-primary py-4 font-mono text-xs uppercase tracking-widest text-primary-foreground transition-all duration-300 hover:brightness-110"
        >
          I understand
        </button>
      </div>
    </div>
  );
}
