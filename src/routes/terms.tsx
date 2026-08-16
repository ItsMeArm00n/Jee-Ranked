import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
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

        <h1 className="font-display text-5xl uppercase italic tracking-tighter">
          Terms & Conditions
        </h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Last updated: August 17, 2026
        </p>

        <div className="mt-10 space-y-8 font-mono text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using JEE Ranked, you agree to be bound by these Terms & Conditions.
              If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              2. Description of Service
            </h2>
            <p>
              JEE Ranked is a competitive platform for practising JEE-level questions. Users can
              participate in ranked 1v1 duels where ELO ratings change based on results, or unranked
              practice sessions solo or against random opponents.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              3. Accounts
            </h2>
            <p>
              You are responsible for maintaining the security of your account. You must provide
              accurate information when creating an account. One account per person — duplicate
              accounts may be suspended.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              4. Fair Play
            </h2>
            <p>
              You agree to play fairly. Using bots, scripts, or any form of automation to answer
              questions is prohibited. Colluding with other players to manipulate ELO ratings is
              grounds for account suspension. We reserve the right to investigate and take action
              against suspicious activity.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              5. ELO and Ranked Play
            </h2>
            <p>
              ELO ratings are calculated using a standard algorithm and are intended to reflect your
              skill level. Unranked matches do not affect your ELO. We do not guarantee the accuracy
              of ELO ratings and they are provided as-is.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              6. Content
            </h2>
            <p>
              All questions, topics, and educational content on JEE Ranked are provided for practice
              purposes. Questions may be sourced from publicly available JEE preparation materials.
              We do not claim ownership of exam-level question content.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              7. Termination
            </h2>
            <p>
              We reserve the right to suspend or terminate your account at our discretion,
              particularly in cases of fair play violations, automated play, or abusive behaviour.
              You may also delete your account at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              8. Disclaimer
            </h2>
            <p>
              JEE Ranked is provided "as is" without warranties of any kind. We are not responsible
              for any issues arising from the use of the service. Use at your own risk.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              9. Changes to Terms
            </h2>
            <p>
              We may modify these Terms at any time. Continued use of the service after changes
              constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
              10. Contact
            </h2>
            <p>For questions about these Terms, please reach out through our support channels.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
