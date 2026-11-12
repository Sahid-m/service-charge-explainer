"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  FileSpreadsheet,
  FolderOpen,
  Info,
  Landmark,
  Link2,
  Mail,
  MailCheck,
  PlayCircle,
  ReceiptText,
  RotateCw,
  ScrollText,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import type {
  BuildingOption,
  ExplainResult,
  ExplainedLine,
} from "@/lib/explain-types";
import { GmailPanel } from "@/components/gmail-panel";
import { BankPanel } from "@/components/bank-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { BillTable, Change } from "./bill-table";
import { EvidenceSheet } from "./evidence-sheet";
import { UploadDocs } from "./upload-docs";
import { DraftReplyDialog, useDraftReply } from "./draft-reply";
import { fyLabel, gbp0, pct } from "./format";
import { STATUS_META, StatusBadge } from "./status";
import { TourCard, type TourStep } from "./tour";

const DEMO_BUILDING = "bld_0853";
const HIGHLIGHT = [
  "ring-4",
  "ring-primary",
  "ring-offset-4",
  "ring-offset-background",
  "rounded-xl",
];

function AppBar({
  buildings,
  building,
  onPick,
  onDraft,
  drafting,
  canDraft,
}: {
  buildings: BuildingOption[];
  building: string | null;
  onPick: (id: string) => void;
  onDraft: () => void;
  drafting: boolean;
  canDraft: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ReceiptText className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold tracking-tight">
              Service Charge Explainer
            </div>
            <div className="hidden truncate text-xs text-muted-foreground sm:block">
              Every bill line traced to real evidence, for UK block managers
            </div>
          </div>
          <nav className="ml-2 hidden items-center gap-1 text-sm md:flex">
            <Link
              href="/"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Home
            </Link>
            <Link
              href="/onboarding"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Setup
            </Link>
          </nav>
        </div>
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <BuildingPicker
            buildings={buildings}
            value={building}
            onChange={onPick}
          />
          <Link
            href={
              building
                ? `/letters?building=${encodeURIComponent(building)}`
                : "/letters"
            }
            className={buttonVariants({
              variant: "outline",
              className: "shrink-0",
            })}
          >
            <ScrollText className="size-4" />
            <span className="hidden sm:inline">Create letter</span>
            <span className="sm:hidden">Letter</span>
          </Link>
          <Button
            onClick={onDraft}
            disabled={!canDraft || drafting}
            className="shrink-0"
          >
            <MailCheck className="size-4" />
            <span className="hidden sm:inline">
              {drafting ? "Drafting…" : "Draft reply to owner"}
            </span>
            <span className="sm:hidden">{drafting ? "…" : "Reply"}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

function HowItWorks({
  onDemo,
  onDismiss,
}: {
  onDemo: () => void;
  onDismiss: () => void;
}) {
  const steps = [
    {
      icon: ScrollText,
      title: "1. Bill lines",
      text: "We load this year's service charge, line by line, next to last year's.",
    },
    {
      icon: Link2,
      title: "2. Matched to evidence",
      text: "Each line is matched to tickets · invoices · bank payments · documents.",
    },
    {
      icon: MailCheck,
      title: "3. Plain-English reply",
      text: "One click drafts an answer to the owner citing only what we found.",
    },
  ];
  return (
    <Card className="relative bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-2 lg:w-60">
          <div className="text-sm font-semibold">
            Owners ask: “Why did my service charge go up?”
          </div>
          <p className="text-xs text-muted-foreground">
            This app answers with evidence, not guesses.
          </p>
          <Button onClick={onDemo} className="w-fit" size="lg">
            <PlayCircle className="size-4" /> Watch the demo
          </Button>
        </div>
        <ol className="grid flex-1 gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
                <s.icon className="size-4 text-primary" />
              </span>
              <div>
                <div className="flex items-center gap-1 text-sm font-medium">
                  {s.title}
                  {i < 2 && (
                    <ArrowRight className="hidden size-3.5 text-muted-foreground sm:inline" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute top-2 right-2"
          onClick={onDismiss}
          aria-label="Hide how it works"
        >
          <X />
        </Button>
      </CardContent>
    </Card>
  );
}

function SourcesBar({
  result,
  onUploaded,
}: {
  result: ExplainResult;
  onUploaded: () => void;
}) {
  const s = result.sources;
  const items = [
    {
      icon: Wrench,
      name: "Cortile tickets",
      ok: s.cortile,
      state: "Connected",
      tip: "Maintenance tickets from the Cortile property-management system: what work was done, by whom, and its cost.",
    },
    {
      icon: Mail,
      name: "Gmail invoices",
      ok: s.gmail,
      state: s.gmail ? "Connected" : "Not connected",
      tip: "Contractor invoice emails (and attachments) that prove what was billed for each job.",
      href: "/api/auth/google",
    },
    {
      icon: s.bank === "csv" ? FileSpreadsheet : Landmark,
      name: "Bank payments",
      ok: s.bank !== "none",
      state:
        s.bank === "truelayer"
          ? "Open banking"
          : s.bank === "csv"
            ? "Statement CSV"
            : "Not connected",
      tip: "Payments out of the client bank account (TrueLayer or statement CSV) that prove invoices were actually paid.",
      href: "/api/auth/truelayer",
    },
    {
      icon: FolderOpen,
      name: "Google Drive docs",
      ok: s.drive,
      state: s.drive ? "Connected" : "Via Gmail connect",
      tip: "Leases, insurance schedules and management agreements. Access is granted when you connect Gmail.",
      href: "/api/auth/google",
    },
  ];
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        Evidence sources
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div
            key={it.name}
            className="flex items-center gap-3 rounded-lg border bg-card p-3"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md",
                it.ok
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <it.icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-sm font-medium">
                <span className="truncate">{it.name}</span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="text-muted-foreground"
                        aria-label={`What is ${it.name}?`}
                      />
                    }
                  >
                    <Info className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">{it.tip}</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    it.ok ? "bg-emerald-500" : "bg-muted-foreground/40",
                  )}
                />
                {it.state}
              </div>
            </div>
            {!it.ok && it.href && (
              <a
                href={it.href}
                className={buttonVariants({ variant: "outline", size: "xs" })}
              >
                Connect
              </a>
            )}
          </div>
        ))}
      </div>
      <UploadDocs buildingId={result.building.id} onUploaded={onUploaded} />
      {result.warnings.length > 0 && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}

function Kpis({
  result,
  onOpen,
}: {
  result: ExplainResult;
  onOpen: (l: ExplainedLine) => void;
}) {
  const { totals, lines } = result;
  const change =
    totals.prevGbp != null ? totals.currGbp - totals.prevGbp : null;
  const changePct =
    change != null && totals.prevGbp ? (change / totals.prevGbp) * 100 : null;
  const explained = lines.reduce((a, l) => a + l.explainedGbp, 0);
  const coverage = totals.currGbp ? (explained / totals.currGbp) * 100 : 0;
  const count = (s: string) => lines.filter((l) => l.status === s).length;
  const biggest = lines
    .filter((l) => l.status !== "explained" && (l.changeGbp ?? 0) > 0)
    .sort((a, b) => (b.changeGbp ?? 0) - (a.changeGbp ?? 0))[0];

  return (
    <div data-tour="kpis" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card size="sm">
        <CardContent className="flex flex-col gap-1">
          <div className="text-xs text-muted-foreground">
            Total service charge, {fyLabel(result.years.curr)}
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {gbp0(totals.currGbp)}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            vs {gbp0(totals.prevGbp)} last year ·{" "}
            <Change gbpValue={change} pctValue={changePct} />
          </div>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="flex flex-col gap-1">
          <div className="text-xs text-muted-foreground">
            £ backed by evidence
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {Math.round(coverage)}%
          </div>
          <Progress value={Math.round(coverage)} className="my-1" />
          <div className="text-xs text-muted-foreground tabular-nums">
            {gbp0(explained)} of {gbp0(totals.currGbp)}
          </div>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="flex flex-col gap-2">
          <div className="text-xs text-muted-foreground">
            {lines.length} bill lines checked
          </div>
          {(["explained", "partial", "not_found"] as const).map((s) => (
            <div key={s} className="flex items-center justify-between text-sm">
              <StatusBadge status={s} />
              <span className="font-semibold tabular-nums">{count(s)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card
        size="sm"
        className={cn(
          biggest && "cursor-pointer transition-colors hover:bg-muted/40",
        )}
        onClick={() => biggest && onOpen(biggest)}
      >
        <CardContent className="flex flex-col gap-1">
          <div className="text-xs text-muted-foreground">
            Biggest unexplained increase
          </div>
          {biggest ? (
            <>
              <div className="text-lg leading-tight font-semibold">
                {biggest.label}
              </div>
              <div className="text-sm tabular-nums">
                <Change
                  gbpValue={biggest.changeGbp}
                  pctValue={biggest.changePct}
                />
              </div>
              <div className="flex items-center justify-between">
                <StatusBadge status={biggest.status} />
                <span className="text-xs font-medium text-primary">
                  See evidence →
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              None — every increase is explained.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-[420px]" />
    </div>
  );
}

function buildTour(r: ExplainResult): TourStep[] {
  const name = r.building.name;
  const find = (c: string) => r.lines.find((l) => l.category === c);
  const change =
    r.totals.prevGbp != null ? r.totals.currGbp - r.totals.prevGbp : null;
  const changePct =
    change != null && r.totals.prevGbp
      ? (change / r.totals.prevGbp) * 100
      : null;
  const n = (s: string) => r.lines.filter((l) => l.status === s).length;
  const steps: TourStep[] = [
    {
      title: `A leaseholder at ${name} asks why their service charge went up`,
      body: `The bill is ${gbp0(r.totals.currGbp)} this year vs ${gbp0(r.totals.prevGbp)} last year (${pct(changePct)}). Normally a manager digs through emails and bank statements for days.`,
      target: "kpis",
    },
    {
      title: "Every bill line is traced to evidence automatically",
      body: `${r.lines.length} lines checked against tickets, invoices, payments and documents: ${n("explained")} explained, ${n("partial")} partial, ${n("not_found")} not found.`,
      target: "table",
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
    body: `${l.chains.length} costed job${l.chains.length === 1 ? "" : "s"} traced ticket → invoice → payment. Evidence covers ${Math.round(l.coveragePct)}% of the ${gbp0(l.currGbp)} billed.`,
    line: l.category,
  }));
  lineStep("lift_maintenance", (l) => ({
    title: `${icon(l)} ${l.label}: ${l.status === "partial" ? "only part of it is evidenced" : STATUS_META[l.status].label.toLowerCase()}`,
    body: `${l.chains.length} costed call-out${l.chains.length === 1 ? "" : "s"} found${l.uncostedTickets.length ? `, ${l.uncostedTickets.length} tickets with no recorded cost` : ""}. Only ${Math.round(l.coveragePct)}% of ${gbp0(l.currGbp)} is backed.`,
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
  const [showIntro, setShowIntro] = useState(true);
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
    setShowIntro(true);
    setSelected(null);
    setTour(0);
    if (building !== DEMO_BUILDING) pick(DEMO_BUILDING);
  }
  function exitTour() {
    setTour(null);
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
        onDraft={() => result && draft.generate(result.building.id)}
        drafting={draft.loading}
        canDraft={!!result && !loading}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        {showIntro ? (
          <HowItWorks
            onDemo={startTour}
            onDismiss={() => setShowIntro(false)}
          />
        ) : (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={startTour}>
              <PlayCircle className="size-4" /> Watch the demo
            </Button>
          </div>
        )}

        {result && !loading && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {result.building.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {result.building.address}, {result.building.postcode}
            </p>
          </div>
        )}

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
        ) : result ? (
          <>
            <SourcesBar
              result={result}
              onUploaded={() => setReload((n) => n + 1)}
            />
            <Kpis result={result} onOpen={setSelected} />
            <BillTable result={result} onSelect={setSelected} />
          </>
        ) : null}

        <Collapsible className="rounded-xl border">
          <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-sm font-semibold">
            Manage connections (Gmail, Drive, bank account)
            <ChevronDown className="size-4 transition-transform group-data-[panel-open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid items-start gap-4 p-4 pt-0 lg:grid-cols-2">
              <GmailPanel />
              <BankPanel />
            </div>
          </CollapsibleContent>
        </Collapsible>
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
          onExit={exitTour}
        />
      )}
    </TooltipProvider>
  );
}
