"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
const one = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

type Inputs = {
  units: number;
  unitsPerManager: number;
  salary: number;
  onCost: number;
  share: number;
  saved: number;
  price: number;
};

type Field = {
  key: keyof Inputs;
  label: string;
  step: number;
  prefix?: string;
  suffix?: string;
  basis: "Sourced" | "Assumption" | "Proposed";
};

const fields: Field[] = [
  {
    key: "units",
    label: "Units under management",
    step: 50,
    basis: "Assumption",
  },
  {
    key: "unitsPerManager",
    label: "Units per block manager",
    step: 25,
    basis: "Sourced",
  },
  {
    key: "salary",
    label: "Block manager salary",
    step: 500,
    prefix: "£",
    basis: "Sourced",
  },
  {
    key: "onCost",
    label: "Employer on-costs (NI, pension, overheads)",
    step: 5,
    suffix: "%",
    basis: "Assumption",
  },
  {
    key: "share",
    label: "Share of time on service-charge evidence and owner queries",
    step: 5,
    suffix: "%",
    basis: "Assumption",
  },
  {
    key: "saved",
    label: "Time saved by Service Lens on that work",
    step: 5,
    suffix: "%",
    basis: "Assumption",
  },
  {
    key: "price",
    label: "Our price per unit per month",
    step: 0.05,
    prefix: "£",
    basis: "Proposed",
  },
];

export function RoiCalculator() {
  const id = useId();
  const [v, setV] = useState<Inputs>({
    units: 2000,
    unitsPerManager: 500,
    salary: 40600,
    onCost: 25,
    share: 25,
    saved: 80,
    price: 0.5,
  });

  const managers = v.unitsPerManager > 0 ? v.units / v.unitsPerManager : 0;
  const costToday =
    managers * v.salary * (1 + v.onCost / 100) * (v.share / 100);
  const ourCost = v.units * v.price * 12;
  const timeSaved = costToday * (v.saved / 100);
  const fte = managers * (v.share / 100) * (v.saved / 100);
  const net = timeSaved - ourCost;
  const ret = ourCost > 0 ? timeSaved / ourCost : 0;

  const outputs = [
    { label: "Managers needed", value: one.format(managers) },
    { label: "Cost of this work today", value: `${gbp.format(costToday)}/yr` },
    { label: "Service Lens", value: `${gbp.format(ourCost)}/yr` },
    {
      label: "Staff time saved",
      value: `${gbp.format(timeSaved)}/yr`,
      note: `≈ ${one.format(fte)} of a full-time manager freed up`,
    },
  ];

  return (
    <div className="grid overflow-hidden rounded-xl border border-border bg-background md:grid-cols-12">
      <div className="border-b border-border p-6 md:col-span-6 md:border-r md:border-b-0 md:p-8">
        <p className="text-xs font-medium tracking-wider text-primary uppercase">
          Estimate — every assumption is editable
        </p>
        <div className="mt-6 space-y-4">
          {fields.map((f) => (
            <label
              key={f.key}
              htmlFor={`${id}-${f.key}`}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span>
                <span className="block text-foreground">{f.label}</span>
                <span
                  className={cn(
                    "text-xs",
                    f.basis === "Sourced"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {f.basis === "Sourced"
                    ? "Sourced, see notes"
                    : f.basis === "Proposed"
                      ? "Proposed pricing"
                      : "Our assumption"}
                </span>
              </span>
              <span className="flex h-9 w-32 shrink-0 items-center rounded-lg border border-input bg-background px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
                {f.prefix ? (
                  <span className="mr-1 text-muted-foreground">{f.prefix}</span>
                ) : null}
                <input
                  id={`${id}-${f.key}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={f.step}
                  value={v[f.key]}
                  onChange={(e) =>
                    setV((prev) => ({
                      ...prev,
                      [f.key]:
                        e.target.value === "" ? 0 : Number(e.target.value),
                    }))
                  }
                  className="w-full min-w-0 bg-transparent text-right font-medium text-foreground tabular-nums outline-none"
                />
                {f.suffix ? (
                  <span className="ml-1 text-muted-foreground">{f.suffix}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col p-6 md:col-span-6 md:p-8">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-6">
          {outputs.map((o) => (
            <div key={o.label}>
              <dt className="text-sm text-muted-foreground">{o.label}</dt>
              <dd className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
                {o.value}
              </dd>
              {o.note ? (
                <dd className="mt-1 text-xs text-muted-foreground">{o.note}</dd>
              ) : null}
            </div>
          ))}
        </dl>
        <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-border pt-6">
          <div>
            <dt className="text-sm text-muted-foreground">Net saving</dt>
            <dd className="mt-1.5 text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">
              {gbp.format(net)}
            </dd>
            <dd className="mt-1 text-xs text-muted-foreground">per year</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Return</dt>
            <dd className="mt-1.5 text-4xl font-semibold tracking-tight text-coral tabular-nums md:text-5xl">
              {one.format(ret)}×
            </dd>
            <dd className="mt-1 text-xs text-muted-foreground">
              time saved ÷ our price
            </dd>
          </div>
        </dl>
        <p className="mt-auto border-t border-border pt-4 font-mono text-[11px] leading-relaxed text-muted-foreground max-md:mt-8 md:mt-8">
          managers = units ÷ units per manager
          <br />
          cost today = managers × salary × (1 + on-costs) × share of time
          <br />
          our price = units × price × 12
          <br />
          time saved = cost today × time saved %
          <br />
          net saving = time saved − our price · return = time saved ÷ our price
        </p>
      </div>
    </div>
  );
}
