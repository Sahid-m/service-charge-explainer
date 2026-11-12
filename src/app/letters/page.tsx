import { Suspense } from "react";
import { LetterWizard } from "@/components/letters/letter-wizard";

export const metadata = { title: "Create service charge letter · Service Lens" };

export default function LettersPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-page" />}>
      <LetterWizard />
    </Suspense>
  );
}
