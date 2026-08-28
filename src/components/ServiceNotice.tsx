import { useEffect, useState } from "react";
import { useSfx } from "@/hooks/useSfx";

const SERVICE_NOTICE_SEEN_KEY = "jee-ranked-service-notice-seen";

export function isServiceNoticeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return import.meta.env["VITE_SHOW_SERVICE_NOTICE"] === "true";
}

export function hasSeenServiceNotice(): boolean {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(SERVICE_NOTICE_SEEN_KEY) === "1";
}

export function markServiceNoticeSeen() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SERVICE_NOTICE_SEEN_KEY, "1");
}

interface ServiceNoticeProps {
  onDismiss: () => void;
}

export function ServiceNotice({ onDismiss }: ServiceNoticeProps) {
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
      markServiceNoticeSeen();
      onDismiss();
    }, 300);
  }

  return (
    <div
      className={`relative z-[9990] flex w-full items-center justify-center gap-3 border-b border-primary/30 bg-primary/10 px-6 py-2.5 backdrop-blur-md transition-all duration-500 ${
        open ? "opacity-100" : "opacity-0"
      }`}
      style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
      <p className="font-mono text-[10px] uppercase tracking-widest text-foreground sm:text-[11px]">
        Our backend provider is currently experiencing issues, so some actions may be slower than
        usual.
      </p>
      <button
        onClick={dismiss}
        onMouseEnter={() => play("hover")}
        aria-label="Dismiss notice"
        className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
      >
        ✕
      </button>
    </div>
  );
}
