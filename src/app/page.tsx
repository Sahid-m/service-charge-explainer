import type { Metadata } from "next";
import { Nav } from "@/components/landing/nav";
import {
  EvidenceTrail,
  FinalCta,
  Footer,
  Hero,
  HowItWorks,
  Honest,
  Numbers,
  Problem,
  Reply,
  Sources,
} from "@/components/landing/sections";

export const metadata: Metadata = {
  title: "Service Charge Explainer",
  description:
    "Trace every service-charge bill line to tickets, invoices and bank payments, and reply to leaseholders in plain English.",
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
      <Nav />
      <main className="flex-1">
        <Hero />
        <Problem />
        <Numbers />
        <HowItWorks />
        <EvidenceTrail />
        <Honest />
        <Reply />
        <Sources />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
