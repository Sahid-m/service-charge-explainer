"use client";

import { useMemo, useState } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
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
  const selected = buildings.find((b) => b.id === value);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? buildings.filter((b) =>
          `${b.name} ${b.postcode}`.toLowerCase().includes(s),
        )
      : buildings;
    return list.slice(0, 60);
  }, [q, buildings]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="min-w-0 flex-1 justify-between gap-2 sm:w-72 sm:flex-none"
            aria-label="Choose building"
          />
        }
      >
        <Building2 className="size-4 text-muted-foreground" />
        <span className="flex-1 truncate text-left">
          {selected ? selected.name : "Choose a building…"}
        </span>
        {selected && (
          <span className="text-xs text-muted-foreground">
            {selected.postcode}
          </span>
        )}
        <ChevronsUpDown className="size-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search ${buildings.length} buildings by name or postcode…`}
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            <CommandEmpty>No building matches.</CommandEmpty>
            <CommandGroup>
              {filtered.map((b) => (
                <CommandItem
                  key={b.id}
                  value={b.id}
                  onSelect={() => {
                    onChange(b.id);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <Check
                    className={b.id === value ? "size-4" : "size-4 opacity-0"}
                  />
                  <span className="flex-1 truncate">{b.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {b.postcode}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
