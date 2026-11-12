import { cn } from "@/lib/utils";

/** Simple mark: a ledger line with a tick, plus the product name. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        aria-hidden="true"
        fill="none"
      >
        <rect width="24" height="24" rx="6" className="fill-foreground" />
        <path
          d="M6.5 8h11M6.5 12h6M6.5 16h4"
          className="stroke-background"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="m14 15.5 1.75 1.75L19 14"
          className="stroke-primary"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Service Charge Explainer
    </span>
  );
}
