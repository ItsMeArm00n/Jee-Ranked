import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import {
  getQuestionReports,
  isAdmin,
  setReportStatus,
  type QuestionReportRow,
} from "@/lib/game.functions";
import { REASON_LABELS } from "@/lib/report-reasons";
import { renderLatex } from "@/lib/latex";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  beforeLoad: async () => {
    // Admin-only. The data server function enforces this too —
    // this redirect is just a friendlier UX for non-admins.
    const admin = await isAdmin();
    if (!admin) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [{ title: "Question Reports — JEE Ranked" }],
  }),
  component: AdminReportsPage,
});

const FILTERS = ["open", "resolved", "all"] as const;
type Filter = (typeof FILTERS)[number];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ReportCard({
  report,
  onSetStatus,
  busy,
}: {
  report: QuestionReportRow;
  onSetStatus: (id: string, status: "open" | "resolved") => void;
  busy: boolean;
}) {
  const q = report.question;
  return (
    <div className="space-y-4 border border-border bg-surface/30 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
          <span
            className={`border px-2 py-1 ${
              report.status === "open"
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "border-success/50 bg-success/10 text-success"
            }`}
          >
            {report.status}
          </span>
          <span className="border border-primary/40 bg-primary/5 px-2 py-1 text-primary">
            {REASON_LABELS[report.reason as keyof typeof REASON_LABELS] ?? report.reason}
          </span>
          {q ? (
            <span className="text-muted-foreground">
              {q.subject} / {q.topic}
              {report.question_index !== null ? ` · Q${report.question_index + 1}` : ""}
            </span>
          ) : (
            <span className="text-muted-foreground">question deleted</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onSetStatus(report.id, report.status === "open" ? "resolved" : "open")}
            className={`border px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-40 ${
              report.status === "open"
                ? "border-success/60 text-success hover:bg-success/10"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {report.status === "open" ? "Mark resolved" : "Re-open"}
          </button>
        </div>
      </div>

      {q ? (
        <>
          <div
            className="max-w-[70ch] text-sm leading-relaxed text-foreground/90"
            dangerouslySetInnerHTML={{ __html: renderLatex(q.stem) }}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(["A", "B", "C", "D"] as const).map((key) => {
              const text =
                key === "A"
                  ? q.option_a
                  : key === "B"
                    ? q.option_b
                    : key === "C"
                      ? q.option_c
                      : q.option_d;
              const isCorrect = key === q.correct_option;
              return (
                <div
                  key={key}
                  className={`border p-3 font-mono text-xs transition-colors ${
                    isCorrect
                      ? "border-success/50 bg-success/5 text-success"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <span className="mr-2 font-bold">{key}.</span>
                  <span dangerouslySetInnerHTML={{ __html: renderLatex(text ?? "") }} />
                  {isCorrect ? (
                    <span className="ml-2 rounded bg-success/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
                      correct
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {report.details ? (
        <div className="border-l-2 border-primary/40 bg-primary/5 px-4 py-2 text-xs leading-relaxed text-foreground/80">
          “{report.details}”
        </div>
      ) : null}

      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Reported by @{report.reporterUsername ?? "unknown"} · {formatDate(report.created_at)}
      </div>
    </div>
  );
}

function AdminReportsPage() {
  const reportsFn = useServerFn(getQuestionReports);
  const setStatusFn = useServerFn(setReportStatus);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("open");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-question-reports"],
    queryFn: () => reportsFn({}),
  });

  async function handleSetStatus(id: string, status: "open" | "resolved") {
    setBusyId(id);
    try {
      await setStatusFn({ data: { reportId: id, status } });
      toast.success(status === "resolved" ? "Marked resolved" : "Re-opened");
      await queryClient.invalidateQueries({ queryKey: ["admin-question-reports"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update report");
    } finally {
      setBusyId(null);
    }
  }

  const rows = (data ?? []).filter((r) => (filter === "all" ? true : r.status === filter));
  const openCount = (data ?? []).filter((r) => r.status === "open").length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <div className="wipe-enter space-y-1 border-b border-border pb-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Admin
          </span>
          <h1 className="mask-reveal font-display text-5xl uppercase italic leading-none tracking-tighter">
            Question reports{" "}
            {openCount > 0 ? <span className="text-destructive">({openCount})</span> : null}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`border px-4 py-2 font-mono text-xs uppercase tracking-widest transition-all duration-300 ${
                filter === f
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-24 text-center font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Loading reports…
          </div>
        ) : error ? (
          <div className="py-24 text-center font-mono text-xs uppercase tracking-[0.3em] text-destructive">
            {(error as Error).message}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-24 text-center font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            No {filter === "all" ? "" : filter} reports
          </div>
        ) : (
          <div className="space-y-6">
            {rows.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                onSetStatus={handleSetStatus}
                busy={busyId === r.id}
              />
            ))}
          </div>
        )}

        <Link
          to="/"
          className="inline-block border border-border px-6 py-3 font-mono text-xs uppercase tracking-widest text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
        >
          ← Back to lobby
        </Link>
      </main>
    </div>
  );
}
