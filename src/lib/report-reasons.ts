import type { ReportReason } from "@/lib/game.functions";

export const REASON_LABELS: Record<ReportReason, string> = {
  missing_options: "Missing options",
  incorrect_option: "Incorrect option",
  wrong_answer: "Wrong answer marked correct",
  missing_info: "Missing information",
  rendering_issue: "Rendering / formatting issue",
  other: "Other",
};
