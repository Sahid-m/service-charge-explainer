import Image from "next/image";
import { cn } from "@/lib/utils";

/** A real product screenshot in a quiet browser-style frame. */
export function ScreenshotFrame({
  src,
  alt,
  aspect,
  priority,
  sizes,
  label,
  className,
  windowClassName,
  imageClassName,
}: {
  src: string;
  alt: string;
  /** CSS aspect-ratio of the visible window, e.g. "1152 / 760". */
  aspect: string;
  priority?: boolean;
  sizes: string;
  label?: string;
  className?: string;
  /** Optional Tailwind aspect/object classes overriding `aspect` (e.g. responsive crops). */
  windowClassName?: string;
  imageClassName?: string;
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-background shadow-[0_1px_2px_rgb(15_23_42/0.04),0_24px_48px_-16px_rgb(15_23_42/0.14)]",
        className,
      )}
    >
      <div className="flex h-9 items-center gap-1.5 border-b border-border bg-muted px-4">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        {label ? (
          <span className="ml-3 truncate font-mono text-[11px] text-muted-foreground">
            {label}
          </span>
        ) : null}
      </div>
      <div
        className={cn("relative w-full", windowClassName)}
        style={windowClassName ? undefined : { aspectRatio: aspect }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={cn("object-cover object-top", imageClassName)}
        />
      </div>
    </figure>
  );
}
