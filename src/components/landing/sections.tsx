import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SavingsCalculator } from "./calculator";
import { ScreenshotFrame } from "./frame";
import { Reveal } from "./reveal";
import { Wordmark } from "./wordmark";

const DEMO = "/app?building=bld_0853";

function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-6", className)}>
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-wider text-primary uppercase">
      {children}
    </p>
  );
}

function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "mt-3 text-3xl font-semibold tracking-tight text-balance text-foreground md:text-[2.25rem] md:leading-[1.15]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

function Body({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "max-w-[52ch] text-base leading-7 text-muted-foreground md:text-[17px] md:leading-8",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* 1 ─ Hero ─────────────────────────────────────────────── */

export function Hero() {
  return (
    <section className="pt-16 pb-24 md:pt-24 md:pb-32">
      <Container>
        <Reveal>
          <Eyebrow>For UK block managers</Eyebrow>
          <h1 className="mt-5 max-w-[18ch] text-[2.5rem] leading-[1.05] font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl md:leading-[1.04]">
            Answer “why did my service charge go up?” with evidence.
          </h1>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-6 grid gap-8 md:grid-cols-12 md:items-end">
            <Body className="md:col-span-7 md:text-lg md:leading-8">
              Service Charge Explainer traces every line of a building’s bill to
              the maintenance tickets, contractor invoices and bank payments
              behind it — and tells you plainly where the evidence is missing.
            </Body>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/onboarding"
              className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
            >
              Get started
              <ArrowRight data-icon="inline-end" />
            </Link>
            <Link
              href={DEMO}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 px-5",
              )}
            >
              See it on a real building
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Read-only connections
            <span className="mx-2 text-border">/</span>
            Every figure traced to a source
            <span className="mx-2 text-border">/</span>
            Nothing invented
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mt-16 md:mt-20">
          <ScreenshotFrame
            src="/landing/bill-table.png"
            alt="Fir House dashboard: total service charge £90,640, up 15.4%, with each bill line marked Explained, Partial or Not found."
            aspect="1152 / 700"
            windowClassName="aspect-[4/5] md:aspect-[1152/700]"
            imageClassName="object-left-top md:object-top"
            priority
            sizes="(min-width: 1152px) 1104px, 100vw"
            label="Fir House, Southampton — FY to Jun 2026"
          />
        </Reveal>
      </Container>
    </section>
  );
}

/* 2 ─ Problem ──────────────────────────────────────────── */

const scattered = [
  ["Maintenance tickets", "in the property-management system"],
  ["Contractor invoices", "as PDFs in someone’s inbox"],
  ["Payments", "in the building’s client bank account"],
  ["Insurance, lease, agreements", "in a shared drive"],
];

export function Problem() {
  return (
    <section className="border-y border-border bg-page py-24 md:py-32">
      <Container className="grid gap-12 md:grid-cols-12 md:gap-8">
        <Reveal className="md:col-span-5">
          <Eyebrow>The problem</Eyebrow>
          <SectionTitle>Every increase gets challenged.</SectionTitle>
          <Body className="mt-5">
            Leaseholders have a right to ask what they are paying for. The
            answer exists, but it is spread across four systems, and putting it
            together by hand takes days for a single building.
          </Body>
        </Reveal>
        <Reveal delay={0.05} className="md:col-span-6 md:col-start-7">
          <div className="rounded-xl border border-border bg-background">
            <div className="border-b border-border px-6 py-4 text-sm">
              <p className="text-muted-foreground">
                From{" "}
                <span className="text-foreground">Leaseholder, Flat 12</span>
              </p>
              <p className="mt-1 text-muted-foreground">
                Subject{" "}
                <span className="text-foreground">Service charge 2026</span>
              </p>
            </div>
            <p className="px-6 py-6 text-lg leading-8 text-foreground">
              “Our buildings insurance went up 26% this year. Before I pay, can
              you show me why?”
            </p>
          </div>
          <ul className="mt-8 divide-y divide-border border-y border-border text-sm">
            {scattered.map(([what, where]) => (
              <li
                key={what}
                className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <span className="font-medium text-foreground">{what}</span>
                <span className="text-muted-foreground">{where}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}

/* 3 ─ The numbers ─────────────────────────────────────── */

const figures = [
  {
    value: "£80.3m",
    caption: "billed in service charges this year",
    detail: "1,000 buildings · 31,614 homes",
  },
  {
    value: "£6.6m",
    caption: "of year-on-year increases",
    detail: "across bill lines that went up",
  },
  {
    value: "£6.2m",
    caption: "of those increases (93%) had no supporting ticket evidence",
    detail: "£5.0m with none at all · £1.2m partial",
    emphasis: true,
  },
  {
    value: "983",
    caption: "of 1,000 buildings have an increase they can’t yet evidence",
    detail: "at least one bill line each",
  },
];

export function Numbers() {
  return (
    <section className="py-24 md:py-32">
      <Container>
        <Reveal className="grid gap-6 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-6">
            <Eyebrow>The numbers</Eyebrow>
            <SectionTitle>
              We ran the matcher over a whole portfolio.
            </SectionTitle>
          </div>
          <Body className="md:col-span-5 md:col-start-8 md:self-end">
            Ticket data alone. Connecting invoices and bank payments closes more
            of the gap — that’s the point.
          </Body>
        </Reveal>

        <Reveal delay={0.05}>
          <dl className="mt-14 grid border-t border-border sm:grid-cols-2 lg:grid-cols-4">
            {figures.map((f, i) => (
              <div
                key={f.value}
                className={cn(
                  "border-b border-border py-8 lg:border-b-0 lg:py-10",
                  i % 2 === 1 && "sm:border-l sm:pl-8",
                  i > 0 && "lg:border-l lg:pl-8",
                  i % 2 === 0 && "sm:pr-8",
                )}
              >
                <dt className="sr-only">{f.caption}</dt>
                <dd
                  className={cn(
                    "text-5xl font-semibold tracking-tight tabular-nums",
                    f.emphasis ? "text-coral" : "text-foreground",
                  )}
                >
                  {f.value}
                </dd>
                <dd className="mt-3 text-[15px] leading-6 text-foreground">
                  {f.caption}
                </dd>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {f.detail}
                </dd>
              </div>
            ))}
          </dl>
          <p className="pt-4 text-xs text-muted-foreground lg:border-t lg:border-border">
            Source: Cortile portfolio data, FY2026, ticket evidence only.
          </p>
        </Reveal>

        <Reveal delay={0.05} className="mt-24 md:mt-28">
          <div className="mb-10 grid gap-6 md:grid-cols-12 md:gap-8">
            <h3 className="text-2xl font-semibold tracking-tight md:col-span-6">
              What it’s worth to your firm
            </h3>
            <Body className="md:col-span-5 md:col-start-8">
              Time spent answering owner queries, and the increases you can
              explain before anyone asks.
            </Body>
          </div>
          <SavingsCalculator />
        </Reveal>
      </Container>
    </section>
  );
}

/* 4 ─ How it works ────────────────────────────────────── */

const steps = [
  {
    n: "01",
    title: "Connect your sources",
    body: "Cortile tickets, invoice emails and PDFs, the client bank account and building documents. All read-only.",
  },
  {
    n: "02",
    title: "Every bill line is traced",
    body: "Each line is matched to tickets, invoices and payments in code, then marked Explained, Partial or Not found.",
  },
  {
    n: "03",
    title: "Reply in plain English",
    body: "Draft a letter to the owner that cites only the evidence that was found, and says what is still missing.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-16 border-y border-border bg-page py-24 md:py-32"
    >
      <Container>
        <Reveal>
          <Eyebrow>How it works</Eyebrow>
          <SectionTitle>From a bill to a reply in three steps.</SectionTitle>
        </Reveal>
        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={0.05 * i}>
              <div className="border-t border-foreground/80 pt-6">
                <p className="font-mono text-sm text-primary">{s.n}</p>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">
                  {s.title}
                </h3>
                <p className="mt-2 max-w-[40ch] leading-7 text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* 5 ─ Evidence trail ──────────────────────────────────── */

const rules = [
  ["Ticket → invoice", "Same contractor, amount within £1."],
  ["Invoice → payment", "Payee matches, paid within 60 days."],
  ["Explained", "Evidence covers at least 80% of the line’s £."],
];

export function EvidenceTrail() {
  return (
    <section id="evidence" className="scroll-mt-16 py-24 md:py-32">
      <Container className="grid gap-14 md:grid-cols-12 md:gap-8">
        <Reveal className="md:col-span-5 md:pt-8">
          <Eyebrow>The evidence trail</Eyebrow>
          <SectionTitle>
            Every pound, followed from the job to the bank.
          </SectionTitle>
          <Body className="mt-5">
            Open any bill line to see the work behind it: the maintenance
            ticket, the contractor’s invoice, and the payment that left the
            client account. The rules are simple and run in code.
          </Body>
          <dl className="mt-8 divide-y divide-border border-y border-border">
            {rules.map(([k, v]) => (
              <div key={k} className="grid grid-cols-5 gap-4 py-4 text-sm">
                <dt className="col-span-2 font-medium text-foreground">{k}</dt>
                <dd className="col-span-3 text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
        <Reveal delay={0.05} className="md:col-span-6 md:col-start-7">
          <ScreenshotFrame
            src="/landing/evidence-panel-only.png"
            alt="Evidence panel for Repairs and maintenance: £8,416.99 billed, 92% evidenced, each item traced from ticket to invoice PDF to bank payment."
            aspect="576 / 720"
            sizes="(min-width: 768px) 540px, 100vw"
            label="Repairs and maintenance — evidence"
          />
        </Reveal>
      </Container>
    </section>
  );
}

/* 6 ─ Honest by design ────────────────────────────────── */

const states = [
  {
    icon: CheckCircle2,
    tone: "text-emerald-600",
    title: "Explained",
    body: "Evidence covers 80% or more of the line’s cost.",
  },
  {
    icon: AlertCircle,
    tone: "text-amber-600",
    title: "Partial",
    body: "Some evidence found, but under 80% of the cost.",
  },
  {
    icon: XCircle,
    tone: "text-coral",
    title: "Not found",
    body: "No matching evidence. We show the gap rather than fill it.",
  },
];

export function Honest() {
  return (
    <section className="border-y border-border bg-page py-24 md:py-32">
      <Container>
        <Reveal className="grid gap-6 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-6">
            <Eyebrow>Honest by design</Eyebrow>
            <SectionTitle>If we can’t find it, we say so.</SectionTitle>
          </div>
          <Body className="md:col-span-5 md:col-start-8 md:self-end">
            All matching and maths happen in code. AI only reads documents and
            drafts the reply — it never supplies a figure or a source.
          </Body>
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-3 md:gap-8">
          {states.map((s, i) => (
            <Reveal key={s.title} delay={0.05 * i}>
              <div className="h-full rounded-xl border border-border bg-background p-6">
                <div className="flex items-center gap-2">
                  <s.icon className={cn("size-5", s.tone)} aria-hidden />
                  <h3 className="font-semibold tracking-tight">{s.title}</h3>
                </div>
                <p className="mt-3 leading-7 text-muted-foreground">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* 7 ─ The reply ───────────────────────────────────────── */

const replyPoints = [
  "Cites invoice numbers, ticket references and payment dates that were found",
  "Says plainly which increases are still being evidenced",
  "You review and edit before anything is sent",
];

export function Reply() {
  return (
    <section className="py-24 md:py-32">
      <Container className="grid gap-14 md:grid-cols-12 md:gap-8">
        <Reveal className="md:order-2 md:col-span-5 md:col-start-8 md:pt-8">
          <Eyebrow>The reply</Eyebrow>
          <SectionTitle>
            A letter the owner can check line by line.
          </SectionTitle>
          <Body className="mt-5">
            One click drafts a plain-English answer for the leaseholder, built
            only from the evidence on the page.
          </Body>
          <ul className="mt-8 divide-y divide-border border-y border-border text-sm">
            {replyPoints.map((p) => (
              <li key={p} className="flex gap-3 py-4">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden
                />
                <span className="text-foreground">{p}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.05} className="md:order-1 md:col-span-7">
          <ScreenshotFrame
            src="/landing/draft-reply.png"
            alt="Draft reply to owner: a plain-English letter listing each increase and the tickets and invoices that support it."
            aspect="672 / 600"
            sizes="(min-width: 768px) 640px, 100vw"
            label="Draft reply to owner"
          />
        </Reveal>
      </Container>
    </section>
  );
}

/* 8 ─ Sources ─────────────────────────────────────────── */

const sources = [
  {
    name: "Cortile",
    via: "Maintenance tickets",
    reads: "Job, contractor, date, status and cost.",
  },
  {
    name: "Gmail & PDF uploads",
    via: "Contractor invoices",
    reads: "Invoice number, supplier, date and amounts.",
  },
  {
    name: "TrueLayer or CSV",
    via: "Client bank account",
    reads: "Payee, amount and date of each payment.",
  },
  {
    name: "Google Drive",
    via: "Building documents",
    reads: "Insurance schedule, lease, management agreement.",
  },
];

export function Sources() {
  return (
    <section className="border-t border-border py-24 md:py-32">
      <Container>
        <Reveal className="grid gap-6 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-6">
            <Eyebrow>Sources</Eyebrow>
            <SectionTitle>
              Connects to where the evidence already is.
            </SectionTitle>
          </div>
          <Body className="md:col-span-5 md:col-start-8 md:self-end">
            Every connection is read-only. Nothing is changed, moved or sent on
            your behalf.
          </Body>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-14 grid overflow-hidden rounded-xl border border-border sm:grid-cols-2 lg:grid-cols-4">
            {sources.map((s, i) => (
              <div
                key={s.name}
                className={cn(
                  "flex flex-col gap-1 border-border p-6",
                  i > 0 && "border-t sm:border-t-0",
                  i % 2 === 1 && "sm:border-l",
                  i >= 2 && "sm:border-t lg:border-t-0",
                  i === 2 && "lg:border-l",
                )}
              >
                <p className="text-sm text-muted-foreground">{s.via}</p>
                <p className="font-semibold tracking-tight">{s.name}</p>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
                  {s.reads}
                </p>
                <p className="mt-4 font-mono text-[11px] tracking-wide text-primary uppercase">
                  Read-only
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/* 9 ─ Final CTA ───────────────────────────────────────── */

export function FinalCta() {
  return (
    <section className="bg-accent py-24 md:py-28">
      <Container className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <Reveal>
          <h2 className="max-w-[24ch] text-3xl font-semibold tracking-tight text-balance md:text-[2.25rem] md:leading-[1.15]">
            See it on a real building, then connect your own.
          </h2>
        </Reveal>
        <Reveal delay={0.05} className="flex flex-wrap gap-3">
          <Link
            href="/onboarding"
            className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
          >
            Get started
            <ArrowRight data-icon="inline-end" />
          </Link>
          <Link
            href={DEMO}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 bg-background px-5",
            )}
          >
            Open the demo
          </Link>
        </Reveal>
      </Container>
    </section>
  );
}

/* 10 ─ Footer ─────────────────────────────────────────── */

export function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <Container className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <Wordmark className="text-sm" />
        <p>Built at the Real Estate GB hackathon, 2026</p>
      </Container>
    </footer>
  );
}
