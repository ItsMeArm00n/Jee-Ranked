import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { Avatar } from "@/components/Avatar";
import { useSession } from "@/hooks/useSession";
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
  const profileFn = useServerFn(getMyProfile);
  const leaderboard = useQuery({ queryKey: ["leaderboard"], queryFn: () => getLeaderboard() });
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => getGlobalStats() });
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileFn({}),
    enabled: !!session,
  });

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
        <div className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-14 px-6 py-20 lg:grid-cols-12 lg:py-28">
          <div className="space-y-8 lg:col-span-7">
            <div className="animate-enter inline-flex items-center gap-3 border border-border bg-surface/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              <span className="live-dot size-1.5 rounded-full bg-primary" />
              Ranked ladder is live
            </div>

            <h1 className="font-display text-[clamp(3.5rem,10vw,8rem)] uppercase italic leading-[0.82] tracking-tighter">
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
              <Link
                to={session ? "/play" : "/auth"}
                className="cta-sweep animate-enter block bg-primary px-12 py-6 text-center font-display text-3xl uppercase italic tracking-tighter text-primary-foreground [animation-delay:120ms]"
              >
                Find Opponent
              </Link>
              <a
                href="#how"
                className="animate-enter border border-border px-8 py-6 text-center font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary [animation-delay:200ms]"
              >
                How the arena works
              </a>
            </div>
          </div>

          {/* Standing card */}
          <div className="lg:col-span-5">
            <div className="wipe-enter relative border-l-4 border-primary bg-surface p-8 [animation-delay:150ms]">
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

              <div className="mt-8 grid grid-cols-3 border-t border-border pt-6 font-mono">
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
                    <div className="font-display text-4xl tabular-nums">{s.v}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {s.k}
                    </div>
                  </div>
                ))}
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
        <div className="relative overflow-hidden border-y border-border bg-surface/40 py-3">
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
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="wipe-enter border border-border bg-surface/50 p-8 lg:col-span-8">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="font-display text-3xl uppercase italic tracking-tighter">
                Global leaderboard
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Top 10
              </span>
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
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <Avatar url={p.avatar_url} name={p.username} size={26} />
                      <span>{p.username.toUpperCase()}</span>
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

          <div className="wipe-enter border border-border p-8 [animation-delay:150ms] lg:col-span-4">
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
        <section id="how" className="scroll-mt-24 border-t border-border pt-16">
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
                <div className="font-display text-6xl uppercase transition-colors duration-300 group-hover:text-primary">
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
        <section className="border-t border-border pt-16">
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
                className="tilt-card ticker-enter border border-border bg-surface/40 p-8"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
                  {s.code}
                </div>
                <h3 className="mt-4 font-display text-4xl uppercase italic tracking-tighter">
                  {s.name}
                </h3>
                <p className="mt-4 font-mono text-xs uppercase leading-relaxed tracking-widest text-muted-foreground">
                  {s.blurb}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="grid grid-cols-1 gap-10 border-t border-border pt-16 lg:grid-cols-12">
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
                  <span className="font-display text-2xl transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-2xl font-mono text-xs uppercase leading-relaxed tracking-widest text-muted-foreground">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* CLOSING CTA */}
        <section className="relative overflow-hidden border border-border bg-surface/50 p-12 text-center sm:p-20">
          <div className="arena-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative space-y-8">
            <h2 className="font-display text-[clamp(2.5rem,7vw,5.5rem)] uppercase italic leading-none tracking-tighter">
              Someone is <span className="text-primary">already queued</span>
            </h2>
            <p className="mx-auto max-w-lg font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Ten questions decide who moves up the ladder tonight.
            </p>
            <Link
              to={session ? "/play" : "/auth"}
              className="cta-sweep inline-block bg-primary px-14 py-6 font-display text-3xl uppercase italic tracking-tighter text-primary-foreground"
            >
              Enter the arena
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-12 font-mono text-[10px] uppercase tracking-widest opacity-40 sm:flex-row sm:items-center sm:justify-between">
          <div>JEE Ranked // Competitive exam protocol</div>
          <div>
            {stats.data?.players ?? 0} ranked players · {stats.data?.duels ?? 0} duels ·{" "}
            {stats.data?.questions ?? 0} questions
          </div>
        </div>
      </footer>
    </div>
  );
}
