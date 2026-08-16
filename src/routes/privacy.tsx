import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link
          to="/"
          className="mb-8 inline-block font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
        >
          &larr; Back to home
        </Link>

        <h1 className="font-display text-5xl uppercase italic tracking-tighter">Privacy Policy</h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Last updated: August 17, 2026
        </p>

        <div className="mt-10 space-y-8 font-mono text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              1. Information We Collect
            </h2>
            <p>
              When you create an account, we collect your email address and a display name you
              choose. We also store your gameplay data including match history, answers, ELO rating,
              wins, losses, and draws.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              2. How We Use Your Information
            </h2>
            <p>
              We use your information to provide and improve the JEE Ranked service, including
              matchmaking, calculating ELO ratings, displaying leaderboards, and tracking your
              progress. We do not sell or share your personal information with third parties for
              marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              3. Authentication
            </h2>
            <p>
              Authentication is handled by Supabase Auth. Your password is securely hashed and
              stored by Supabase. We never have access to your plaintext password.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              4. Data Storage
            </h2>
            <p>
              All data is stored securely in Supabase cloud infrastructure. Match data, profiles,
              and gameplay statistics are stored in PostgreSQL databases with row-level security
              policies ensuring you can only access your own data and public leaderboard
              information.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              5. Cookies and Local Storage
            </h2>
            <p>
              We use browser local storage to persist your authentication session. This is necessary
              for you to remain signed in between visits. No tracking cookies are used.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              6. Data Retention
            </h2>
            <p>
              Your account and match data are retained as long as your account is active. If you
              wish to have your data deleted, please contact us. Finished match records may be
              retained for leaderboard and statistical purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              7. Children's Privacy
            </h2>
            <p>
              JEE Ranked is intended for students preparing for JEE examinations. We do not
              knowingly collect information from children under the age of 13. If we learn that we
              have collected personal information from a child under 13, we will take steps to
              delete that information.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              8. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes
              by posting the new policy on this page with an updated "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              9. Contact
            </h2>
            <p>
              If you have any questions about this Privacy Policy, please reach out through our
              support channels.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
