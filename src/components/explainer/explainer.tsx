"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Info,
  MailCheck,
  Minus,
  PlayCircle,
  ReceiptText,
  RotateCw,
  ScrollText,
  TriangleAlert,
} from "lucide-react";
import type {
  BuildingOption,
  ExplainResult,
  ExplainedLine,
} from "@/lib/explain-types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "cn";
import { BuildingPicker } from "./building-picker";
import { BillTable, Change, StatusPill } from "./bill-table";
import { EvidenceSheet } from "./evidence-sheet";
import { UploadDocs } from "./upload-docs";
import { DraftReplyDialog, useDraftReply } from "./draft-reply";
import { fyLabel, gbp0, pct } from "./format";
import { STATUS_META } from "./status";
import { TourCard, type TourStep } from "./tour";

const DEMO_BUILDING = "bld_0853";
const HIGHLIGHT = [
  "ring-4",
  "ring-primary",
  "ring-offset-4",
  "ring-offset-page",
  "rounded-xl",
];

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Everything the summary needs, computed once from the API result. */
function summarise(r: ExplainResult) {
  const change =
    r.totals.prevGbp != null ? r.totals.currGbp - r.totals.prevGbp : null;
  const changePct =
    change != null && r.totals.prevGbp
      ? (change / r.totals.prevGbp) * 100
      : null;
  const explained = r.lines.reduce((a, l) => a + l.explainedGbp, 0);
  const coverage = r.totals.currGbp ? (explained / r.totals.currGbp) * 100 : 0;
  const increases = r.lines.filter((l) => (l.changeGbp ?? 0) > 0);
  const backed = increases.filter((l) => l.status === "explained");
  const needs = increases
    .filter((l) => l.status !== "explained")
    .sort((a, b) => (b.changeGbp ?? 0) - (a.changeGbp ?? 0));
  const sum = (ls: ExplainedLine[]) =>
    ls.reduce((a, l) => a + (l.changeGbp ?? 0), 0);
  return {
    change,
    changePct,
    explained,
    coverage,
    backedGbp: sum(backed),
    needs,
    needsGbp: sum(needs),
  };
}

/** One plain sentence saying what evidence is missing for a line. */
function missingSentence(l: ExplainedLine): string {
  const jobs = l.chains.length;
  const invoiced = l.chains.filter((c) => c.email).length;
  if (l.status === "not_found")
    return l.docs.length
      ? "A document is on file, but no invoice or payment was found"
      : "No invoice, payment or ticket found";
  if (jobs === 0)
    return l.uncostedTickets.length
      ? `${plural(l.uncostedTickets.length, "ticket")} found, but none has a cost`
      : `Evidence covers only ${Math.round(l.coveragePct)}% of the cost`;
  if (invoiced < jobs)
    return invoiced === 0
      ? `${plural(jobs, "job")} found, but no invoice yet`
      : `${invoiced} of ${plural(jobs, "job")} ${invoiced === 1 ? "has" : "have"} an invoice`;
  return `Evidence covers only ${Math.round(l.coveragePct)}% of the ${gbp0(l.currGbp)} billed`;
}

function AppBar({
  buildings,
  building,
  onPick,
  onDemo,
}: {
  buildings: BuildingOption[];
  building: string | null;
  onPick: (id: string) => void;
  onDemo: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ReceiptText className="size-4" />
          </span>
          <span className="truncate font-semibold tracking-tight">
            Service Lens
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:order-last">
          <Link
            href="/onboarding"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Setup
          </Link>
          <Button variant="ghost" size="sm" onClick={onDemo}>
            <PlayCircle className="size-4" />
            <span className="hidden sm:inline">Watch the demo</span>
            <span className="sm:hidden">Demo</span>
          </Button>
        </nav>
        <div className="flex w-full sm:w-auto">
          <BuildingPicker
            buildings={buildings}
            value={building}
            onChange={onPick}
          />
        </div>
      </div>
    </header>
  );
}

function Verdict({
  result,
  s,
  onDraft,
  drafting,
}: {
  result: ExplainResult;
  s: ReturnType<typeof summarise>;
  onDraft: () => void;
  drafting: boolean;
}) {
  const name = result.building.name;
  const headline =
    s.change == null
      ? `${name}'s service charge is ${gbp0(result.totals.currGbp)} this year.`
      : s.change >= 0
        ? `${name}'s service charge is up ${gbp0(s.change)} (${pct(s.changePct)}) this year.`
        : `${name}'s service charge is down ${gbp0(-s.change)} (${pct(s.changePct)}) this year.`;
  return (
    <Card data-tour="verdict" className="gap-6 p-6 sm:p-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance">
          {headline}
        </h1>
        <p className="text-sm text-muted-foreground">
          {s.needs.length === 0 ? (
            "Every increase is backed by evidence."
          ) : (
            <>
              {gbp0(s.backedGbp)} of the increases are backed by evidence.{" "}
              <span className="font-medium text-coral">
                {gbp0(s.needsGbp)} across {plural(s.needs.length, "line")} still
                need evidence.
              </span>
            </>
          )}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/letters?building=${encodeURIComponent(result.building.id)}`}
          className={buttonVariants({ size: "lg" })}
        >
          <ScrollText className="size-4" /> Create service charge letter
        </Link>
        <Button
          variant="outline"
          size="lg"
          onClick={onDraft}
          disabled={drafting}
        >
          <MailCheck className="size-4" />
          {drafting ? "Drafting…" : "Draft reply to owner"}
        </Button>
      </div>
    </Card>
  );
}

function SourcesLine({
  result,
  onUploaded,
}: {
  result: ExplainResult;
  onUploaded: () => void;
}) {
  const s = result.sources;
  const hasPdf = result.lines.some((l) =>
    l.chains.some((c) => c.email?.source === "pdf"),
  );
  const items = [
    { name: "Cortile tickets", ok: s.cortile },
    { name: "Invoices (PDF/Gmail)", ok: s.gmail || hasPdf },
    { name: "Bank payments", ok: s.bank !== "none" },
    { name: "Drive", ok: s.drive },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>Evidence from:</span>
        {items.map((it) => (
          <span key={it.name} className="inline-flex items-center gap-1">
            {it.name}
            {it.ok ? (
              <Check className="size-3.5 text-emerald-600" aria-label="on" />
            ) : (
              <Minus className="size-3.5" aria-label="off" />
            )}
          </span>
        ))}
        {result.warnings.length > 0 && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="text-coral"
                  aria-label="Source warnings"
                />
              }
            >
              <Info className="size-4" />
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
              {result.warnings.join(" ")}
            </TooltipContent>
          </Tooltip>
        )}
        <Link
          href="/onboarding"
          className="font-medium text-primary hover:underline"
        >
          Manage
        </Link>
      </div>
      <UploadDocs buildingId={result.building.id} onUploaded={onUploaded} />
    </div>
  );
}

function Tiles({
  result,
  s,
}: {
  result: ExplainResult;
  s: ReturnType<typeof summarise>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      <Card className="gap-1 p-3 sm:p-5">
        <div className="text-xs text-muted-foreground sm:text-sm">
          Change vs last year
        </div>
        <div className="text-lg font-semibold tabular-nums sm:text-2xl">
          {s.change == null
            ? "–"
            : `${s.change > 0 ? "+" : ""}${gbp0(s.change)}`}
        </div>
        <div className="hidden text-muted-foreground tabular-nums sm:block">
          {pct(s.changePct)} vs {gbp0(result.totals.prevGbp)}
        </div>
      </Card>
      <Card className="gap-1 p-3 sm:p-5">
        <div className="text-xs text-muted-foreground sm:text-sm">
          Bill backed by evidence
        </div>
        <div className="text-lg font-semibold tabular-nums sm:text-2xl">
          {Math.round(s.coverage)}%
        </div>
        <Progress value={Math.round(s.coverage)} className="mt-1 sm:mt-2" />
        <div className="hidden text-muted-foreground tabular-nums sm:block">
          {gbp0(s.explained)} of {gbp0(result.totals.currGbp)}
        </div>
      </Card>
      <Card className="gap-1 p-3 sm:p-5">
        <div className="text-xs text-muted-foreground sm:text-sm">
          Lines needing evidence
        </div>
        <div
          className={cn(
            "text-lg font-semibold tabular-nums sm:text-2xl",
            s.needs.length > 0 ? "text-coral" : "text-emerald-700",
          )}
        >
          {s.needs.length}
        </div>
        <div className="hidden text-muted-foreground sm:block">
          increases without full evidence
        </div>
      </Card>
    </div>
  );
}

function Attention({
  needs,
  onOpen,
}: {
  needs: ExplainedLine[];
  onOpen: (l: ExplainedLine) => void;
}) {
  const top = needs.slice(0, 5);
  return (
    <Card data-tour="attention" className="gap-0 py-0">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3 sm:px-6">
        <h2 className="text-base font-semibold">Needs your attention</h2>
        {needs.length > top.length && (
          <span className="text-muted-foreground">
            Top {top.length} of {needs.length}
          </span>
        )}
      </div>
      {top.length === 0 ? (
        <div className="flex items-center gap-2 px-5 pb-6 text-muted-foreground sm:px-6">
          <CircleCheck className="size-4 text-emerald-600" />
          All increases are backed by evidence.
        </div>
      ) : (
        <ul className="divide-y border-t">
          {top.map((l) => (
            <li key={l.category}>
              <button
                type="button"
                onClick={() => onOpen(l)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:gap-6 sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{l.label}</div>
                  <div className="text-muted-foreground">
                    {missingSentence(l)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-6">
                  <Change gbpValue={l.changeGbp} pctValue={l.changePct} />
                  <span className="sm:w-28">
                    <StatusPill line={l} />
                  </span>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FullBill({
  result,
  onSelect,
}: {
  result: ExplainResult;
  onSelect: (l: ExplainedLine) => void;
}) {
  return (
    <Collapsible>
      <Card className="gap-0 py-0">
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-medium hover:bg-muted/50 sm:px-6">
          <span>
            See all {result.lines.length} bill lines
            <span className="ml-2 font-normal text-muted-foreground">
              {fyLabel(result.years.curr)}
            </span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <BillTable result={result} onSelect={onSelect} />
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-44" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

function buildTour(r: ExplainResult): TourStep[] {
  const name = r.building.name;
  const s = summarise(r);
  const find = (c: string) => r.lines.find((l) => l.category === c);
  const steps: TourStep[] = [
    {
      title: `A leaseholder at ${name} asks why their service charge went up`,
      body: `The answer is at the top: ${gbp0(r.totals.currGbp)} this year vs ${gbp0(r.totals.prevGbp)} last year (${pct(s.changePct)}). Every bill line was checked against tickets, invoices, payments and documents automatically.`,
      target: "verdict",
    },
    {
      title: "Only what needs you",
      body: s.needs.length
        ? `${plural(s.needs.length, "increase")} (${gbp0(s.needsGbp)}) lack full evidence. The biggest are listed here, each with what's missing.`
        : "Every increase is backed by evidence — nothing needs chasing.",
      target: "attention",
    },
  ];
  const lineStep = (cat: string, mk: (l: ExplainedLine) => TourStep) => {
    const l = find(cat);
    if (l) steps.push(mk(l));
  };
  const icon = (l: ExplainedLine) =>
    l.status === "explained" ? "✓" : l.status === "partial" ? "⚠" : "✗";
  lineStep("repairs_and_maintenance", (l) => ({
    title: `${icon(l)} ${l.label}: ${STATUS_META[l.status].label.toLowerCase()}`,
    body: `${plural(l.chains.length, "costed job")} traced ticket → invoice → payment. Evidence covers ${Math.round(l.coveragePct)}% of the ${gbp0(l.currGbp)} billed.`,
    line: l.category,
  }));
  lineStep("lift_maintenance", (l) => ({
    title: `${icon(l)} ${l.label}: ${l.status === "partial" ? "only part of it is evidenced" : STATUS_META[l.status].label.toLowerCase()}`,
    body: `${plural(l.chains.length, "costed call-out")} found${l.uncostedTickets.length ? `, ${plural(l.uncostedTickets.length, "ticket")} with no recorded cost` : ""}. Only ${Math.round(l.coveragePct)}% of ${gbp0(l.currGbp)} is backed.`,
    line: l.category,
  }));
  lineStep("buildings_insurance", (l) => ({
    title: `${icon(l)} ${l.label} ${pct(l.changePct)} — ${l.status === "not_found" ? "no evidence" : `${Math.round(l.coveragePct)}% evidenced`}`,
    body:
      l.status === "not_found"
        ? "No broker invoice, payment or policy document matched. We say so — we don't guess."
        : `Evidence covers ${Math.round(l.coveragePct)}% of ${gbp0(l.currGbp)}.`,
    line: l.category,
  }));
  steps[steps.length - 1] = {
    ...steps[steps.length - 1],
    body:
      steps[steps.length - 1].body +
      " Next: one click drafts a plain-English reply citing only what was found.",
  };
  return steps;
}

export function Explainer() {
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [building, setBuilding] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<ExplainedLine | null>(null);
  const [tour, setTour] = useState<number | null>(null);
  const draft = useDraftReply();

  useEffect(() => {
    fetch("/api/buildings")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<BuildingOption[]>;
      })
      .then((b) => {
        setBuildings(b);
        const fromUrl = new URLSearchParams(window.location.search).get(
          "building",
        );
        const pick =
          b.find((x) => x.id === fromUrl) ??
          b.find((x) => x.id === DEMO_BUILDING) ??
          b[0];
        if (pick) setBuilding(pick.id);
        else setLoading(false);
      })
      .catch((e) => {
        setError(`Could not load buildings: ${e.message}`);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!building) return;
    let cancelled = false;
    fetch(`/api/explain?building=${encodeURIComponent(building)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ExplainResult>;
      })
      .then((r) => !cancelled && setResult(r))
      .catch((e) => !cancelled && setError(`Could not load bill: ${e.message}`))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [building, reload]);

  function pick(id: string) {
    if (id === building) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    setBuilding(id);
  }

  const summary = useMemo(() => (result ? summarise(result) : null), [result]);
  const steps = useMemo(() => (result ? buildTour(result) : []), [result]);
  const tourReady =
    tour != null && !loading && result?.building.id === DEMO_BUILDING;
  const step = tourReady ? steps[Math.min(tour, steps.length - 1)] : undefined;

  // Highlight + scroll the current tour target.
  useEffect(() => {
    if (!step?.target) return;
    const el = document.querySelector<HTMLElement>(
      `[data-tour="${step.target}"]`,
    );
    if (!el) return;
    el.classList.add(...HIGHLIGHT);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => el.classList.remove(...HIGHLIGHT);
  }, [step]);

  function go(i: number) {
    const s = steps[i];
    if (!s) return;
    setTour(i);
    setSelected(
      s.line
        ? (result?.lines.find((l) => l.category === s.line) ?? null)
        : null,
    );
  }
  function startTour() {
    setSelected(null);
    setTour(0);
    if (building !== DEMO_BUILDING) pick(DEMO_BUILDING);
  }
  function next() {
    if (tour == null) return;
    if (tour >= steps.length - 1) {
      setTour(null);
      setSelected(null);
      if (result) void draft.generate(result.building.id);
      return;
    }
    go(tour + 1);
  }

  const demoName =
    buildings.find((b) => b.id === DEMO_BUILDING)?.name ?? "demo building";

  return (
    <TooltipProvider delay={150}>
      <AppBar
        buildings={buildings}
        building={building}
        onPick={pick}
        onDemo={startTour}
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {error}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  if (building) setReload((n) => n + 1);
                  else window.location.reload();
                }}
              >
                <RotateCw className="size-3.5" /> Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : result && summary ? (
          <>
            <div className="flex flex-col gap-3">
              <Verdict
                result={result}
                s={summary}
                onDraft={() => draft.generate(result.building.id)}
                drafting={draft.loading}
              />
              <SourcesLine
                result={result}
                onUploaded={() => setReload((n) => n + 1)}
              />
            </div>
            <Tiles result={result} s={summary} />
            <Attention needs={summary.needs} onOpen={setSelected} />
            <FullBill result={result} onSelect={setSelected} />
          </>
        ) : null}
      </main>

      <EvidenceSheet
        line={selected}
        onClose={() => setSelected(null)}
        touring={tour != null}
      />
      {result && (
        <DraftReplyDialog state={draft} buildingName={result.building.name} />
      )}
      {tour != null && (
        <TourCard
          steps={steps}
          index={Math.min(tour, Math.max(steps.length - 1, 0))}
          loading={!tourReady}
          loadingLabel={`Loading ${demoName}…`}
          sheetOpen={!!selected}
          onBack={() => tour > 0 && go(tour - 1)}
          onNext={next}
          onExit={() => setTour(null)}
        />
      )}
    </TooltipProvider>
  );
}
