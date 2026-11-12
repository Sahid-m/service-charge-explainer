"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#evidence", label: "Evidence" },
  { href: "/app?building=bld_0853", label: "Live demo" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-background transition-colors duration-200",
        scrolled ? "border-border" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Link href="/" className="shrink-0">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/app?building=bld_0853"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "hidden h-9 px-3.5 sm:inline-flex",
            )}
          >
            Open the demo
          </Link>
          <Link
            href="/onboarding"
            className={cn(buttonVariants(), "h-9 px-3.5")}
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
