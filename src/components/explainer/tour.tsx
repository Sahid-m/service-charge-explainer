"use client";

import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export type TourStep = {
  title: string;
  body: string;
  target?: "verdict" | "attention";
  line?: string;
};

export function TourCard({
  steps,
  index,
  loading,
  loadingLabel,
  sheetOpen,
  onBack,
  onNext,
  onExit,
}: {
  steps: TourStep[];
  index: number;
  loading: boolean;
  loadingLabel: string;
  sheetOpen: boolean;
  onBack: () => void;
  onNext: () => void;
  onExit: () => void;
}) {
  const step = steps[index];
  const last = index === steps.length - 1;
  return (
    <div
      role="dialog"
      aria-label="Guided demo"
      className={cn(
        "fixed bottom-4 z-[60] w-[min(380px,calc(100vw-2rem))] rounded-xl border-2 border-primary bg-popover p-4 text-popover-foreground shadow-2xl",
        sheetOpen ? "left-4" : "right-4",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-primary uppercase">
          Guided demo
          {step && !loading ? ` · Step ${index + 1}/${steps.length}` : ""}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onExit}
          aria-label="Exit demo"
        >
          <X />
        </Button>
      </div>
      {loading || !step ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {loadingLabel}
        </div>
      ) : (
        <>
          <div className="font-semibold">{step.title}</div>
          <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-5 rounded-full",
                    i <= index ? "bg-primary" : "bg-muted",
                  )}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onBack}
                disabled={index === 0}
              >
                <ArrowLeft /> Back
              </Button>
              <Button size="sm" onClick={onNext}>
                {last ? "Draft the reply" : "Next"} <ArrowRight />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
