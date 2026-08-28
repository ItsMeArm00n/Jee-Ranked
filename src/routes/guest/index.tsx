import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { useSfx } from "@/hooks/useSfx";
import { guestStart } from "@/lib/guest.functions";
import { storeGuestBundle } from "@/lib/guest.clientstore";

export const Route = createFileRoute("/guest/")({
  component: GuestSetup,
});

type GuestMode = "solo" | "bot";
type Subject = "Physics" | "Chemistry" | "Mathematics" | "All";

export function GuestSetup() {
  const navigate = useNavigate();
  const start = useServerFn(guestStart);
  const { play } = useSfx();

  const [mode, setMode] = useState<GuestMode>("solo");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState<Subject>("All");
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(120);
  const [busy, setBusy] = useState(false);

  const subjects: { value: Subject; label: string }[] = [
    { value: "All", label: "All Subjects" },
    { value: "Physics", label: "Physics" },
    { value: "Chemistry", label: "Chemistry" },
    { value: "Mathematics", label: "Mathematics" },
  ];
  const modes: { value: GuestMode; label: string; desc: string }[] = [
    { value: "solo", label: "Solo", desc: "Practice Solo" },
    { value: "bot", label: "Vs Bot", desc: "Play against the computer" },
  ];

  async function begin() {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      play("error");
      toast.error("Please enter a guest name (at least 3 characters)");
      return;
    }
    play("queue");
    setBusy(true);
    try {
      const bundle = await start({
        data: { mode, name: trimmed, subject, secondsPerQuestion },
      });
      storeGuestBundle(bundle);
      // Await the navigation and only clear the busy flag on failure —
      // on success the setup page unmounts, and resetting state mid-navigation
      // could cancel the transition before the URL changes.
      await navigate({ to: "/guest/match", search: { token: bundle.token } });
    } catch (e) {
      play("error");
      setBusy(false);
      const raw = e instanceof Error ? e.message : "";
      const msg = raw.includes("Name must")
        ? "Please enter a guest name (at least 3 characters)"
        : raw || "Could not start a guest game";
      toast.error(msg);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-10 px-6 py-20 text-center">
        <div className="animate-enter">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Guest mode · no account needed
          </div>
          <h1 className="mask-reveal mt-4 font-display text-5xl uppercase italic leading-none tracking-tighter sm:text-6xl">
            <span>
              Step into the <span className="text-primary">arena</span>
            </span>
          </h1>
          <p className="ticker-enter mt-4 mx-auto max-w-md font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Play unranked practice, solo or vs a bot. Nothing you do here is saved — no ELO, no
            leaderboard, no match history.
          </p>
        </div>

        {/* Display name */}
        <div className="ticker-enter w-full max-w-md space-y-3 text-left [animation-delay:150ms]">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Your guest name
          </div>
          <input
            type="text"
            required
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="3–20 chars"
            className="input-glow w-full border border-border bg-surface px-4 py-4 font-mono text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:bg-primary/5"
          />
        </div>

        {/* Mode picker */}
        <div className="ticker-enter w-full max-w-md space-y-3 [animation-delay:250ms]">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Opponent
          </div>
          <div className="grid grid-cols-2 gap-3">
            {modes.map((m) => (
              <button
                key={m.value}
                onClick={() => {
                  play("select");
                  setMode(m.value);
                }}
                onMouseEnter={() => play("hover")}
                className={`press-pop border p-4 text-left ${
                  mode === m.value
                    ? "pop-select border-primary bg-primary/10 shadow-[0_0_20px_-6px_var(--color-primary)]"
                    : "border-border hover:-translate-y-0.5 hover:border-primary/50"
                }`}
              >
                <div
                  className={`font-mono text-sm uppercase tracking-widest transition-colors duration-300 ${mode === m.value ? "text-primary" : ""}`}
                >
                  {m.label}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {m.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Subject picker */}
        <div className="ticker-enter w-full max-w-md space-y-3 [animation-delay:350ms]">
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
                }}
                onMouseEnter={() => play("hover")}
                className={`press-pop border p-4 font-mono text-sm uppercase tracking-widest hover:-translate-y-0.5 ${
                  subject === s.value
                    ? "pop-select border-primary bg-primary/10 text-primary shadow-[0_0_20px_-6px_var(--color-primary)]"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time per question */}
        <div className="ticker-enter w-full max-w-md space-y-3 text-left [animation-delay:450ms]">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Time per question
            </div>
            <div
              key={secondsPerQuestion}
              className="counter-enter font-mono text-sm tabular-nums text-primary"
            >
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
            className="w-full accent-primary transition-all duration-300 hover:brightness-125"
          />
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>0:30</span>
            <span>5:00</span>
          </div>
        </div>

        {/* Actions */}
        <div className="ticker-enter flex w-full max-w-md gap-4 [animation-delay:550ms]">
          <Link
            to="/auth"
            onMouseEnter={() => play("hover")}
            className="press-pop flex-1 border border-border px-6 py-3 font-mono text-sm uppercase tracking-widest hover:-translate-y-0.5 hover:border-primary hover:text-primary"
          >
            Sign in instead
          </Link>
          <button
            onClick={begin}
            disabled={busy}
            onMouseEnter={() => play("hover")}
            className="cta-sweep glow-pulse flex-1 bg-primary px-6 py-3 font-mono text-sm uppercase tracking-widest text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Starting…" : "Play"}
          </button>
        </div>
      </main>
    </div>
  );
}
