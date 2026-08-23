import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_REASONS, submitQuestionReport, type ReportReason } from "@/lib/game.functions";
import { REASON_LABELS } from "@/lib/report-reasons";

const REASON_HINTS: Record<ReportReason, string> = {
  missing_options: "Fewer than four options, or options are blank",
  incorrect_option: "An option contains wrong content",
  wrong_answer: "The marked correct answer is actually wrong",
  missing_info: "Figure, diagram or data needed to solve it is missing",
  rendering_issue: "Broken LaTeX, garbled symbols, bad layout",
  other: "Anything else wrong with this question",
};

export function ReportQuestionDialog({
  questionId,
  matchId,
  questionIndex,
}: {
  questionId: string;
  matchId?: string;
  questionIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reported, setReported] = useState(false);

  const submitFn = useServerFn(submitQuestionReport);

  async function handleSubmit() {
    if (!reason || submitting || reported) return;
    setSubmitting(true);
    try {
      const res = await submitFn({
        data: {
          questionId,
          matchId: matchId ?? null,
          questionIndex: questionIndex ?? null,
          reason,
          details: details.trim() || undefined,
        },
      });
      if ("duplicate" in res && res.duplicate) {
        setReported(true);
        toast.info(res.reason ?? "You have already reported this question");
        setOpen(false);
      } else if (res.ok) {
        setReported(true);
        toast.success("Report submitted — thanks for helping improve the question bank");
        setOpen(false);
      } else {
        toast.error(res.reason ?? "Could not submit report");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit report");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={reported}
        aria-label={reported ? "Question reported" : "Report this question"}
        title={reported ? "You reported this question" : "Report an issue with this question"}
        onMouseEnter={(e) => !reported && e.currentTarget.classList.add("text-destructive")}
        onMouseLeave={(e) => !reported && e.currentTarget.classList.remove("text-destructive")}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`shrink-0 border border-border p-2 font-mono uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-destructive ${
          reported ? "cursor-default text-muted-foreground/40" : "text-muted-foreground"
        }`}
      >
        <Flag className="size-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border border-border bg-background font-mono sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm uppercase tracking-[0.25em] text-primary">
              Report this question
            </DialogTitle>
            <DialogDescription className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Spotted something wrong? Tell us what it is.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`border px-3 py-2 text-left text-xs transition-all duration-200 ${
                    reason === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  <span className="block uppercase tracking-widest">{REASON_LABELS[r]}</span>
                  <span className="mt-0.5 block text-[10px] normal-case tracking-normal opacity-70">
                    {REASON_HINTS[r]}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="report-details"
                className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground"
              >
                Details (optional)
              </label>
              <Textarea
                id="report-details"
                value={details}
                maxLength={1000}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. Option B should be 4R, not 2R…"
                className="min-h-24 resize-none border-border bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/40"
              />
              <div className="text-right text-[10px] text-muted-foreground">
                {details.length}/1000
              </div>
            </div>

            <button
              type="button"
              disabled={!reason || submitting || reported}
              onClick={handleSubmit}
              className="w-full bg-primary py-3 text-xs uppercase tracking-[0.25em] text-primary-foreground transition-all disabled:opacity-40"
            >
              {reported ? "Already reported" : submitting ? "Submitting…" : "Submit report"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
