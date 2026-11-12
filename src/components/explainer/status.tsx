import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import type { Status } from "@/lib/explain-types";
import { cn } from "cn";

export const STATUS_META: Record<
  Status,
  {
    label: string;
    icon: typeof CircleCheck;
    tone: string;
    bar: string;
    help: string;
  }
> = {
  explained: {
    label: "Explained",
    icon: CircleCheck,
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    bar: "bg-emerald-500",
    help: "Matched tickets, invoices and payments cover at least 80% of this line's cost.",
  },
  partial: {
    label: "Partial",
    icon: CircleAlert,
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    bar: "bg-amber-500",
    help: "Some evidence was found, but it covers less than 80% of this line's cost.",
  },
  not_found: {
    label: "Not found",
    icon: CircleX,
    tone: "border-rose-500/30 bg-rose-500/10 text-rose-700",
    bar: "bg-rose-500",
    help: "No ticket, invoice, payment or document matched this line. We never invent evidence.",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        m.tone,
        className,
      )}
    >
      <Icon className="size-3.5" />
      {m.label}
    </span>
  );
}

export function CoverageBar({
  value,
  status,
  className,
}: {
  value: number;
  status: Status;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          STATUS_META[status].bar,
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
