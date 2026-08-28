import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createPortal } from "react-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { Avatar } from "@/components/Avatar";
import { AdminTag } from "@/components/AdminTag";
import { useSession } from "@/hooks/useSession";
import { useSfx } from "@/hooks/useSfx";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useTilt } from "@/hooks/useTilt";
import { useCountUpOnView } from "@/hooks/useCountUp";
import { getGlobalStats, getLeaderboard, getMyProfile } from "@/lib/game.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JEE Ranked — 1v1 JEE Question Duels with ELO" },
      {
        name: "description",
        content:
          "Get matched against a real opponent, race through the same JEE questions on a shared timer, and win ELO. Physics, Chemistry and Maths ranked duels.",
      },
      { property: "og:title", content: "JEE Ranked — 1v1 JEE Question Duels with ELO" },
      {
        property: "og:description",
        content:
          "Get matched against a real opponent, race through the same JEE questions on a shared timer, and win ELO. Physics, Chemistry and Maths ranked duels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["leaderboard"],
      queryFn: () => getLeaderboard(),
    }),
  component: Home,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-12 text-center font-mono text-xs uppercase">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-12 text-center font-mono text-xs uppercase">Nothing here.</div>
  ),
});

const TIERS = [
  { name: "Rookie", elo: "< 1200" },
  { name: "Aspirant", elo: "1200+" },
  { name: "Contender", elo: "1400+" },
  { name: "Topper", elo: "1600+" },
  { name: "Elite II", elo: "1800+" },
  { name: "Elite I", elo: "2100+" },
  { name: "Grandmaster", elo: "2400+" },
];

const SUBJECTS = [
  {
    code: "PHY",
    name: "Physics",
    blurb:
      "Kinematics, rotational dynamics, electromagnetism and modern physics — single-answer MCQs at JEE Main tempo.",
  },
  {
    code: "CHE",
    name: "Chemistry",
    blurb:
      "Physical, organic and inorganic mixed into the same paper so nobody gets a comfortable run.",
  },
  {
    code: "MAT",
    name: "Mathematics",
    blurb:
      "Calculus, coordinate geometry, algebra and probability. Speed is scored as heavily as accuracy.",
  },
];

const FAQ = [
  {
    q: "How is ELO calculated?",
    a: "Standard ELO with K=32. Beating a higher-rated opponent moves you more; losing to a lower-rated one costs more.",
  },
  {
    q: "What if nobody is in the queue?",
    a: "After 30 seconds you are dropped into a duel against a ranked bot calibrated near your rating. It still counts.",
  },
  {
    q: "Can I review a duel afterwards?",
    a: "Every finished match has a replay you can scrub — question by question, both players, with the shared clock.",
  },
  {
    q: "Is answering fast enough to win?",
    a: "Only if you are right. Wrong answers are locked in. Most correct wins; ties break on time to finish.",
  },
];

function Home() {
  const { session } = useSession();
  const { play } = useSfx();
  const [showEntry, setShowEntry] = useState(false);
  const profileFn = useServerFn(getMyProfile);
  const leaderboard = useQuery({ queryKey: ["leaderboard"], queryFn: () => getLeaderboard() });
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => getGlobalStats() });
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileFn({}),
    enabled: !!session,
  });

  const leaderboardReveal = useScrollReveal();
  const howReveal = useScrollReveal();
  const subjectsReveal = useScrollReveal();
  const faqReveal = useScrollReveal();
  const ctaReveal = useScrollReveal();

  const standingTilt = useTilt(4);

  /** Mouse-tracked spotlight coordinates for flat cards. */
  function trackSpotlight(e: React.MouseEvent<HTMLElement>) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  }

  const marquee = [
    "SEASON 01 // RESONANCE ARENA",
    "10 QUESTIONS",
    "ONE SHARED CLOCK",
    "WINNER TAKES ELO",
    "PHYSICS · CHEMISTRY · MATHS",
    "NO SECOND ATTEMPTS",
  ];

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary selection:text-primary-foreground">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="arena-grid pointer-events-none absolute inset-0" />
        <div className="aurora-blob pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="aurora-blob pointer-events-none absolute -left-52 top-1/3 size-[30rem] rounded-full bg-primary/5 blur-3xl [animation-delay:-7s]" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-14 px-6 py-20 lg:grid-cols-12 lg:py-28">
          <div className="space-y-8 lg:col-span-7">
            <div className="animate-enter inline-flex items-center gap-3 border border-border bg-surface/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              <span className="live-dot size-1.5 rounded-full bg-primary" />
              Ranked ladder is live
            </div>

            <h1 className="group cursor-default font-display text-[clamp(3.5rem,10vw,8rem)] uppercase italic leading-[0.82] tracking-tighter">
              <span className="mask-reveal block">
                <span>Duel for</span>
              </span>
              <span className="mask-reveal block text-primary">
                <span className="[animation-delay:120ms]">every mark</span>
              </span>
              <span className="mask-reveal block">
                <span className="[animation-delay:240ms]">you deserve</span>
              </span>
            </h1>

            <p className="ticker-enter max-w-xl font-mono text-xs uppercase leading-relaxed tracking-widest text-muted-foreground [animation-delay:320ms]">
              Matched against a real aspirant in seconds. Same ten questions, same ten minutes, same
              paper. Most correct answers takes the rating off the other side of the table.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {session ? (
                <Link
                  to="/play"
                  onMouseEnter={() => play("hover")}
                  onFocus={() => play("hover")}
                  className="cta-sweep animate-enter block bg-primary px-12 py-6 text-center font-display text-3xl uppercase italic tracking-tighter text-primary-foreground [animation-delay:120ms]"
                >
                  Play
                </Link>
              ) : (
                <button
                  onClick={() => {
                    play("click");
                    setShowEntry(true);
                  }}
                  onMouseEnter={() => play("hover")}
                  onFocus={() => play("hover")}
                  className="cta-sweep animate-enter block bg-primary px-12 py-6 text-center font-display text-3xl uppercase italic tracking-tighter text-primary-foreground [animation-delay:120ms]"
                >
                  Find Opponent
                </button>
              )}
              <a
                href="#how"
                onMouseEnter={() => play("hover")}
                onFocus={() => play("hover")}
                className="animate-enter border border-border px-8 py-6 text-center font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary [animation-delay:200ms]"
              >
                How the arena works
              </a>
            </div>
          </div>

          {/* Standing card */}
          <div className="lg:col-span-5">
            <div className="wipe-enter relative [animation-delay:150ms]">
              <div
                ref={standingTilt.ref}
                onMouseMove={standingTilt.onMouseMove}
                onMouseEnter={standingTilt.onMouseEnter}
                onMouseLeave={standingTilt.onMouseLeave}
                className="spotlight-card relative border border-border bg-surface p-8 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)]"
              >
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Current standing
                </span>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <h2 className="font-display text-6xl uppercase leading-none tracking-tight">
                      {profile.data?.rank ?? (session ? "…" : "Unranked")}
                    </h2>
                    <p className="mt-2 font-mono text-xl text-primary">
                      {profile.data
                        ? `${profile.data.elo.toLocaleString()} ELO`
                        : "1,200 ELO on signup"}
                    </p>
                  </div>
                  <div className="text-right font-mono text-xs text-muted-foreground">
                    {profile.data ? `${profile.data.wins}W / ${profile.data.losses}L` : "0W / 0L"}
                  </div>
                </div>

                <div className="shimmer-line mt-8" />
                <div className="mt-6 grid grid-cols-3 gap-x-2 font-mono">
                  {[
                    { k: "Players", v: stats.data?.players ?? 0 },
                    { k: "Duels", v: stats.data?.duels ?? 0 },
                    { k: "Questions", v: stats.data?.questions ?? 0 },
                  ].map((s, i) => (
                    <div
                      key={s.k}
                      style={{ animationDelay: `${300 + i * 90}ms` }}
                      className="ticker-enter"
                    >
                      <CountStat value={s.v} />
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {s.k}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <div className="ticker-enter border border-border p-4 [animation-delay:400ms]">
                <div className="text-foreground">02:00</div>
                shared per question
              </div>
              <div className="ticker-enter border border-border p-4 [animation-delay:470ms]">
                <div className="text-foreground">K = 32</div>
                elo volatility
              </div>
            </div>
          </div>
        </div>

        {/* MARQUEE */}
        <div className="marquee-mask relative overflow-hidden border-y border-border bg-surface/40 py-3">
          <div className="marquee flex w-max gap-10 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
            {[...marquee, ...marquee, ...marquee].map((m, i) => (
              <span key={i} className="flex items-center gap-10">
                {m}
                <span className="text-primary">◆</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-28 px-6 py-24">
        {/* LEADERBOARD + TIERS */}
        <section
          ref={leaderboardReveal.ref}
          className={`grid grid-cols-1 gap-8 lg:grid-cols-12 ${leaderboardReveal.visible ? "fade-up" : "opacity-0"}`}
        >
          <div
            onMouseMove={trackSpotlight}
            className="wipe-enter spotlight-card border border-border bg-surface/50 p-8 transition-colors duration-300 hover:border-primary/40 lg:col-span-8"
          >
            <div className="mb-6 flex items-end justify-between">
              <h2 className="font-display text-3xl uppercase italic tracking-tighter">
                Global leaderboard
              </h2>
              <Link
                to="/leaderboard"
                onMouseEnter={() => play("hover")}
                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
              >
                View all →
              </Link>
            </div>
            <div className="space-y-2">
              {(leaderboard.data ?? []).length === 0 ? (
                <p className="font-mono text-sm text-muted-foreground">
                  No ranked players yet. Be the first on the ladder.
                </p>
              ) : (
                (leaderboard.data ?? []).map((p, i) => (
                  <div
                    key={p.id}
                    onMouseEnter={() => play("hover")}
                    style={{ animationDelay: `${150 + i * 55}ms` }}
                    className={`row-slide ticker-enter flex items-center justify-between border border-foreground/5 p-3 font-mono text-sm ${
                      i === 0
                        ? "bg-foreground/5"
                        : i === 1
                          ? "opacity-80"
                          : i === 2
                            ? "opacity-60"
                            : "opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={i === 0 ? "text-primary" : ""}>
                        <span className={`inline-block ${i === 0 ? "medal-glow px-1" : ""}`}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </span>
                      <Avatar url={p.avatar_url} name={p.username} size={26} />
                      <span>{p.username.toUpperCase()}</span>
                      {p.is_admin ? <AdminTag /> : null}
                      <span className="hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
                        {p.rank}
                      </span>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="hidden text-[10px] uppercase tracking-widest text-muted-foreground md:inline">
                        {p.wins}W / {p.losses}L
                      </span>
                      <span className="text-muted-foreground">{p.elo.toLocaleString()} ELO</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="wipe-enter border border-border p-8 transition-all duration-300 hover:border-primary/40 [animation-delay:150ms] lg:col-span-4">
            <h2 className="mb-6 font-display text-3xl uppercase italic tracking-tighter">
              Rank ladder
            </h2>
            <ul className="space-y-3 font-mono text-xs uppercase tracking-widest">
              {TIERS.map((t, i) => (
                <li
                  key={t.name}
                  style={{ animationDelay: `${120 + i * 70}ms` }}
                  className="ticker-enter flex items-center justify-between border-b border-border pb-3 last:border-0"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-primary">{String(i + 1).padStart(2, "0")}</span>
                    {t.name}
                  </span>
                  <span className="text-muted-foreground">{t.elo}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section
          ref={howReveal.ref}
          id="how"
          className={`scroll-mt-24 border-t border-border pt-16 ${howReveal.visible ? "fade-up" : "opacity-0"}`}
        >
          <h2 className="font-display text-5xl uppercase italic tracking-tighter sm:text-6xl">
            Three minutes to your <span className="text-primary">first rating</span>
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3">
            {[
              {
                t: "Queue up",
                c: "Hit find opponent. You are paired with the next ranked aspirant in the arena — or a calibrated bot after 30 seconds.",
              },
              {
                t: "Race the paper",
                c: "Identical Physics, Chemistry and Maths questions, 2 shared minutes on each one. Miss the window and the question locks. Live progress bars show how close they are.",
              },
              {
                t: "Take the ELO",
                c: "Most correct wins the rating. Every duel is stored and replayable, question by question, with the timer.",
              },
            ].map((s, i) => (
              <div
                key={s.t}
                style={{ animationDelay: `${i * 120}ms` }}
                className="ticker-enter group cursor-default"
              >
                <div className="font-display text-6xl transition-all duration-300 group-hover:scale-110 group-hover:text-primary group-hover:tracking-wider">
                  0{i + 1}
                </div>
                <h3 className="mt-4 font-display text-2xl uppercase italic tracking-tight">
                  {s.t}
                </h3>
                <p className="mt-3 font-mono text-xs uppercase leading-relaxed tracking-widest text-muted-foreground transition-colors duration-300 group-hover:text-foreground">
                  {s.c}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SUBJECTS */}
        <section
          ref={subjectsReveal.ref}
          className={`border-t border-border pt-16 ${subjectsReveal.visible ? "fade-up" : "opacity-0"}`}
        >
          <div className="flex items-end justify-between">
            <h2 className="font-display text-5xl uppercase italic tracking-tighter sm:text-6xl">
              The paper
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {stats.data?.questions ?? 0} questions in the bank
            </span>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {SUBJECTS.map((s, i) => (
              <article
                key={s.code}
                style={{ animationDelay: `${i * 110}ms` }}
                className="ticker-enter"
              >
                <TiltSubject subject={s} />
              </article>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section
          ref={faqReveal.ref}
          className={`grid grid-cols-1 gap-10 border-t border-border pt-16 lg:grid-cols-12 ${faqReveal.visible ? "fade-up" : "opacity-0"}`}
        >
          <h2 className="font-display text-5xl uppercase italic tracking-tighter lg:col-span-4">
            Arena rules
          </h2>
          <div className="lg:col-span-8">
            {FAQ.map((f, i) => (
              <details
                key={f.q}
                style={{ animationDelay: `${i * 90}ms` }}
                className="ticker-enter group border-b border-border py-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-xs uppercase tracking-widest transition-colors duration-300 hover:text-primary">
                  {f.q}
                  <span className="faq-chevron font-display text-2xl group-open:rotate-45">+</span>
                </summary>
                <div className="faq-body">
                  <div>
                    <p className="faq-answer mt-4 max-w-2xl font-mono text-xs uppercase leading-relaxed tracking-widest text-muted-foreground">
                      {f.a}
                    </p>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* CLOSING CTA */}
        <section
          ref={ctaReveal.ref}
          className={`relative overflow-hidden border border-border p-12 text-center sm:p-20 ${ctaReveal.visible ? "fade-up" : "opacity-0"}`}
        >
          <div className="conic-border-surface pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute inset-0 bg-background/85" />
          <div className="arena-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative space-y-8">
            <h2 className="font-display text-[clamp(2.5rem,7vw,5.5rem)] uppercase italic leading-none tracking-tighter">
              Someone is <span className="text-glow text-primary">already queued</span>
            </h2>
            <p className="mx-auto max-w-lg font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Ten questions decide who moves up the ladder tonight.
            </p>
            {session ? (
              <Link
                to="/play"
                onMouseEnter={() => play("hover")}
                onFocus={() => play("hover")}
                className="cta-sweep glow-pulse inline-block bg-primary px-14 py-6 font-display text-3xl uppercase italic tracking-tighter text-primary-foreground"
              >
                Enter the arena
              </Link>
            ) : (
              <button
                onClick={() => {
                  play("click");
                  setShowEntry(true);
                }}
                onMouseEnter={() => play("hover")}
                onFocus={() => play("hover")}
                className="cta-sweep glow-pulse inline-block bg-primary px-14 py-6 font-display text-3xl uppercase italic tracking-tighter text-primary-foreground"
              >
                Enter the arena
              </button>
            )}
          </div>
        </section>
      </main>

      {showEntry
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-6 backdrop-blur-sm">
              <div className="animate-enter w-full max-w-md border border-border bg-surface p-8">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    Enter the arena
                  </div>
                  <button
                    onClick={() => {
                      play("cancel");
                      setShowEntry(false);
                    }}
                    onMouseEnter={() => play("hover")}
                    aria-label="Close"
                    className="focus-ring font-mono text-lg text-muted-foreground transition-colors hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
                <h2 className="mask-reveal mt-3 font-display text-4xl uppercase italic leading-none tracking-tighter">
                  <span>
                    Create an account <span className="text-primary">or play as guest</span>
                  </span>
                </h2>

                <div className="mt-8 flex flex-col gap-3">
                  <Link
                    to="/auth"
                    onClick={() => play("whoosh")}
                    onMouseEnter={() => play("hover")}
                    className="cta-sweep bg-primary px-8 py-5 text-center font-mono text-sm uppercase tracking-widest text-primary-foreground"
                  >
                    Create account
                  </Link>
                  <Link
                    to="/guest"
                    onClick={() => play("whoosh")}
                    onMouseEnter={() => play("hover")}
                    className="press-pop border border-border px-8 py-5 text-center font-mono text-sm uppercase tracking-widest hover:-translate-y-0.5 hover:border-primary hover:text-primary"
                  >
                    Play as guest
                  </Link>
                </div>

                <div className="mt-6 border-t border-border pt-5 font-mono text-[10px] uppercase leading-relaxed tracking-widest text-muted-foreground">
                  As a guest you can play unranked{" "}
                  <span className="text-foreground">solo or vs a bot</span>. Your name, answers and
                  score are <span className="text-foreground">not saved</span> — no ELO, no
                  leaderboard, no match history (we only count games anonymously). Create an account
                  to unlock ranked duels, ELO and replays.
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Stat number that counts up from zero when scrolled into view. */
function CountStat({ value }: { value: number }) {
  const { ref, value: shown } = useCountUpOnView<HTMLDivElement>(value);
  return (
    <div ref={ref} className="font-display text-4xl tabular-nums">
      {shown.toLocaleString()}
    </div>
  );
}

/** Subject card with cursor-following 3D tilt + spotlight. */
function TiltSubject({ subject }: { subject: (typeof SUBJECTS)[number] }) {
  const tilt = useTilt(8);
  return (
    <div
      ref={tilt.ref}
      onMouseMove={tilt.onMouseMove}
      onMouseEnter={tilt.onMouseEnter}
      onMouseLeave={tilt.onMouseLeave}
      className="spotlight-card group h-full border border-border bg-surface/40 p-8 [transform-style:preserve-3d]"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary transition-transform duration-300 [transform:translateZ(30px)]">
        {subject.code}
      </div>
      <h3 className="mt-4 font-display text-4xl uppercase italic tracking-tighter transition-transform duration-300 group-hover:text-primary [transform:translateZ(50px)]">
        {subject.name}
      </h3>
      <p className="mt-4 font-mono text-xs uppercase leading-relaxed tracking-widest text-muted-foreground [transform:translateZ(20px)]">
        {subject.blurb}
      </p>
    </div>
  );
}
