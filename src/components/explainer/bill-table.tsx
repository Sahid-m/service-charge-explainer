"use client";

import { ChevronRight } from "lucide-react";
import type { ExplainResult, ExplainedLine } from "@/lib/explain-types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "cn";
import { gbp0, pct } from "./format";
import { STATUS_META } from "./status";

export function changeText(gbpValue: number | null) {
  if (gbpValue == null) return "New";
  return `${gbpValue > 0 ? "+" : ""}${gbp0(gbpValue)}`;
}

export function Change({
  gbpValue,
  pctValue,
  className,
}: {
  gbpValue: number | null;
  pctValue: number | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        gbpValue == null || gbpValue === 0
          ? "text-muted-foreground"
          : gbpValue > 0
            ? "text-foreground"
            : "text-emerald-700",
        className,
      )}
    >
      {changeText(gbpValue)}
      {gbpValue != null && (
        <span className="ml-1 text-muted-foreground">{pct(pctValue)}</span>
      )}
    </span>
  );
}

/** Status pill; tooltip explains the status and shows the evidence coverage. */
export function StatusPill({
  line,
  compact,
}: {
  line: ExplainedLine;
  compact?: boolean;
}) {
  const m = STATUS_META[line.status];
  const Icon = m.icon;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
            m.tone,
          )}
        >
          <Icon className="size-3.5" />
          <span className={cn(compact && "hidden sm:inline")}>{m.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        {Math.round(line.coveragePct)}% of {gbp0(line.currGbp)} is backed by
        evidence. {m.help}
      </TooltipContent>
    </Tooltip>
  );
}

export function BillTable({
  result,
  onSelect,
}: {
  result: ExplainResult;
  onSelect: (l: ExplainedLine) => void;
}) {
  const totalChange =
    result.totals.prevGbp != null
      ? result.totals.currGbp - result.totals.prevGbp
      : null;
  const totalPct =
    totalChange != null && result.totals.prevGbp
      ? (totalChange / result.totals.prevGbp) * 100
      : null;

  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="border-y text-left text-xs text-muted-foreground">
          <th className="px-4 py-2 font-medium sm:px-6">Line</th>
          <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
            This year
          </th>
          <th className="px-3 py-2 text-right font-medium">Change</th>
          <th className="px-3 py-2 font-medium">Status</th>
          <th className="w-8" />
        </tr>
      </thead>
      <tbody>
        {result.lines.map((l) => (
          <tr
            key={l.category}
            onClick={() => onSelect(l)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(l);
              }
            }}
            tabIndex={0}
            className="group cursor-pointer border-b outline-none last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50"
          >
            <td className="px-4 py-3 font-medium sm:px-6">{l.label}</td>
            <td className="hidden px-3 py-3 text-right sm:table-cell">
              {gbp0(l.currGbp)}
            </td>
            <td className="px-3 py-3 text-right">
              <Tooltip>
                <TooltipTrigger render={<span className="cursor-help" />}>
                  {changeText(l.changeGbp)}
                </TooltipTrigger>
                <TooltipContent>
                  {gbp0(l.prevGbp)} last year → {gbp0(l.currGbp)} this year (
                  {pct(l.changePct)})
                </TooltipContent>
              </Tooltip>
            </td>
            <td className="px-3 py-3">
              <StatusPill line={l} compact />
            </td>
            <td className="pr-3 text-muted-foreground">
              <ChevronRight className="size-4" />
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t font-semibold">
          <td className="px-4 py-3 sm:px-6">Total</td>
          <td className="hidden px-3 py-3 text-right sm:table-cell">
            {gbp0(result.totals.currGbp)}
          </td>
          <td className="px-3 py-3 text-right" title={pct(totalPct)}>
            {changeText(totalChange)}
          </td>
          <td colSpan={2} />
        </tr>
      </tfoot>
    </table>
  );
}
