"use client";

import { useId, useState } from "react";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** £6.2m unevidenced increases ÷ 1,000 buildings in the Cortile data. */
const AVG_UNEVIDENCED_PER_BUILDING = 6200;

type Field = {
  key: keyof Inputs;
  label: string;
  step: number;
  min: number;
  prefix?: string;
};

type Inputs = {
  buildings: number;
  queries: number;
  hoursToday: number;
  hoursWith: number;
  rate: number;
};

const fields: Field[] = [
  { key: "buildings", label: "Buildings managed", step: 1, min: 0 },
  {
    key: "queries",
    label: "Owner queries per building per year",
    step: 1,
    min: 0,
  },
  {
    key: "hoursToday",
    label: "Hours to assemble evidence per query today",
    step: 0.25,
    min: 0,
  },
  {
    key: "hoursWith",
    label: "Hours with Service Charge Explainer",
    step: 0.25,
    min: 0,
  },
  {
    key: "rate",
    label: "Fully-loaded staff cost per hour",
    step: 1,
    min: 0,
    prefix: "£",
  },
];

export function SavingsCalculator() {
  const id = useId();
  const [v, setV] = useState<Inputs>({
    buildings: 50,
    queries: 6,
    hoursToday: 3,
    hoursWith: 0.25,
    rate: 35,
  });

  const hours = Math.max(
    0,
    v.buildings * v.queries * (v.hoursToday - v.hoursWith),
  );
  const cost = hours * v.rate;
  const evidence = v.buildings * AVG_UNEVIDENCED_PER_BUILDING;

  return (
    <div className="grid overflow-hidden rounded-xl border border-border bg-background md:grid-cols-12">
      <div className="border-b border-border p-6 md:col-span-5 md:border-r md:border-b-0 md:p-8">
        <p className="text-xs font-medium tracking-wider text-primary uppercase">
          Estimate — change the assumptions
        </p>
        <div className="mt-6 space-y-4">
          {fields.map((f) => (
            <label
              key={f.key}
              htmlFor={`${id}-${f.key}`}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="text-muted-foreground">{f.label}</span>
              <span className="flex h-9 w-28 shrink-0 items-center rounded-lg border border-input bg-background px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
                {f.prefix ? (
                  <span className="mr-1 text-muted-foreground">{f.prefix}</span>
                ) : null}
                <input
                  id={`${id}-${f.key}`}
                  type="number"
                  inputMode="decimal"
                  min={f.min}
                  step={f.step}
                  value={Number.isFinite(v[f.key]) ? v[f.key] : ""}
                  onChange={(e) =>
                    setV((prev) => ({
                      ...prev,
                      [f.key]:
                        e.target.value === "" ? 0 : Number(e.target.value),
                    }))
                  }
                  className="w-full bg-transparent text-right font-medium text-foreground tabular-nums outline-none"
                />
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col p-6 md:col-span-7 md:p-8">
        <dl className="grid flex-1 gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">
              Hours saved per year
            </dt>
            <dd className="mt-2 text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">
              {num.format(hours)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              Staff cost saved per year
            </dt>
            <dd className="mt-2 text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">
              {gbp.format(cost)}
            </dd>
          </div>
          <div className="border-t border-border pt-6 sm:col-span-2">
            <dt className="text-sm text-muted-foreground">
              Increases you can evidence before the owner asks
            </dt>
            <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {gbp.format(evidence)}
            </dd>
            <dd className="mt-1 text-xs text-muted-foreground">
              At £6,200 per building — the avg unevidenced increase per building
              in the Cortile data.
            </dd>
          </div>
        </dl>
        <p className="mt-8 border-t border-border pt-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
          hours = buildings × queries × (hours today − hours with app)
          <br />
          staff cost = hours × cost per hour
          <br />
          evidence = buildings × £6,200
        </p>
      </div>
    </div>
  );
}
