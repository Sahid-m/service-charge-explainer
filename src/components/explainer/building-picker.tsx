"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Loader2,
  MapPin,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { BuildingOption } from "@/lib/explain-types";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const MAX_RESULTS = 30;

type SmartResult = BuildingOption & { reason: string };
type SmartResponse = {
  interpretation: string;
  usedAI: boolean;
  total?: number;
  results: SmartResult[];
  /** The text this response answers (set client-side) */
  query?: string;
};

const EXAMPLES = [
  "Big Manchester block with a lift where insurance jumped",
  "Fir House in Southampton",
  "Small buildings in Leeds with open issues",
];

/** Every word typed must appear somewhere in the building's details. */
function matches(b: BuildingOption, words: string[]) {
  const hay =
    `${b.name} ${b.address ?? ""} ${b.city ?? ""} ${b.postcode} ${b.development ?? ""}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

function Row({
  b,
  selected,
  note,
}: {
  b: BuildingOption;
  selected: boolean;
  note?: string;
}) {
  return (
    <>
      <Check
        className={`mt-0.5 size-4 shrink-0 ${selected ? "text-primary" : "opacity-0"}`}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate font-medium">{b.name}</span>
          {b.development && (
            <span className="truncate text-xs text-muted-foreground">
              {b.development}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">
            {[b.address, b.city, b.postcode].filter(Boolean).join(", ")}
          </span>
        </span>
        {note && (
          <span className="mt-1 block text-xs font-medium text-primary">
            {note}
          </span>
        )}
      </span>
      {b.homes ? (
        <span className="shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">
          {b.homes} homes
        </span>
      ) : null}
    </>
  );
}

export function BuildingPicker({
  buildings,
  value,
  onChange,
}: {
  buildings: BuildingOption[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [smart, setSmart] = useState<SmartResponse | null>(null);
  const [suggested, setSuggested] = useState<SmartResponse | null>(null);
  const [asking, setAsking] = useState(false);
  const askedFor = useRef("");
  const selected = buildings.find((b) => b.id === value);

  // Suggestions when the picker opens with an empty query
  useEffect(() => {
    if (!open || suggested) return;
    fetch("/api/buildings/search")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SmartResponse | null) => d && setSuggested(d))
      .catch(() => {});
  }, [open, suggested]);

  async function ask(query: string) {
    const text = query.trim();
    if (!text || askedFor.current === text) return;
    askedFor.current = text;
    setAsking(true);
    try {
      const r = await fetch(
        `/api/buildings/search?q=${encodeURIComponent(text)}`,
      );
      if (r.ok)
        setSmart({ ...((await r.json()) as SmartResponse), query: text });
    } finally {
      setAsking(false);
    }
  }

  // Ask the AI automatically once the user pauses on a multi-word request
  useEffect(() => {
    const text = q.trim();
    if (text.split(/\s+/).length < 3) return;
    const t = setTimeout(() => ask(text), 700);
    return () => clearTimeout(t);
  }, [q]);

  const local = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return buildings.filter((b) => matches(b, words)).slice(0, MAX_RESULTS);
  }, [q, buildings]);

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    setQ("");
    setSmart(null);
    askedFor.current = "";
  };

  const showSmart = !!q.trim() && !!smart && smart.query === q.trim();
  const smartIds = new Set(showSmart ? smart!.results.map((r) => r.id) : []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="h-auto min-w-0 flex-1 justify-between gap-2 py-1.5 sm:w-80 sm:flex-none"
            aria-label="Choose building"
          />
        }
      >
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 text-left leading-tight">
          <span className="block truncate font-medium">
            {selected ? selected.name : "Choose a building…"}
          </span>
          {selected && (
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {[selected.city, selected.postcode].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(36rem,calc(100vw-2rem))] p-0"
        align="end"
      >
        <Command shouldFilter={false}>
          <div className="relative">
            <CommandInput
              placeholder="Describe the building, e.g. “Manchester block where insurance jumped”"
              value={q}
              onValueChange={setQ}
              onKeyDown={(e) => {
                if (e.key === "Enter" && q.trim() && !smartIds.size) {
                  e.preventDefault();
                  ask(q);
                }
              }}
            />
            {asking && (
              <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-primary" />
            )}
          </div>
          <CommandList className="max-h-[min(28rem,60vh)]">
            {/* Empty query: suggestions + example prompts */}
            {!q.trim() && (
              <>
                <CommandGroup heading="Try asking">
                  {EXAMPLES.map((ex) => (
                    <CommandItem
                      key={ex}
                      value={`example:${ex}`}
                      onSelect={() => {
                        setQ(ex);
                        ask(ex);
                      }}
                      className="gap-2"
                    >
                      <Sparkles className="size-4 text-primary" />
                      <span className="text-sm">{ex}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {suggested && suggested.results.length > 0 && (
                  <CommandGroup
                    heading={
                      <span className="flex items-center gap-1">
                        <TrendingUp className="size-3" />
                        {suggested.interpretation}
                      </span>
                    }
                  >
                    {suggested.results.map((b) => (
                      <CommandItem
                        key={b.id}
                        value={b.id}
                        onSelect={() => choose(b.id)}
                        className="items-start gap-3 py-2"
                      >
                        <Row b={b} selected={b.id === value} note={b.reason} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}

            {/* AI results */}
            {q.trim() && (asking || showSmart) && (
              <CommandGroup
                heading={
                  <span className="flex items-center gap-1 text-primary">
                    <Sparkles className="size-3" />
                    {asking
                      ? "Understanding your request…"
                      : smart!.usedAI
                        ? `AI understood: ${smart!.interpretation}`
                        : smart!.interpretation}
                  </span>
                }
              >
                {showSmart &&
                  smart!.results.map((b) => (
                    <CommandItem
                      key={`ai-${b.id}`}
                      value={`ai-${b.id}`}
                      onSelect={() => choose(b.id)}
                      className="items-start gap-3 py-2"
                    >
                      <Row b={b} selected={b.id === value} note={b.reason} />
                    </CommandItem>
                  ))}
                {showSmart && smart!.results.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No building fits all of that. Try fewer details.
                  </p>
                )}
              </CommandGroup>
            )}

            {/* Instant keyword matches */}
            {q.trim() && local.some((b) => !smartIds.has(b.id)) && (
              <CommandGroup heading="Name, street or postcode matches">
                {local
                  .filter((b) => !smartIds.has(b.id))
                  .map((b) => (
                    <CommandItem
                      key={b.id}
                      value={b.id}
                      onSelect={() => choose(b.id)}
                      className="items-start gap-3 py-2"
                    >
                      <Row b={b} selected={b.id === value} />
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}

            {q.trim() && !asking && !showSmart && local.length === 0 && (
              <CommandItem
                value="ask-ai"
                onSelect={() => ask(q)}
                className="gap-2"
              >
                <Sparkles className="size-4 text-primary" />
                Ask AI to find “{q.trim()}”
              </CommandItem>
            )}
            <CommandEmpty className="hidden" />
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
