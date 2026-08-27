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
          Last updated: August 24, 2026
        </p>

        <div className="mt-10 space-y-8 font-mono text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              1. Information You Provide
            </h2>
            <p>
              When you create an account we collect your email address and a display name you
              choose. Your password is handled exclusively by our authentication provider (see
              Section 4) and is never visible to us. You may optionally add an avatar image and a
              short bio to your profile. As you play, we store your gameplay data: match history,
              answers, ELO rating, wins, losses, draws and related statistics. If you use the
              question report feature, we store the reason and any additional details you include,
              along with your account identifier so we can follow up on abuse.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              2. Information Collected Automatically
            </h2>
            <p>
              We use Vercel Web Analytics to understand overall site usage. It collects page views,
              referring pages, coarse country-level location and general device/browser information.
              It is cookieless: it does not store cookies in your browser, does not track you across
              other websites, and does not collect precise locations or unique persistent
              identifiers. This data is aggregated and cannot be used to identify you personally.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              3. How We Use Your Information
            </h2>
            <p>
              We use your information to provide and improve the JEE Ranked service: matchmaking,
              calculating ELO ratings, displaying leaderboards, showing your statistics and match
              replays, maintaining fair play, responding to question reports, and communicating
              service-related information. We do not sell your personal information and we do not
              share it with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              4. Authentication
            </h2>
            <p>
              Accounts are managed by Supabase Auth. Passwords are securely hashed by Supabase and
              we never have access to your plaintext password. Optionally, you may sign in with
              Google; in that case we receive your Google email address and basic profile details
              (such as your name and avatar) solely to create and identify your account.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              5. Third-Party Services
            </h2>
            <p>We rely on a small number of providers to operate the service:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Supabase</strong> — database hosting, authentication and storage. All game
                data lives in PostgreSQL with row-level security policies.
              </li>
              <li>
                <strong>Vercel</strong> — application hosting and privacy-friendly, cookieless web
                analytics.
              </li>
              <li>
                <strong>Google (Gemini API)</strong> — generates AI-powered step-by-step
                explanations for questions. Only the question content itself is sent; your name,
                email, account details or gameplay history are never included.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              6. Cookies and Local Storage
            </h2>
            <p>
              We use browser local storage to persist your authentication session so you remain
              signed in between visits. Our analytics are cookieless and we use no advertising or
              cross-site tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              7. User-Generated Text Fields
            </h2>
            <p>
              Free-text fields such as your profile bio or question report details are visible to
              (or reviewed by) our team where relevant. Please do not include sensitive personal
              information in these fields.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              8. Data Retention &amp; Deletion
            </h2>
            <p>
              Your account and match data are retained while your account is active. You may request
              deletion of your account and associated personal data at any time by emailing{" "}
              <a
                href="mailto:info@jeeranked.com"
                className="text-primary transition-colors hover:text-foreground"
              >
                info@jeeranked.com
              </a>
              . Finished match records may be retained in anonymised or aggregated form for
              leaderboard integrity and statistical purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              9. Security
            </h2>
            <p>
              Data is stored securely in Supabase cloud infrastructure with row-level security
              policies, encrypted connections, and hashed passwords. Privileged operations are
              restricted to authorised administrators.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              10. Children's Privacy
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
              11. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes
              by posting the new policy on this page with an updated "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              12. Contact
            </h2>
            <p>
              Questions about this policy? Email{" "}
              <a
                href="mailto:info@jeeranked.com"
                className="text-primary transition-colors hover:text-foreground"
              >
                info@jeeranked.com
              </a>{" "}
              or reach us on Instagram (@jeeranked) or YouTube (@jeeranked).
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
