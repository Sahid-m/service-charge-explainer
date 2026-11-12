"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  CircleAlert,
  CircleX,
  Landmark,
  Loader2,
  Mail,
  RotateCcw,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

type Source = "ticket" | "gmail" | "bank";
type Verdict = "explained" | "partial" | "missing";

type EvidenceStep = {
  source: Source;
  searching: string;
  result: string;
  detail?: string;
  amount?: string;
  found: boolean;
  start: number;
  done: number;
};

type SampleLine = {
  label: string;
  amount: string;
  note?: string;
  appear: number;
  verdictAt: number;
  verdict: Verdict;
  verdictLabel: string;
  evidence: EvidenceStep[];
};

const LINES: SampleLine[] = [
  {
    label: "Plumbing / repairs",
    amount: "£4,200",
    appear: 300,
    verdictAt: 3300,
    verdict: "explained",
    verdictLabel: "Explained 100%",
    evidence: [
      {
        source: "ticket",
        searching: "Searching Cortile tickets…",
        result: "Ticket #T-1042",
        detail: "Burst pipe, flat 12",
        amount: "£4,200",
        found: true,
        start: 800,
        done: 1400,
      },
      {
        source: "gmail",
        searching: "Searching Gmail for contractor invoices…",
        result: "Invoice INV-2291",
        detail: "Acme Plumbing Ltd",
        amount: "£4,200",
        found: true,
        start: 1600,
        done: 2200,
      },
      {
        source: "bank",
        searching: "Matching client-account payments…",
        result: "Paid ACME PLUMBING",
        detail: "14 days after invoice",
        amount: "£4,200",
        found: true,
        start: 2400,
        done: 3000,
      },
    ],
  },
  {
    label: "Lift maintenance",
    amount: "£9,800",
    appear: 3700,
    verdictAt: 6300,
    verdict: "partial",
    verdictLabel: "Partial 32%",
    evidence: [
      {
        source: "ticket",
        searching: "Searching Cortile tickets…",
        result: "3 lift call-outs",
        detail: "Jan, Apr, Sep",
        found: true,
        start: 4100,
        done: 4700,
      },
      {
        source: "gmail",
        searching: "Searching Gmail for contractor invoices…",
        result: "1 of 3 costed",
        detail: "Invoice for April call-out only",
        amount: "£3,100",
        found: true,
        start: 4900,
        done: 5500,
      },
      {
        source: "bank",
        searching: "Matching client-account payments…",
        result: "1 payment matched",
        detail: "£6,700 unaccounted for",
        amount: "£3,100",
        found: true,
        start: 5600,
        done: 6100,
      },
    ],
  },
  {
    label: "Buildings insurance",
    amount: "£18,500",
    note: "up 41% on last year",
    appear: 6700,
    verdictAt: 9100,
    verdict: "missing",
    verdictLabel: "Not found",
    evidence: [
      {
        source: "gmail",
        searching: "Searching broker emails…",
        result: "No invoice found",
        detail: "No renewal invoice from the broker",
        found: false,
        start: 7100,
        done: 7800,
      },
      {
        source: "gmail",
        searching: "Looking for commission disclosure…",
        result: "No commission disclosure",
        detail: "Nothing explains the 41% rise",
        found: false,
        start: 7900,
        done: 8600,
      },
    ],
  },
];

const REPLY_START = 9600;
const REPLY = `Hi Sarah,

Thanks for your question about this year's service charge.

• Plumbing (£4,200): this was the burst pipe at flat 12 (ticket T-1042). Acme Plumbing invoiced £4,200 (INV-2291) and it was paid from the client account 14 days later.
• Lift maintenance (£9,800): we can evidence £3,100 for one call-out. We are asking the contractor for the other two invoices.
• Buildings insurance (£18,500): we have not yet found the broker's invoice or a commission disclosure. We will send both before we ask you to pay this line.

Kind regards,
Block management`;
const CHARS_PER_MS = 0.2;
const END = REPLY_START + REPLY.length / CHARS_PER_MS + 400;

const SOURCE_ICON: Record<Source, typeof Wrench> = {
  ticket: Wrench,
  gmail: Mail,
  bank: Landmark,
};

const VERDICT_STYLE: Record<
  Verdict,
  { className: string; icon: typeof Check }
> = {
  explained: {
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    icon: Check,
  },
  partial: {
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    icon: CircleAlert,
  },
  missing: {
    className: "border-rose-500/30 bg-rose-500/10 text-rose-700",
    icon: CircleX,
  },
};

function useElapsed(runId: number) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const started = performance.now();
    let raf = 0;
    const tick = () => {
      const now = performance.now() - started;
      setT(now);
      if (now < END) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runId]);
  return t;
}

export function SampleWalkthrough() {
  const [runId, setRunId] = useState(0);
  const t = useElapsed(runId);
  const progress = Math.min(100, (t / END) * 100);
  const typed = REPLY.slice(
    0,
    Math.max(0, Math.floor((t - REPLY_START) * CHARS_PER_MS)),
  );
  const finished = t >= END;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-amber-500/50 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            <Sparkles className="size-3" />
            Sample walkthrough — illustrative data
          </span>
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            Building A
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRunId((r) => r + 1)}
        >
          <RotateCcw />
          Replay
        </Button>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {LINES.filter((l) => t >= l.appear).map((line) => (
            <LineCard key={`${runId}-${line.label}`} line={line} t={t} />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {t >= REPLY_START - 300 && (
          <motion.div
            key={`reply-${runId}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Mail className="size-3.5" />
              Draft reply to the owner
              <span className="ml-auto">
                {finished ? "Cites found evidence only" : "Writing…"}
              </span>
            </div>
            <p className="min-h-24 font-sans text-sm leading-relaxed whitespace-pre-wrap">
              {typed}
              {!finished && (
                <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-foreground" />
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LineCard({ line, t }: { line: SampleLine; t: number }) {
  const showVerdict = t >= line.verdictAt;
  const style = VERDICT_STYLE[line.verdict];
  const VerdictIcon = style.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={cn(
        "rounded-xl border bg-card p-3 shadow-sm transition-colors sm:p-4",
        showVerdict && line.verdict === "explained" && "border-emerald-500/40",
        showVerdict && line.verdict === "partial" && "border-amber-500/40",
        showVerdict && line.verdict === "missing" && "border-rose-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{line.label}</div>
          {line.note && (
            <div className="text-xs text-rose-600">{line.note}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-sm tabular-nums">{line.amount}</span>
          <AnimatePresence>
            {showVerdict && (
              <motion.span
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                  style.className,
                )}
              >
                <VerdictIcon className="size-3" />
                {line.verdictLabel}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {line.evidence
          .filter((e) => t >= e.start)
          .map((e, i) => (
            <EvidenceRow key={i} step={e} done={t >= e.done} />
          ))}
      </ul>
    </motion.div>
  );
}

function EvidenceRow({ step, done }: { step: EvidenceStep; done: boolean }) {
  const Icon = SOURCE_ICON[step.source];
  return (
    <motion.li
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        {done ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-w-0 flex-wrap items-baseline gap-x-2"
          >
            <span
              className={cn(
                "font-medium",
                !step.found && "text-muted-foreground line-through",
              )}
            >
              {step.result}
            </span>
            {step.detail && (
              <span className="truncate text-xs text-muted-foreground">
                {step.detail}
              </span>
            )}
          </motion.div>
        ) : (
          <span className="text-muted-foreground">{step.searching}</span>
        )}
      </div>
      {done && step.amount && (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {step.amount}
        </span>
      )}
      <span className="flex size-5 shrink-0 items-center justify-center">
        {!done ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : step.found ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
            className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white"
          >
            <Check className="size-3" strokeWidth={3} />
          </motion.span>
        ) : (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
            className="flex size-5 items-center justify-center rounded-full bg-rose-500 text-white"
          >
            <X className="size-3" strokeWidth={3} />
          </motion.span>
        )}
      </span>
    </motion.li>
  );
}
