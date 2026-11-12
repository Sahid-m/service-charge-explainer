"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Email = {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};

type State =
  | { status: "loading" }
  | { status: "disconnected" }
  | { status: "error" }
  | { status: "connected"; email: string; emails: Email[] };

async function fetchInbox(): Promise<State> {
  try {
    const res = await fetch("/api/gmail/messages", { cache: "no-store" });
    if (!res.ok) return { status: "error" };
    const data = await res.json();
    if (data.connected === false) return { status: "disconnected" };
    return { status: "connected", email: data.email, emails: data.emails };
  } catch {
    return { status: "error" };
  }
}

export function GmailPanel() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => fetchInbox().then(setState), []);
  const refresh = () => {
    setState({ status: "loading" });
    load();
  };

  useEffect(() => {
    // Show a toast after returning from Google, then clean the URL
    const params = new URLSearchParams(window.location.search);
    const result = params.get("gmail");
    if (result === "connected") toast.success("Gmail connected");
    if (result === "error")
      toast.error(
        `Couldn't connect Gmail (${params.get("reason") ?? "unknown"})`,
      );
    if (result) {
      params.delete("gmail");
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

  async function disconnect() {
    await fetch("/api/auth/google/disconnect", { method: "POST" });
    toast("Gmail disconnected");
    setState({ status: "disconnected" });
  }

  const connectLink = (
    <a href="/api/auth/google" className={buttonVariants({ size: "lg" })}>
      Connect to Gmail
    </a>
  );

  if (state.status === "loading") {
    return <Skeleton className="h-40 w-full" />;
  }

  if (state.status === "disconnected" || state.status === "error") {
    return (
      <div className="flex flex-col items-center gap-2">
        {connectLink}
        {state.status === "error" && (
          <p className="text-sm text-destructive">
            Couldn&apos;t load emails. Try reconnecting.
          </p>
        )}
      </div>
    );
  }

  return (
    <Card className="w-full text-left">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>Connected as {state.email}</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {state.emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">No emails found.</p>
        ) : (
          <ul className="divide-y">
            {state.emails.map((m) => (
              <li key={m.id} className="py-3">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="truncate font-medium">{m.from}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {m.date ? new Date(m.date).toLocaleDateString() : ""}
                  </span>
                </div>
                <p className="truncate text-sm">{m.subject}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.snippet}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
