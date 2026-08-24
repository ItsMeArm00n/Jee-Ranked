import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, getUserStats, updateProfile } from "@/lib/game.functions";
import { useSfx } from "@/hooks/useSfx";
import { SiteHeader } from "@/components/SiteHeader";
import { Avatar } from "@/components/Avatar";
import { useCountUpOnView } from "@/hooks/useCountUp";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Could not prepare the image"));
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Could not decode that image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

function ProfilePage() {
  const profileFn = useServerFn(getMyProfile);
  const saveFn = useServerFn(updateProfile);
  const qc = useQueryClient();
  const { play } = useSfx();
  const fileRef = useRef<HTMLInputElement>(null);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn({}) });
  const p = profile.data;

  const statsFn = useServerFn(getUserStats);
  const stats = useQuery({ queryKey: ["user-stats"], queryFn: () => statsFn({}) });
  const s = stats.data;

  const savedUsername = p?.username;
  const savedBio = p?.bio;
  const savedAvatar = p?.avatar_url;

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (savedUsername === undefined) return;
    setUsername(savedUsername);
    setBio(savedBio ?? "");
    setAvatar(savedAvatar ?? null);
  }, [savedUsername, savedBio, savedAvatar]);

  async function save() {
    setSaving(true);
    try {
      const next = await saveFn({ data: { username, bio, avatar_url: avatar ?? "" } });
      qc.setQueryData(["profile"], next);
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      play("final");
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function pick(file?: File | null) {
    if (!file) return;
    try {
      const url = await fileToAvatar(file);
      setAvatar(url);
      play("click");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that image");
    }
  }

  async function changePassword() {
    if (pw.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      play("final");
      toast.success("Password updated");
      setPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setPwBusy(false);
    }
  }

  const field =
    "input-glow w-full border border-border bg-surface px-4 py-4 font-mono text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:bg-primary/5";
  const label = "mb-2 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="animate-enter">
          <h1 className="mask-reveal font-display text-6xl uppercase italic leading-none tracking-tighter">
            Your <span className="text-primary">profile</span>
          </h1>
          <p className="ticker-enter mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground [animation-delay:300ms]">
            Identity, rank and account settings
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* IDENTITY */}
          <section className="wipe-enter border border-border bg-surface/40 p-8 lg:col-span-7">
            <h2 className="font-display text-2xl uppercase italic tracking-tighter">Identity</h2>

            <div className="mt-8 flex items-center gap-6">
              <span className="avatar-ring inline-block">
                <Avatar url={avatar} name={username || "You"} size={96} />
              </span>
              <div className="space-y-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pick(e.target.files?.[0])}
                />
                <button
                  onClick={() => {
                    play("click");
                    fileRef.current?.click();
                  }}
                  onMouseEnter={() => play("hover")}
                  className="border border-border px-4 py-2 font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
                >
                  Upload photo
                </button>
                {avatar ? (
                  <button
                    onClick={() => {
                      setAvatar(null);
                      play("click");
                    }}
                    className="block font-mono text-[10px] uppercase tracking-widest text-destructive transition-opacity hover:opacity-70"
                  >
                    Remove photo
                  </button>
                ) : null}
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Square image · shown at 128px
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <label className={label} htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={20}
                  placeholder="3-20 chars · letters, numbers, _ ."
                  className={field}
                />
              </div>
              <div>
                <label className={label} htmlFor="bio">
                  Bio <span className="text-muted-foreground/60">· {bio.length}/200</span>
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={200}
                  rows={3}
                  placeholder="One line for the arena."
                  className={`${field} resize-none`}
                />
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              onMouseEnter={() => play("hover")}
              className="cta-sweep mt-8 w-full bg-primary py-4 font-display text-xl uppercase italic tracking-tighter text-primary-foreground disabled:opacity-50 sm:w-auto sm:px-10"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </section>

          {/* STATS + ACCOUNT */}
          <div className="space-y-8 lg:col-span-5">
            <section className="wipe-enter relative overflow-hidden border-l-4 border-primary bg-surface/40 p-8 [animation-delay:150ms]">
              <div className="conic-border-surface pointer-events-none absolute inset-0 opacity-60" />
              <div className="relative">
                <h2 className="font-display text-2xl uppercase italic tracking-tighter">Rating</h2>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <div className="font-display text-6xl leading-none tabular-nums">
                      {p?.elo.toLocaleString() ?? "—"}
                    </div>
                    <div className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                      {p?.elo.toLocaleString() ?? "1,200"} ELO
                    </div>
                  </div>
                  <div className="font-mono text-xs uppercase tracking-widest text-primary">
                    {p?.rank ?? "—"}
                  </div>
                </div>
                <div className="mt-8 grid grid-cols-3 gap-2 border-t border-border pt-6 text-center font-mono text-xs">
                  <div>
                    <div className="font-display text-3xl tabular-nums">{p?.wins ?? 0}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Wins
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-3xl tabular-nums">{p?.losses ?? 0}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Losses
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-3xl tabular-nums">{p?.draws ?? 0}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Draws
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>Duels fought</span>
                  <span className="tabular-nums text-foreground">{p?.matches_played ?? 0}</span>
                </div>
              </div>
            </section>

            <section className="wipe-enter border border-border bg-surface/40 p-8 [animation-delay:250ms]">
              <h2 className="font-display text-2xl uppercase italic tracking-tighter">Account</h2>
              <div className="mt-6 space-y-4">
                <input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="NEW PASSWORD (8+ chars)"
                  className={field}
                />
                <button
                  onClick={changePassword}
                  disabled={pwBusy}
                  onMouseEnter={() => play("hover")}
                  className="w-full border border-border px-4 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {pwBusy ? "Updating..." : "Change password"}
                </button>
              </div>
              <Link
                to="/"
                className="mt-6 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                ← Back to lobby
              </Link>
            </section>
          </div>
        </div>

        {/* SCROLL INDICATOR */}
        <div className="pointer-events-none sticky bottom-4 z-30 -mt-4 flex justify-center scroll-indicator-fade">
          <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
            <span className="font-mono text-[10px] uppercase tracking-widest">Stats below</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 6L8 10L12 6" />
            </svg>
          </div>
        </div>

        {/* DETAILED STATISTICS */}
        {stats.isLoading ? (
          <section className="mt-12 border border-border bg-surface/40 p-8">
            <div className="h-6 w-48 animate-pulse rounded bg-border/60" />
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2 border-t border-border pt-4">
                  <div className="h-3 w-16 animate-pulse rounded bg-border/40" />
                  <div className="h-8 w-20 animate-pulse rounded bg-border/60" />
                </div>
              ))}
            </div>
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-3 border-l-2 border-border/40 pl-4">
                  <div className="h-3 w-20 animate-pulse rounded bg-border/40" />
                  <div className="h-1 w-full animate-pulse rounded-full bg-border/30" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="flex justify-between">
                        <div className="h-2.5 w-12 animate-pulse rounded bg-border/30" />
                        <div className="h-2.5 w-8 animate-pulse rounded bg-border/30" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : s ? (
          <section className="mt-12 space-y-8">
            {/* SCOREBOARD STRIP */}
            <div className="animate-enter relative overflow-hidden border border-border bg-surface/40">
              <div className="shimmer-line" />
              <div className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
                <StatCell label="Duels fought" value={s.totalMatches} />
                <StatCell
                  label="Win rate"
                  value={
                    s.totalMatches
                      ? Math.round(((s.ranked.wins + s.unranked.wins) / s.totalMatches) * 100)
                      : 0
                  }
                  suffix="%"
                />
                <StatCell
                  label="Accuracy"
                  value={s.accuracy.pct}
                  suffix="%"
                  sub={`${s.accuracy.correct}/${s.accuracy.total} correct`}
                />
                <StatCell label="Questions answered" value={s.accuracy.total} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              {/* CAREER RECORD DIAL */}
              <div className="animate-enter border border-border bg-surface/40 p-8 [animation-delay:100ms] lg:col-span-4">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Career record
                </h3>
                <WinRateDial
                  wins={s.ranked.wins + s.unranked.wins}
                  losses={s.ranked.losses + s.unranked.losses}
                  draws={s.ranked.draws + s.unranked.draws}
                />
              </div>

              {/* MODE BREAKDOWN */}
              <div className="animate-enter border border-border bg-surface/40 p-8 [animation-delay:180ms] lg:col-span-8">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  By mode
                </h3>
                <div className="mt-6 space-y-1">
                  <ModeRow title="Ranked" stats={s.ranked} accent="bg-primary" delay={200} />
                  <ModeRow title="Unranked" stats={s.unranked} accent="bg-primary/60" delay={260} />
                  <ModeRow
                    title="Solo practice"
                    stats={s.solo}
                    accent="bg-primary/40"
                    delay={320}
                  />
                  <ModeRow title="Duo random" stats={s.duo} accent="bg-success" delay={380} />
                  <ModeRow
                    title="vs Bots"
                    stats={s.bot}
                    accent="bg-muted-foreground/50"
                    delay={440}
                  />
                </div>
              </div>
            </div>

            {/* SUBJECT PERFORMANCE */}
            {Object.keys(s.subjects).length > 0 ? (
              <div className="animate-enter border border-border bg-surface/40 p-8 [animation-delay:250ms]">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    Subject performance
                  </h3>
                  <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block size-2 bg-primary" /> Won
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block size-2 bg-border" /> Lost / drawn
                    </span>
                  </div>
                </div>
                <div className="mt-6 space-y-5">
                  {Object.entries(s.subjects)
                    .sort((a, b) => b[1].played - a[1].played)
                    .map(([subj, d], i) => {
                      const pct = d.played ? Math.round((d.wins / d.played) * 100) : 0;
                      return (
                        <SubjectRow
                          key={subj}
                          name={subj}
                          played={d.played}
                          wins={d.wins}
                          pct={pct}
                          delay={300 + i * 80}
                        />
                      );
                    })}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}

/* ─── Scoreboard cell — count-up number, hairline dividers instead of cards ─── */
function StatCell({
  label,
  value,
  suffix,
  sub,
}: {
  label: string;
  value: number;
  suffix?: string;
  sub?: string;
}) {
  const { ref, value: shown } = useCountUpOnView<HTMLDivElement>(value);
  return (
    <div ref={ref} className="group px-6 py-7 transition-colors duration-300 hover:bg-primary/5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-display text-4xl tabular-nums leading-none transition-transform duration-300 group-hover:-translate-y-0.5 sm:text-5xl">
        {shown.toLocaleString()}
        {suffix ? <span className="text-primary">{suffix}</span> : null}
      </div>
      {sub ? (
        <div className="mt-1.5 font-mono text-[10px] tabular-nums text-muted-foreground/70">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Conic-gradient donut showing overall win share ─── */
function WinRateDial({ wins, losses, draws }: { wins: number; losses: number; draws: number }) {
  const decided = wins + losses + draws;
  const pct = decided ? Math.round((wins / decided) * 100) : 0;
  return (
    <div className="mt-6 flex flex-col items-center">
      <div
        className="scale-in relative size-44 rounded-full transition-all duration-700 ease-out [background:conic-gradient(var(--color-primary)_calc(var(--p)*1%),var(--color-border)_0)] [--p:var(--pct)]"
        style={{ "--pct": pct } as React.CSSProperties}
      >
        <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-background">
          <span className="font-display text-4xl leading-none tabular-nums">
            {decided ? `${pct}%` : "—"}
          </span>
          <span className="mt-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            win rate
          </span>
        </div>
      </div>
      <div className="mt-6 flex w-full justify-center gap-6 font-mono text-xs">
        <span className="tabular-nums text-primary">{wins}W</span>
        <span className="tabular-nums text-destructive">{losses}L</span>
        <span className="tabular-nums text-muted-foreground">{draws}D</span>
      </div>
    </div>
  );
}

/* ─── One mode row — stacked W/L/D segment bar, scoreboard style ─── */
function ModeRow({
  title,
  stats,
  accent,
  delay,
}: {
  title: string;
  stats: { played: number; wins: number; losses?: number; draws?: number };
  accent: string;
  delay: number;
}) {
  const pct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const losses = stats.losses ?? 0;
  const draws = stats.draws ?? 0;
  const winW = stats.played ? (stats.wins / stats.played) * 100 : 0;
  const lossW = stats.played ? (losses / stats.played) * 100 : 0;
  const drawW = stats.played ? (draws / stats.played) * 100 : 0;
  return (
    <div
      className="row-slide ticker-enter group grid cursor-default grid-cols-[auto_1fr_auto] items-center gap-x-5 gap-y-2 border-b border-border/60 py-3 last:border-0 sm:grid-cols-[10rem_1fr_5rem]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest">
        <span className={`inline-block h-3 w-1 ${accent}`} />
        {title}
      </div>
      <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
        <div className="flex h-1.5 w-full bg-border/50">
          <div
            className="h-full bg-success transition-all duration-700 ease-out"
            style={{ width: `${winW}%` }}
          />
          <div
            className="h-full bg-destructive transition-all duration-700 ease-out"
            style={{ width: `${lossW}%` }}
          />
          <div
            className="h-full bg-muted-foreground/60 transition-all duration-700 ease-out"
            style={{ width: `${drawW}%` }}
          />
        </div>
        <span className="hidden shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground sm:inline">
          {stats.played} played
        </span>
      </div>
      <div className="text-right font-display text-xl tabular-nums text-muted-foreground transition-colors duration-300 group-hover:text-foreground">
        {stats.played ? `${pct}%` : "—"}
      </div>
    </div>
  );
}

/* ─── Subject row with glowing hairline bar ─── */
function SubjectRow({
  name,
  played,
  wins,
  pct,
  delay,
}: {
  name: string;
  played: number;
  wins: number;
  pct: number;
  delay: number;
}) {
  return (
    <div className="ticker-enter group" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-baseline justify-between font-mono text-xs">
        <span className="capitalize tracking-widest transition-colors duration-300 group-hover:text-primary">
          {name === "mixed" ? "Mixed / All" : name}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {played} played · {wins}W ·{" "}
          <span className={pct >= 50 ? "text-primary" : "text-foreground"}>{pct}%</span>
        </span>
      </div>
      <div className="mt-2 h-px w-full bg-border/50">
        <div
          className="h-px bg-primary shadow-[0_0_8px_var(--color-primary)] transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
