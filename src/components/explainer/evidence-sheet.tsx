"use client";

import {
  ChevronDown,
  ExternalLink,
  FileText,
  Landmark,
  Mail,
  SearchX,
  Wrench,
} from "lucide-react";
import type { EvidenceChain, ExplainedLine } from "@/lib/explain-types";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "cn";
import { fmtDate, gbp } from "./format";
import { CoverageBar, StatusBadge } from "./status";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function summarise(line: ExplainedLine): string {
  const c = line.chains;
  if (
    c.length === 0 &&
    line.uncostedTickets.length === 0 &&
    line.docs.length === 0
  )
    return "No tickets, invoices, payments or documents matched this line.";
  const parts: string[] = [];
  if (c.length > 0) {
    const inv = c.filter((x) => x.email).length;
    const pay = c.filter((x) => x.payment).length;
    parts.push(
      `${plural(c.length, "costed item")} found: ${inv} traced to an invoice email, ${pay} matched to a bank payment`,
    );
  } else {
    parts.push("No costed work was found");
  }
  if (line.uncostedTickets.length)
    parts.push(
      `${plural(line.uncostedTickets.length, "ticket")} with no recorded cost`,
    );
  if (line.docs.length)
    parts.push(`${plural(line.docs.length, "document")} on file`);
  return parts.join("; ") + ".";
}

function Step({
  n,
  icon: Icon,
  title,
  source,
  found,
  last,
  children,
}: {
  n: number;
  icon: typeof Wrench;
  title: string;
  source: string;
  found: boolean;
  last?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && (
        <span
          className={cn(
            "absolute top-8 bottom-0 left-[15px] w-px",
            found ? "bg-border" : "border-l border-dashed border-border",
          )}
        />
      )}
      <span
        className={cn(
          "z-10 flex size-8 shrink-0 items-center justify-center rounded-full border",
          found
            ? "border-primary/20 bg-primary/10 text-primary"
            : "border-dashed bg-background text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div
        className={cn(
          "min-w-0 flex-1 rounded-lg border p-3",
          !found && "border-dashed bg-muted/20",
        )}
      >
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-medium">
            {n}. {title}
          </span>
          <span>{source}</span>
        </div>
        {found ? (
          <div className="mt-1 text-sm">{children}</div>
        ) : (
          <div className="mt-1 text-sm text-muted-foreground italic">
            Not found
          </div>
        )}
      </div>
    </li>
  );
}

function ChainCard({ chain, i }: { chain: EvidenceChain; i: number }) {
  const { ticket, email, payment } = chain;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          Item {i + 1}
          {ticket ? ` · ${ticket.title}` : ""}
        </span>
        <span className="font-semibold tabular-nums">
          {gbp(chain.amountGbp)}
        </span>
      </div>
      <ol>
        <Step
          n={1}
          icon={Wrench}
          title="Maintenance ticket"
          source="Cortile"
          found={!!ticket}
        >
          {ticket && (
            <>
              <div className="font-medium">{ticket.title}</div>
              <div className="text-xs text-muted-foreground">
                {fmtDate(ticket.date)} · {ticket.contractor ?? "No contractor"}{" "}
                · {ticket.status} ·{" "}
                <span className="tabular-nums">{gbp(ticket.costGbp)}</span>
              </div>
            </>
          )}
        </Step>
        <Step
          n={2}
          icon={Mail}
          title="Contractor invoice"
          source={email?.source === "pdf" ? "PDF document" : "Gmail"}
          found={!!email}
        >
          {email && (
            <>
              <div className="font-medium">{email.subject}</div>
              <div className="text-xs text-muted-foreground">
                {email.from} · {fmtDate(email.date)}
                {email.invoiceNumbers.length > 0 &&
                  ` · Inv ${email.invoiceNumbers.join(", ")}`}
                {email.amountsGbp.length > 0 && (
                  <span className="tabular-nums">
                    {" "}
                    · {email.amountsGbp.map(gbp).join(", ")}
                  </span>
                )}
              </div>
              {email.attachments.length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  📎 {email.attachments.join(", ")}
                </div>
              )}
              <a
                href={email.link}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {email.source === "pdf" ? "Open invoice PDF" : "Open in Gmail"}{" "}
                <ExternalLink className="size-3" />
              </a>
            </>
          )}
        </Step>
        <Step
          n={3}
          icon={Landmark}
          title="Bank payment"
          source="Client account"
          found={!!payment}
          last
        >
          {payment && (
            <>
              <div className="font-medium">
                <span className="tabular-nums">{gbp(payment.amountGbp)}</span>{" "}
                to {payment.payee}
              </div>
              <div className="text-xs text-muted-foreground">
                {fmtDate(payment.date)} ·{" "}
                {payment.source === "truelayer"
                  ? "TrueLayer open banking"
                  : "Bank statement CSV"}
                {payment.account ? ` · ${payment.account}` : ""}
              </div>
            </>
          )}
        </Step>
      </ol>
    </div>
  );
}

export function EvidenceSheet({
  line,
  onClose,
  touring,
}: {
  line: ExplainedLine | null;
  onClose: () => void;
  touring?: boolean;
}) {
  return (
    <Sheet
      open={!!line}
      onOpenChange={(o) => !o && onClose()}
      modal={!touring}
      disablePointerDismissal={touring}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-xl">
        {line && (
          <>
            <SheetHeader className="gap-3 border-b p-5 pr-12">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-lg font-semibold">
                  {line.label}
                </SheetTitle>
                <StatusBadge status={line.status} />
              </div>
              <SheetDescription>
                Evidence trail for this bill line
              </SheetDescription>
              <div className="flex flex-col gap-2">
                <div className="text-sm tabular-nums">
                  <span className="font-semibold">{gbp(line.currGbp)}</span>{" "}
                  billed ·{" "}
                  <span className="font-semibold">
                    {gbp(line.explainedGbp)}
                  </span>{" "}
                  evidenced ({Math.round(line.coveragePct)}%)
                </div>
                <CoverageBar
                  value={line.coveragePct}
                  status={line.status}
                  className="h-2"
                />
                <p className="text-sm text-muted-foreground">
                  {summarise(line)}
                </p>
              </div>
            </SheetHeader>
            <div className="flex flex-col gap-6 p-5">
              {line.chains.length === 0 &&
              line.uncostedTickets.length === 0 &&
              line.docs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
                  <SearchX className="size-8 text-muted-foreground" />
                  <div className="font-medium">No evidence found</div>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Nothing in Cortile tickets, Gmail invoices, bank payments or
                    Drive documents matched this line. The draft reply will say
                    so honestly rather than guess.
                  </p>
                </div>
              ) : null}
              {line.chains.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold">
                    Costed work, traced ticket → invoice → payment
                  </h3>
                  {line.chains.map((c, i) => (
                    <ChainCard key={i} chain={c} i={i} />
                  ))}
                </section>
              )}
              {line.uncostedTickets.length > 0 && (
                <Collapsible className="rounded-xl border">
                  <CollapsibleTrigger className="group flex w-full items-center justify-between p-3 text-sm font-semibold">
                    Tickets with no recorded cost ({line.uncostedTickets.length}
                    )
                    <ChevronDown className="size-4 transition-transform group-data-[panel-open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="px-3 text-xs text-muted-foreground">
                      Work was logged for this line, but no cost was recorded,
                      so these don&apos;t count towards coverage.
                    </p>
                    <ul className="divide-y p-3 pt-1">
                      {line.uncostedTickets.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between gap-2 py-2 text-sm"
                        >
                          <span className="truncate">{t.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {fmtDate(t.date)} · {t.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              )}
              {line.docs.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Documents</h3>
                  {line.docs.map((d) => (
                    <a
                      key={d.id}
                      href={d.link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
                    >
                      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {d.name}
                        </span>
                        {d.summary && (
                          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                            <span className="font-medium text-primary">
                              Read by AI:
                            </span>{" "}
                            {d.summary}
                          </span>
                        )}
                      </span>
                      <Badge variant="secondary">
                        {d.kind.replace("_", " ")}
                      </Badge>
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                    </a>
                  ))}
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
