"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Account = {
  id: string;
  kind: "account" | "card";
  name: string;
  type: string;
  currency: string;
  mask?: string;
  balance?: { current: number; available?: number; currency: string };
};

type Connection = {
  id: string;
  provider: { id: string; name: string; logo?: string };
  status: "ok" | "reconnect_required" | "error";
  accounts: Account[];
};

type Transaction = {
  id: string;
  timestamp: string;
  description: string;
  merchant?: string;
  amount: number;
  currency: string;
};

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; connections: Connection[] };

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    amount,
  );

async function fetchConnections(): Promise<State> {
  try {
    const res = await fetch("/api/banking/accounts", { cache: "no-store" });
    if (!res.ok) return { status: "error" };
    const data = (await res.json()) as { connections: Connection[] };
    return { status: "ready", connections: data.connections };
  } catch {
    return { status: "error" };
  }
}

const connectLink = (label = "Connect bank account") => (
  <a href="/api/auth/truelayer" className={buttonVariants({ size: "lg" })}>
    {label}
  </a>
);

export function BankPanel() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => fetchConnections().then(setState), []);
  const refresh = () => {
    setState({ status: "loading" });
    load();
  };

  useEffect(() => {
    // Toast after returning from TrueLayer, then clean the URL
    const params = new URLSearchParams(window.location.search);
    const result = params.get("bank");
    if (result === "connected") toast.success("Bank account connected");
    if (result === "error")
      toast.error(
        `Couldn't connect bank (${params.get("reason") ?? "unknown"})`,
      );
    if (result) {
      params.delete("bank");
      params.delete("reason");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (qs ? `?${qs}` : ""),
      );
    }

    load();
  }, [load]);

  async function disconnect(id: string) {
    await fetch("/api/auth/truelayer/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    toast("Bank disconnected");
    refresh();
  }

  if (state.status === "loading") {
    return <Skeleton className="h-40 w-full" />;
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center gap-2">
        {connectLink()}
        <p className="text-sm text-destructive">
          Couldn&apos;t load bank accounts.
        </p>
      </div>
    );
  }

  if (state.connections.length === 0) {
    return <div className="flex justify-center">{connectLink()}</div>;
  }

  return (
    <Card className="w-full text-left">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Bank accounts</CardTitle>
          <CardDescription>
            {state.connections.length} connected via TrueLayer
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            Refresh
          </Button>
          <a
            href="/api/auth/truelayer"
            className={buttonVariants({ size: "sm" })}
          >
            Add bank
          </a>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {state.connections.map((conn) => (
          <section key={conn.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {conn.provider.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={conn.provider.logo}
                    alt=""
                    className="size-5 rounded-sm"
                  />
                )}
                <span className="font-medium">{conn.provider.name}</span>
                {conn.status !== "ok" && (
                  <Badge variant="destructive">
                    {conn.status === "reconnect_required"
                      ? "Reconnect needed"
                      : "Error"}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disconnect(conn.id)}
              >
                Disconnect
              </Button>
            </div>
            {conn.status === "reconnect_required" && (
              <p className="text-sm text-muted-foreground">
                Bank access expired.{" "}
                <a href="/api/auth/truelayer" className="underline">
                  Reconnect
                </a>
              </p>
            )}
            <ul className="divide-y rounded-md border">
              {conn.accounts.map((acc) => (
                <AccountRow key={acc.id} connectionId={conn.id} account={acc} />
              ))}
              {conn.status === "ok" && conn.accounts.length === 0 && (
                <li className="p-3 text-sm text-muted-foreground">
                  No accounts returned.
                </li>
              )}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

function AccountRow({
  connectionId,
  account,
}: {
  connectionId: string;
  account: Account;
}) {
  const [open, setOpen] = useState(false);
  const [txns, setTxns] = useState<Transaction[] | "loading" | "error" | null>(
    null,
  );

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || Array.isArray(txns)) return;
    setTxns("loading");
    const params = new URLSearchParams({
      connection: connectionId,
      account: account.id,
      kind: account.kind,
      days: "30",
    });
    try {
      const res = await fetch(`/api/banking/transactions?${params}`);
      if (!res.ok) return setTxns("error");
      const data = (await res.json()) as { transactions: Transaction[] };
      setTxns(data.transactions);
    } catch {
      setTxns("error");
    }
  }

  return (
    <li className="p-3">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{account.name}</p>
          <p className="text-xs text-muted-foreground">
            {account.kind === "card" ? "Card" : account.type}
            {account.mask && ` ••${account.mask}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {account.balance ? (
            <>
              <p className="text-sm font-medium tabular-nums">
                {money(account.balance.current, account.balance.currency)}
              </p>
              {account.balance.available !== undefined && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {money(account.balance.available, account.balance.currency)}{" "}
                  available
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No balance</p>
          )}
        </div>
      </button>

      {open && (
        <div className="mt-3 border-t pt-3">
          {txns === "loading" && <Skeleton className="h-16 w-full" />}
          {txns === "error" && (
            <p className="text-sm text-destructive">
              Couldn&apos;t load transactions.
            </p>
          )}
          {Array.isArray(txns) && txns.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No transactions in the last 30 days.
            </p>
          )}
          {Array.isArray(txns) && txns.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {txns.slice(0, 25).map((t) => (
                <li key={t.id} className="flex justify-between gap-4 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground tabular-nums">
                      {new Date(t.timestamp).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>{" "}
                    {t.merchant || t.description}
                  </span>
                  <span
                    className={`shrink-0 tabular-nums ${t.amount > 0 ? "text-green-600" : ""}`}
                  >
                    {money(t.amount, t.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
