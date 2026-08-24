import { ShieldCheck } from "lucide-react";

/** Small badge shown next to staff usernames. */
export function AdminTag({ className = "" }: { className?: string }) {
  return (
    <span
      title="Arena moderator"
      className={`inline-flex shrink-0 items-center gap-1 border border-primary/40 bg-primary/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-primary ${className}`}
    >
      <ShieldCheck className="size-3" strokeWidth={2.5} />
      Admin
    </span>
  );
}
