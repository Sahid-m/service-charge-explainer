"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  Building2,
  Check,
  CircleCheck,
  Clock,
  Database,
  FileSpreadsheet,
  FileText,
  Home,
  Info,
  Landmark,
  Lock,
  Mail,
  MessageSquareText,
  Receipt,
  Search,
  ShieldCheck,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export type Status = {
  cortile: {
    connected: boolean;
    buildings: number;
    tickets: number;
    billLines: number;
  };
  gmail: { connected: boolean; email?: string };
  drive: { connected: boolean };
  bank: {
    connected: boolean;
    banks: string[];
    env: "sandbox" | "live";
    csv: boolean;
  };
};

export type Building = { id: string; name: string; postcode: string };

type StatusProps = { status: Status | null; error: boolean };

const GMAIL_CONNECT = `/api/auth/google?returnTo=${encodeURIComponent("/onboarding?step=gmail")}`;
const BANK_CONNECT = `/api/auth/truelayer?returnTo=${encodeURIComponent("/onboarding?step=bank")}`;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
      {children}
    </p>
  );
}

function Point({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Check;
  title: string;
  children: ReactNode;
}) {
  return (
    <motion.li variants={item} className="flex gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="size-4" />
      </span>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </motion.li>
  );
}

function Points({ children }: { children: ReactNode }) {
  return (
    <motion.ul
      variants={stagger}
      initial="hidden"
      animate="show"
      className="mt-6 space-y-4"
    >
      {children}
    </motion.ul>
  );
}

function ConnectedPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <CircleCheck className="size-3.5" />
      {children}
    </span>
  );
}

function ConnectCard({
  icon: Icon,
  title,
  loading,
  connected,
  connectedText,
  connectHref,
  connectLabel,
  children,
}: {
  icon: typeof Check;
  title: string;
  loading: boolean;
  connected: boolean;
  connectedText: ReactNode;
  connectHref?: string;
  connectLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-6 rounded-xl border p-4 transition-colors",
        connected && "border-emerald-500/40 bg-emerald-500/5",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-background ring-1 ring-border">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{title}</div>
          {loading ? (
            <Skeleton className="mt-1 h-4 w-40" />
          ) : (
            <div className="truncate text-sm text-muted-foreground">
              {connected ? connectedText : "Not connected yet"}
            </div>
          )}
        </div>
        {!loading && connected && <ConnectedPill>Connected</ConnectedPill>}
        {!loading && !connected && connectHref && (
          <a
            href={connectHref}
            className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
          >
            {connectLabel}
            <ArrowRight />
          </a>
        )}
      </div>
      {children}
    </div>
  );
}

function Note({
  icon: Icon = Info,
  children,
}: {
  icon?: typeof Info;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 flex gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/* 1. Welcome */
export function WelcomeStep() {
  return (
    <div>
      <Lead>
        Owners ask &ldquo;what is this charge for?&rdquo; Service Charge
        Explainer answers with evidence, not guesses.
      </Lead>
      <Points>
        <Point icon={Search} title="Traces every bill line">
          Each service-charge line is matched to maintenance tickets, contractor
          invoices, bank payments and building documents.
        </Point>
        <Point icon={ShieldCheck} title="Never invents evidence">
          Lines are marked ✓ explained (80%+ of the £ covered), ⚠ partial or ✗
          not found — so you know exactly where the gaps are.
        </Point>
        <Point icon={MessageSquareText} title="Drafts the reply for you">
          A plain-English answer to the owner that cites only what was found.
        </Point>
      </Points>

      <div className="mt-8 rounded-xl border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">What you&apos;ll connect</div>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            About 2 minutes
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { icon: Database, label: "Cortile" },
            { icon: Mail, label: "Gmail" },
            { icon: Landmark, label: "Bank" },
            { icon: FileText, label: "Drive" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <Icon className="size-4 text-muted-foreground" />
              {label}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Every connection is read-only. You can skip any step and connect it
          later.
        </p>
      </div>
    </div>
  );
}

/* 2. Cortile */
export function CortileStep({ status, error }: StatusProps) {
  const loading = !status && !error;
  const c = status?.cortile;
  const stats = [
    { label: "Buildings", value: c?.buildings, icon: Building2 },
    { label: "Bill lines", value: c?.billLines, icon: Receipt },
    { label: "Tickets", value: c?.tickets, icon: Wrench },
  ];
  return (
    <div>
      <Lead>
        Your Cortile block-management data is already connected. It gives us the
        service-charge bill lines to explain and the maintenance tickets that
        often explain them.
      </Lead>
      <div className="mt-6 flex items-center gap-2">
        <ConnectedPill>Cortile connected</ConnectedPill>
      </div>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mt-4 grid grid-cols-3 gap-2 sm:gap-3"
      >
        {stats.map(({ label, value, icon: Icon }) => (
          <motion.div
            key={label}
            variants={item}
            className="rounded-xl border bg-background p-3 sm:p-4"
          >
            <Icon className="size-4 text-muted-foreground" />
            <div className="mt-2 text-2xl font-semibold tabular-nums sm:text-3xl">
              {loading ? (
                <Skeleton className="h-8 w-14" />
              ) : value !== undefined ? (
                value.toLocaleString("en-GB")
              ) : (
                "—"
              )}
            </div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </motion.div>
        ))}
      </motion.div>
      <Points>
        <Point icon={Receipt} title="Bill lines">
          The year-end service-charge budget and actuals, line by line.
        </Point>
        <Point icon={Wrench} title="Maintenance tickets">
          Repairs and call-outs with dates, flats and costs — the first piece of
          evidence for most repair lines.
        </Point>
      </Points>
    </div>
  );
}

/* 3. Gmail */
export function GmailStep({ status, error }: StatusProps) {
  const loading = !status && !error;
  const connected = !!status?.gmail.connected;
  return (
    <div>
      <Lead>
        Contractors email their invoices. We search your inbox for them by
        building, contractor and invoice number, and match each one to a bill
        line.
      </Lead>
      <ConnectCard
        icon={Mail}
        title="Gmail"
        loading={loading}
        connected={connected}
        connectedText={status?.gmail.email ?? "Connected"}
        connectHref={GMAIL_CONNECT}
        connectLabel="Connect Gmail"
      />
      <Points>
        <Point icon={Lock} title="Read-only">
          We can&apos;t send, delete or change any email.
        </Point>
        <Point icon={Search} title="Targeted search">
          Only messages that look like invoices for your buildings are read.
        </Point>
        <Point icon={FileText} title="Google Drive in the same step">
          Drive access is granted together with Gmail, so lease and insurance
          documents are ready too.
        </Point>
      </Points>
    </div>
  );
}

/* 4. Bank */
export function BankStep({ status, error }: StatusProps) {
  const loading = !status && !error;
  const bank = status?.bank;
  const connected = !!bank?.connected;
  const banks = bank?.banks ?? [];
  return (
    <div>
      <Lead>
        An invoice proves a charge was billed. A payment from the
        building&apos;s client account proves it was paid. We connect read-only
        through Open Banking (TrueLayer).
      </Lead>
      <ConnectCard
        icon={Landmark}
        title="Client account"
        loading={loading}
        connected={connected}
        connectedText={banks.length ? banks.join(", ") : "Bank connected"}
        connectHref={BANK_CONNECT}
        connectLabel="Connect bank"
      >
        {connected && banks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {banks.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs"
              >
                <Landmark className="size-3" />
                {b}
              </span>
            ))}
            {bank?.env === "sandbox" && (
              <span className="rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
                Sandbox
              </span>
            )}
          </div>
        )}
      </ConnectCard>
      {(!bank || bank.env !== "live") && (
        <Note icon={Info}>
          <span className="font-medium text-foreground">Sandbox:</span> choose{" "}
          <span className="font-medium text-foreground">Mock Bank</span>, login{" "}
          <code className="rounded bg-background px-1">john</code> /{" "}
          <code className="rounded bg-background px-1">doe</code>
        </Note>
      )}
      <Points>
        <Point icon={Lock} title="Read-only, client account only">
          We see transactions — we can never move money. Only the
          building&apos;s client account is used.
        </Point>
        <Point icon={Search} title="How payments are matched">
          Amount within ±£1, the payee name, and a 60-day window after the
          invoice date.
        </Point>
        <Point icon={FileSpreadsheet} title="Prefer a statement?">
          {bank?.csv
            ? "A CSV bank statement is already loaded and will be used too."
            : "You can upload a CSV bank statement instead of connecting."}
        </Point>
      </Points>
    </div>
  );
}

/* 5. Drive */
export function DriveStep({ status, error }: StatusProps) {
  const loading = !status && !error;
  const connected = !!status?.drive.connected;
  const docs = [
    {
      icon: Home,
      title: "Lease extract",
      body: "What the lease lets the landlord recharge, and each flat's share.",
    },
    {
      icon: ShieldCheck,
      title: "Insurance schedule",
      body: "The premium, the insurer and any broker commission.",
    },
    {
      icon: FileText,
      title: "Management agreement",
      body: "The agreed management fee and what it covers.",
    },
  ];
  return (
    <div>
      <Lead>
        Some lines are explained by documents, not invoices. We read the key
        documents for each building from Google Drive.
      </Lead>
      <ConnectCard
        icon={FileText}
        title="Google Drive"
        loading={loading}
        connected={connected}
        connectedText="Granted with Gmail"
        connectHref={GMAIL_CONNECT}
        connectLabel="Connect Google"
      />
      {!loading && !connected && (
        <Note>
          Drive access is granted together with Gmail in one Google sign-in.
        </Note>
      )}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mt-6 grid gap-3 sm:grid-cols-3"
      >
        {docs.map(({ icon: Icon, title, body }) => (
          <motion.div
            key={title}
            variants={item}
            className="rounded-xl border bg-background p-4"
          >
            <Icon className="size-5 text-muted-foreground" />
            <div className="mt-3 text-sm font-medium">{title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{body}</div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/* 6. Building */
export function BuildingStep({
  buildings,
  value,
  onChange,
}: {
  buildings: Building[] | null;
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = buildings ?? [];
    return q
      ? list.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            b.postcode?.toLowerCase().includes(q),
        )
      : list;
  }, [buildings, query]);

  return (
    <div>
      <Lead>Choose the building to open first. You can switch any time.</Lead>
      <div className="relative mt-6">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or postcode"
          className="h-10 pl-9"
          aria-label="Search buildings"
        />
      </div>
      <div className="mt-3 max-h-80 space-y-1 overflow-y-auto rounded-xl border p-1.5">
        {!buildings &&
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        {buildings && filtered.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <TriangleAlert className="size-4" />
            No buildings match &ldquo;{query}&rdquo;
          </div>
        )}
        {filtered.map((b) => {
          const selected = b.id === value;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onChange(b.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted",
                selected && "bg-primary/5 ring-1 ring-primary/30",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Building2 className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {b.name}
                </span>
                {b.postcode && (
                  <span className="block text-xs text-muted-foreground">
                    {b.postcode}
                  </span>
                )}
              </span>
              {selected && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* 8. Done */
export function DoneStep({
  status,
  buildingId,
  buildingName,
}: {
  status: Status | null;
  buildingId: string;
  buildingName?: string;
}) {
  const sources = [
    { label: "Cortile", icon: Database, on: status?.cortile.connected ?? true },
    { label: "Gmail", icon: Mail, on: !!status?.gmail.connected },
    {
      label: "Bank",
      icon: Landmark,
      on: !!status?.bank.connected || !!status?.bank.csv,
    },
    { label: "Google Drive", icon: FileText, on: !!status?.drive.connected },
  ];
  return (
    <div>
      <Lead>
        You&apos;re ready. Open{" "}
        <span className="font-medium text-foreground">
          {buildingName ?? "your building"}
        </span>{" "}
        to see every bill line traced to its evidence.
      </Lead>
      <motion.ul
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mt-6 grid gap-2 sm:grid-cols-2"
      >
        {sources.map(({ label, icon: Icon, on }) => (
          <motion.li
            key={label}
            variants={item}
            className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3"
          >
            <Icon className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">{label}</span>
            {on ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <CircleCheck className="size-3.5" />
                Connected
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Not connected
              </span>
            )}
          </motion.li>
        ))}
      </motion.ul>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/app?building=${encodeURIComponent(buildingId)}`}
          className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}
        >
          Open dashboard
          <ArrowRight />
        </Link>
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-10 px-4",
          )}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
