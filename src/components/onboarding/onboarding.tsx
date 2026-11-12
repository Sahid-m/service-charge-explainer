"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Database,
  FileText,
  Landmark,
  Mail,
  PartyPopper,
  PlayCircle,
  Receipt,
} from "lucide-react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  BankStep,
  BuildingStep,
  CortileStep,
  DoneStep,
  DriveStep,
  GmailStep,
  WelcomeStep,
  type Building,
  type Status,
} from "./steps";
import { SampleWalkthrough } from "./sample-walkthrough";

export const STEPS = [
  { id: "welcome", title: "Welcome", hint: "What this does", icon: Receipt },
  {
    id: "cortile",
    title: "Cortile data",
    hint: "Bills & tickets",
    icon: Database,
  },
  {
    id: "gmail",
    title: "Gmail invoices",
    hint: "Contractor invoices",
    icon: Mail,
  },
  {
    id: "bank",
    title: "Bank account",
    hint: "Client account payments",
    icon: Landmark,
  },
  {
    id: "drive",
    title: "Google Drive",
    hint: "Lease & insurance docs",
    icon: FileText,
  },
  {
    id: "building",
    title: "Pick a building",
    hint: "Where to start",
    icon: Building2,
  },
  {
    id: "sample",
    title: "See it work",
    hint: "Sample walkthrough",
    icon: PlayCircle,
  },
  { id: "done", title: "Done", hint: "Open the dashboard", icon: PartyPopper },
] as const;

type StepId = (typeof STEPS)[number]["id"];
const SKIPPABLE: StepId[] = ["gmail", "bank", "drive", "sample"];
const DEFAULT_BUILDING = "bld_0853";

export function Onboarding() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const stepParam = params.get("step");
  const index = Math.max(
    0,
    STEPS.findIndex((s) => s.id === stepParam),
  );
  const step = STEPS[index];
  const buildingId = params.get("building") ?? DEFAULT_BUILDING;

  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [buildings, setBuildings] = useState<Building[] | null>(null);
  const [direction, setDirection] = useState(1);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // OAuth return toasts
  useEffect(() => {
    const gmail = params.get("gmail");
    const bank = params.get("bank");
    if (!gmail && !bank) return;
    if (gmail === "connected")
      toast.success("Gmail and Google Drive connected");
    if (gmail === "error") toast.error("Couldn't connect Gmail — try again");
    if (bank === "connected") toast.success("Bank account connected");
    if (bank === "error") toast.error("Couldn't connect your bank — try again");
    setParams({ gmail: null, bank: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((s: Status) => alive && setStatus(s))
      .catch(() => alive && setStatusError(true));
    fetch("/api/buildings")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((b: Building[]) => alive && setBuildings(Array.isArray(b) ? b : []))
      .catch(
        () =>
          alive &&
          setBuildings([
            { id: DEFAULT_BUILDING, name: "Fir House", postcode: "" },
          ]),
      );
    return () => {
      alive = false;
    };
  }, []);

  const go = (to: number) => {
    const clamped = Math.min(STEPS.length - 1, Math.max(0, to));
    setDirection(clamped >= index ? 1 : -1);
    setParams({ step: STEPS[clamped].id });
  };

  const chosen = useMemo(
    () => buildings?.find((b) => b.id === buildingId),
    [buildings, buildingId],
  );

  const progress = ((index + 1) / STEPS.length) * 100;
  const isLast = index === STEPS.length - 1;

  return (
    <div className="flex min-h-svh flex-1 flex-col bg-gradient-to-b from-sky-50 via-page to-page">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Receipt className="size-4" />
            </span>
            <span className="hidden sm:inline">Service Charge Explainer</span>
          </Link>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums md:hidden">
            Step {index + 1} of {STEPS.length}
          </span>
          <Link
            href={`/app?building=${buildingId}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "ml-auto hidden md:inline-flex",
            )}
          >
            Skip setup
          </Link>
        </div>
        <div className="h-1 w-full bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 md:grid-cols-[240px_1fr] md:gap-10 md:py-10">
        {/* Desktop stepper */}
        <nav aria-label="Onboarding steps" className="hidden md:block">
          <ol className="sticky top-24 space-y-1">
            {STEPS.map((s, i) => {
              const done = i < index;
              const current = i === index;
              return (
                <li key={s.id} className="relative">
                  {i < STEPS.length - 1 && (
                    <span
                      className={cn(
                        "absolute top-9 left-[19px] h-[calc(100%-1.75rem)] w-px",
                        done ? "bg-primary" : "bg-border",
                      )}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => go(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted",
                      current && "bg-muted",
                    )}
                    aria-current={current ? "step" : undefined}
                  >
                    <span
                      className={cn(
                        "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                        done &&
                          "border-primary bg-primary text-primary-foreground",
                        current &&
                          "border-primary bg-background text-foreground ring-4 ring-primary/10",
                        !done &&
                          !current &&
                          "bg-background text-muted-foreground",
                      )}
                    >
                      {done ? (
                        <Check className="size-3.5" strokeWidth={3} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm font-medium",
                          !current && !done && "text-muted-foreground",
                        )}
                      >
                        {s.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.hint}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Content */}
        <main className="min-w-0">
          {/* Mobile step indicator */}
          <div className="mb-4 flex items-center gap-1.5 md:hidden">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={s.title}
                onClick={() => go(i)}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i <= index ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.section
                key={step.id}
                custom={direction}
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -24 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="p-5 sm:p-8"
              >
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <step.icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Step {index + 1} of {STEPS.length}
                    </p>
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                      {step.title}
                    </h1>
                  </div>
                </div>

                {step.id === "welcome" && <WelcomeStep />}
                {step.id === "cortile" && (
                  <CortileStep status={status} error={statusError} />
                )}
                {step.id === "gmail" && (
                  <GmailStep status={status} error={statusError} />
                )}
                {step.id === "bank" && (
                  <BankStep status={status} error={statusError} />
                )}
                {step.id === "drive" && (
                  <DriveStep status={status} error={statusError} />
                )}
                {step.id === "building" && (
                  <BuildingStep
                    buildings={buildings}
                    value={buildingId}
                    onChange={(id) => setParams({ building: id })}
                  />
                )}
                {step.id === "sample" && <SampleWalkthrough />}
                {step.id === "done" && (
                  <DoneStep
                    status={status}
                    buildingId={buildingId}
                    buildingName={chosen?.name}
                  />
                )}
              </motion.section>
            </AnimatePresence>

            {!isLast && (
              <footer className="flex items-center gap-2 border-t bg-muted/30 px-5 py-3 sm:px-8">
                <Button
                  variant="ghost"
                  onClick={() => go(index - 1)}
                  disabled={index === 0}
                >
                  <ArrowLeft />
                  Back
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  {SKIPPABLE.includes(step.id) && (
                    <Button variant="ghost" onClick={() => go(index + 1)}>
                      Skip
                    </Button>
                  )}
                  <Button onClick={() => go(index + 1)}>
                    {index === 0 ? "Get started" : "Continue"}
                    <ArrowRight />
                  </Button>
                </div>
              </footer>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
