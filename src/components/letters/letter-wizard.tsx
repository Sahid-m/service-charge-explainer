"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Home,
  Loader2,
  Pencil,
  ReceiptText,
  RotateCw,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { BuildingOption, Status } from "@/lib/explain-types";
import type {
  LetterDraft,
  LetterLine,
  LetterPdfRequest,
  UnitOption,
} from "@/lib/letter-types";
import { BuildingPicker } from "@/components/explainer/building-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";

const DEFAULT_BUILDING = "bld_0853";
const STEPS = ["Building & recipient", "Review & approve", "Letter ready"];

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});
const fmt = (n: number | null | undefined) => (n == null ? "—" : gbp.format(n));

const STATUS: Record<Status, { label: string; cls: string }> = {
  explained: {
    label: "Explained",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  partial: {
    label: "Partial",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
  },
  not_found: {
    label: "Not found",
    cls: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

async function readError(res: Response) {
  try {
    const j = await res.json();
    return j.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function LetterWizard() {
  const params = useSearchParams();
  const [step, setStep] = useState(0);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [building, setBuilding] = useState<string>(
    params.get("building") ?? DEFAULT_BUILDING,
  );
  const [mode, setMode] = useState<"building" | "unit">("building");
  const [unitsState, setUnitsState] = useState<{
    building: string;
    units: UnitOption[];
  } | null>(null);
  const unitsLoading = unitsState?.building !== building;
  const units = unitsLoading ? [] : (unitsState?.units ?? []);
  const [unitId, setUnitId] = useState<string>("");
  const [recipientName, setRecipientName] = useState("");

  const [draft, setDraft] = useState<LetterDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<{ msg: string; retry: () => void } | null>(
    null,
  );
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/buildings")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((b: BuildingOption[]) => setBuildings(b))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!building) return;
    let cancelled = false;
    fetch(`/api/letters/units?building=${encodeURIComponent(building)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(
        (u: UnitOption[]) =>
          !cancelled && setUnitsState({ building, units: u }),
      )
      .catch(() => !cancelled && setUnitsState({ building, units: [] }));
    return () => {
      cancelled = true;
    };
  }, [building]);

  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    },
    [pdfUrl],
  );

  const unit =
    mode === "unit" ? (units.find((u) => u.unitId === unitId) ?? null) : null;
  const buildingName =
    buildings.find((b) => b.id === building)?.name ?? draft?.buildingName;

  async function runDraft() {
    setError(null);
    setDrafting(true);
    try {
      const res = await fetch("/api/letters/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ building }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const d: LetterDraft = await res.json();
      setDraft(d);
      setStep(1);
    } catch (e) {
      setError({ msg: (e as Error).message, retry: runDraft });
    } finally {
      setDrafting(false);
    }
  }

  async function runPdf() {
    if (!draft) return;
    setError(null);
    setGenerating(true);
    const body: LetterPdfRequest = {
      buildingId: draft.buildingId,
      unitId: unit?.unitId ?? null,
      recipientName: recipientName.trim() || null,
      intro: draft.intro,
      lines: draft.lines.map((l) => ({
        category: l.category,
        include: l.include,
        explanation: l.explanation,
      })),
    };
    try {
      const res = await fetch("/api/letters/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      download(url);
      setStep(2);
    } catch (e) {
      setError({ msg: (e as Error).message, retry: runPdf });
    } finally {
      setGenerating(false);
    }
  }

  function download(url = pdfUrl) {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    const slug = (draft?.buildingName ?? "building")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    a.download = `service-charge-letter-${slug}${unit ? `-flat-${unit.unitNumber}` : ""}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function updateLine(i: number, patch: Partial<LetterLine>) {
    setDraft((d) =>
      d
        ? {
            ...d,
            lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)),
          }
        : d,
    );
  }

  return (
    <div className="min-h-dvh bg-page">
      <header className="border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ReceiptText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold tracking-tight">
              Create service charge letter
            </div>
            <div className="truncate text-xs text-muted-foreground">
              Evidence-backed explanations for leaseholders
            </div>
          </div>
          <Link
            href={`/app?building=${encodeURIComponent(building)}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-8 pb-40 sm:px-6">
        <Stepper step={step} />

        {error && (
          <Alert variant="destructive" className="mt-6">
            <TriangleAlert />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              <p>{error.msg}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={error.retry}
              >
                <RotateCw className="size-3.5" /> Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={drafting ? "drafting" : step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mt-8"
          >
            {drafting ? (
              <DraftingState name={buildingName} />
            ) : step === 0 ? (
              <StepRecipient
                buildings={buildings}
                building={building}
                setBuilding={(id) => {
                  setBuilding(id);
                  setUnitId("");
                }}
                mode={mode}
                setMode={setMode}
                units={units}
                unitsLoading={unitsLoading}
                unitId={unitId}
                setUnitId={setUnitId}
                recipientName={recipientName}
                setRecipientName={setRecipientName}
                canContinue={!!building && (mode === "building" || !!unit)}
                onContinue={runDraft}
              />
            ) : step === 1 && draft ? (
              <StepReview
                draft={draft}
                unit={unit}
                setIntro={(intro) => setDraft({ ...draft, intro })}
                updateLine={updateLine}
                onBack={() => setStep(0)}
              />
            ) : step === 2 && draft ? (
              <StepDone
                draft={draft}
                unit={unit}
                pdfUrl={pdfUrl}
                onDownload={() => download()}
                onEdit={() => setStep(1)}
                building={building}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </main>

      {step === 1 && draft && !drafting && (
        <ReviewBar
          draft={draft}
          unit={unit}
          busy={generating}
          onApprove={runPdf}
        />
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={s} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary ring-4 ring-primary/15",
                !done && !active && "bg-background text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "truncate text-sm",
                active ? "font-medium" : "text-muted-foreground",
                !active && "hidden sm:inline",
              )}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "h-px min-w-4 flex-1",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepRecipient(props: {
  buildings: BuildingOption[];
  building: string;
  setBuilding: (id: string) => void;
  mode: "building" | "unit";
  setMode: (m: "building" | "unit") => void;
  units: UnitOption[];
  unitsLoading: boolean;
  unitId: string;
  setUnitId: (id: string) => void;
  recipientName: string;
  setRecipientName: (s: string) => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  const sortedUnits = useMemo(
    () =>
      [...props.units].sort((a, b) =>
        a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }),
      ),
    [props.units],
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Who is this letter for?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a building and recipient. We&apos;ll trace every service charge
          line to real evidence and draft plain-English explanations for you to
          review.
        </p>
      </div>

      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <Label className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Building2 className="size-4 text-muted-foreground" /> Building
        </Label>
        <div className="flex min-w-0">
          <BuildingPicker
            buildings={props.buildings}
            value={props.building}
            onChange={props.setBuilding}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4 text-muted-foreground" /> Recipient
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              [
                "building",
                "Whole building",
                "All leaseholders, building totals",
              ],
              ["unit", "A specific flat", "Includes their share of each line"],
            ] as const
          ).map(([v, title, sub]) => (
            <label
              key={v}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                props.mode === v
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:bg-muted/50",
              )}
            >
              <input
                type="radio"
                name="recipient"
                className="mt-0.5 size-4 accent-[var(--primary)]"
                checked={props.mode === v}
                onChange={() => props.setMode(v)}
              />
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-muted-foreground">
                  {sub}
                </span>
              </span>
            </label>
          ))}
        </div>

        {props.mode === "unit" && (
          <div className="space-y-1.5 pt-2">
            <Label htmlFor="unit">Flat</Label>
            <select
              id="unit"
              value={props.unitId}
              onChange={(e) => props.setUnitId(e.target.value)}
              disabled={props.unitsLoading}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">
                {props.unitsLoading
                  ? "Loading flats…"
                  : sortedUnits.length
                    ? "Choose a flat…"
                    : "No flats found"}
              </option>
              {sortedUnits.map((u) => (
                <option key={u.unitId} value={u.unitId}>
                  Flat {u.unitNumber} · {u.sharePct.toFixed(2)}% share
                  {u.leaseholderName ? ` · ${u.leaseholderName}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5 pt-2">
          <Label htmlFor="recipient-name">
            Recipient name{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="recipient-name"
            value={props.recipientName}
            onChange={(e) => props.setRecipientName(e.target.value)}
            placeholder={
              props.mode === "unit"
                ? (props.units.find((u) => u.unitId === props.unitId)
                    ?.leaseholderName ?? "e.g. J. Smith")
                : "e.g. All leaseholders"
            }
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={!props.canContinue}
          onClick={props.onContinue}
          className="px-4"
        >
          <Sparkles className="size-4" /> Continue — draft letter
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

const PHASES = [
  "Tracing evidence…",
  "Reading documents…",
  "Drafting explanations…",
];

function DraftingState({ name }: { name?: string }) {
  const [i, setI] = useState(0);
  const [pct, setPct] = useState(4);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % PHASES.length), 2600);
    const p = setInterval(
      () => setPct((v) => Math.min(94, v + (100 - v) * 0.04)),
      400,
    );
    return () => {
      clearInterval(t);
      clearInterval(p);
    };
  }, []);
  return (
    <div className="flex flex-col items-center rounded-2xl border bg-white px-6 py-16 text-center shadow-sm">
      <div className="relative flex size-14 items-center justify-center rounded-full bg-primary/10">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
      <div className="mt-6 h-7">
        <AnimatePresence mode="wait">
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="text-lg font-medium"
          >
            {PHASES[i]}
          </motion.p>
        </AnimatePresence>
      </div>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Matching every line of {name ?? "the building"}&apos;s budget to
        invoices, emails and bank payments. This can take up to a minute.
      </p>
      <div className="mt-6 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Change({
  gbpChange,
  pct,
}: {
  gbpChange: number | null;
  pct: number | null;
}) {
  if (gbpChange == null)
    return <span className="text-muted-foreground">new</span>;
  const up = gbpChange > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium",
        up
          ? "text-rose-600"
          : gbpChange < 0
            ? "text-emerald-600"
            : "text-muted-foreground",
      )}
    >
      {gbpChange !== 0 && <Icon className="size-3.5" />}
      {up ? "+" : ""}
      {fmt(gbpChange)}
      {pct != null && (
        <span className="text-xs opacity-80">
          {" "}
          ({up ? "+" : ""}
          {pct.toFixed(1)}%)
        </span>
      )}
    </span>
  );
}

function StepReview({
  draft,
  unit,
  setIntro,
  updateLine,
  onBack,
}: {
  draft: LetterDraft;
  unit: UnitOption | null;
  setIntro: (s: string) => void;
  updateLine: (i: number, p: Partial<LetterLine>) => void;
  onBack: () => void;
}) {
  const counts = draft.lines.reduce(
    (acc, l) => ({ ...acc, [l.status]: acc[l.status] + 1 }),
    { explained: 0, partial: 0, not_found: 0 } as Record<Status, number>,
  );
  const { prevGbp, currGbp } = draft.totals;
  const totalChange = prevGbp != null ? currGbp - prevGbp : null;
  const totalPct =
    prevGbp != null && prevGbp !== 0
      ? ((currGbp - prevGbp) / prevGbp) * 100
      : null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              {draft.buildingName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {draft.buildingAddress}
            </p>
            <p className="mt-1 text-sm">
              {draft.years.prev ? `${draft.years.prev} → ` : ""}
              {draft.years.curr}
              {unit && (
                <span className="text-muted-foreground">
                  {" "}
                  · Flat {unit.unitNumber} ({unit.sharePct.toFixed(2)}% share)
                </span>
              )}
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Sparkles /> Drafted by {draft.generatedBy}
          </Badge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-muted/50 p-4">
            <div className="text-xs text-muted-foreground">Total this year</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {fmt(currGbp)}
            </div>
            <div className="mt-1 text-sm">
              <span className="text-muted-foreground">
                Last year {fmt(prevGbp)} ·{" "}
              </span>
              <Change gbpChange={totalChange} pct={totalPct} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["explained", "partial", "not_found"] as Status[]).map((s) => (
              <div
                key={s}
                className={cn(
                  "flex flex-col justify-center rounded-xl border p-3",
                  STATUS[s].cls,
                )}
              >
                <div className="text-2xl font-semibold tabular-nums">
                  {counts[s]}
                </div>
                <div className="text-xs">{STATUS[s].label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <Label htmlFor="intro" className="mb-2 flex items-center gap-2">
          <Pencil className="size-3.5 text-muted-foreground" /> Introduction
        </Label>
        <Textarea
          id="intro"
          value={draft.intro}
          onChange={(e) => setIntro(e.target.value)}
          className="min-h-28 leading-relaxed"
        />
      </section>

      <div className="space-y-4">
        {draft.lines.map((l, i) => (
          <LineCard
            key={l.category}
            line={l}
            unit={unit}
            onChange={(p) => updateLine(i, p)}
          />
        ))}
      </div>

      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="size-4" /> Change building or recipient
      </Button>
    </div>
  );
}

function LineCard({
  line: l,
  unit,
  onChange,
}: {
  line: LetterLine;
  unit: UnitOption | null;
  onChange: (p: Partial<LetterLine>) => void;
}) {
  const st = STATUS[l.status];
  return (
    <section
      className={cn(
        "rounded-2xl border bg-white p-5 shadow-sm transition-opacity sm:p-6",
        !l.include && "opacity-55",
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          aria-label={`Include ${l.label}`}
          checked={l.include}
          onChange={(e) => onChange({ include: e.target.checked })}
          className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">{l.label}</h3>
            <span
              className={cn(
                "inline-flex h-5 items-center gap-1 rounded-full border px-2 text-xs font-medium",
                st.cls,
              )}
            >
              {st.label} · {Math.round(l.coveragePct)}%
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums">
            <span className="text-muted-foreground">{fmt(l.prevGbp)}</span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
            <span className="font-medium">{fmt(l.currGbp)}</span>
            <Change gbpChange={l.changeGbp} pct={l.changePct} />
            {unit && (
              <span className="ml-auto rounded-md bg-primary/5 px-2 py-0.5 text-xs text-primary">
                Your share: {fmt((l.currGbp * unit.sharePct) / 100)}
              </span>
            )}
          </div>

          <Textarea
            value={l.explanation}
            onChange={(e) => onChange({ explanation: e.target.value })}
            className="mt-4 leading-relaxed"
            aria-label={`Explanation for ${l.label}`}
          />

          {l.status === "not_found" ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              No supporting evidence located — this will be flagged in the
              letter
            </div>
          ) : l.evidenceRefs.length > 0 ? (
            <div className="mt-3">
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Evidence found
              </div>
              <ul className="mt-1.5 space-y-1">
                {l.evidenceRefs.map((r, k) => (
                  <li
                    key={k}
                    className="flex gap-1.5 font-mono text-[11px] leading-snug break-words text-muted-foreground"
                  >
                    <FileText className="mt-px size-3 shrink-0" />
                    <span className="min-w-0">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ReviewBar({
  draft,
  unit,
  busy,
  onApprove,
}: {
  draft: LetterDraft;
  unit: UnitOption | null;
  busy: boolean;
  onApprove: () => void;
}) {
  const included = draft.lines.filter((l) => l.include);
  const total = included.reduce((s, l) => s + l.currGbp, 0);
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 text-sm">
          <span className="font-medium">
            {included.length} of {draft.lines.length} lines included
          </span>
          <span className="text-muted-foreground">
            {" "}
            · Total {fmt(total)}
            {unit && ` (your share ${fmt((total * unit.sharePct) / 100)})`}
          </span>
        </div>
        <Button
          size="lg"
          onClick={onApprove}
          disabled={busy || included.length === 0}
          className="w-full px-4 sm:w-auto"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {busy ? "Generating PDF…" : "Approve & generate PDF"}
        </Button>
      </div>
    </div>
  );
}

function StepDone({
  draft,
  unit,
  pdfUrl,
  onDownload,
  onEdit,
  building,
}: {
  draft: LetterDraft;
  unit: UnitOption | null;
  pdfUrl: string | null;
  onDownload: () => void;
  onEdit: () => void;
  building: string;
}) {
  return (
    <div className="space-y-6">
      <section className="flex flex-col items-start gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Your letter is ready
          </h1>
          <p className="text-sm text-muted-foreground">
            {draft.buildingName}
            {unit ? ` · Flat ${unit.unitNumber}` : " · all leaseholders"} ·{" "}
            {draft.years.curr}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button onClick={onDownload} disabled={!pdfUrl}>
            <Download className="size-4" /> Download PDF
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="size-4" /> Edit again
          </Button>
          <Link
            href={`/app?building=${encodeURIComponent(building)}`}
            className={buttonVariants({ variant: "ghost" })}
          >
            <Home className="size-4" /> Back to dashboard
          </Link>
        </div>
      </section>
      {pdfUrl && (
        <iframe
          src={pdfUrl}
          title="Letter preview"
          className="h-[80vh] min-h-[560px] w-full rounded-2xl border bg-white shadow-sm"
        />
      )}
    </div>
  );
}
