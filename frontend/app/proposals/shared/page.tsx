import { Loader2 } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SharedProposalContent } from "./shared-proposal-content";

export const metadata: Metadata = {
  title: "Your ClinicGrower Proposal",
  description: "Review your recommended ClinicGrower growth plan, scope and commercial terms.",
  keywords: ["ClinicGrower proposal", "clinic growth plan"],
  referrer: "no-referrer",
  openGraph: {
    title: "Your ClinicGrower Proposal",
    description: "Review your recommended ClinicGrower growth plan, scope and commercial terms.",
    type: "website",
    locale: "en_GB",
    siteName: "ClinicGrower",
  },
  twitter: {
    card: "summary",
    title: "Your ClinicGrower Proposal",
    description: "Review your recommended ClinicGrower growth plan, scope and commercial terms.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

function SharedProposalFallback() {
  return (
    <div className="mx-auto flex min-h-[520px] max-w-5xl items-center justify-center rounded-[8px] border border-[#d8e4df] bg-white">
      <Loader2 className="h-6 w-6 animate-spin text-[#315f51]" />
      <span className="sr-only">Loading proposal</span>
    </div>
  );
}

export default function SharedProposalPage() {
  return (
    <main className="min-h-screen bg-[#f5f6f1] px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<SharedProposalFallback />}>
        <SharedProposalContent />
      </Suspense>
    </main>
  );
}
