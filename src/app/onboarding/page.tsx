import { Suspense } from "react";
import type { Metadata } from "next";
import { Onboarding } from "@/components/onboarding/onboarding";

export const metadata: Metadata = {
  title: "Get started · Service Charge Explainer",
};

export default function OnboardingPage() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}
