import type { Metadata } from "next";
import { Suspense } from "react";
import { ProposalV5PrivateMobilePreviewContent } from "./v5-mobile-preview-content";

export const metadata: Metadata = {
  title: "Private V5 Mobile Proposal Preview | Mission Control",
  description: "Private internal mobile visual acceptance route for the isolated ClinicGrower V5 proposal renderer.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProposalV5PrivateMobilePreviewPage() {
  return (
    <Suspense
      fallback={
        <section className="rounded-[8px] border border-[#c8dfdd] bg-[#f4fafa] p-5 text-sm text-[#132e35]">
          Loading private V5 mobile preview...
        </section>
      }
    >
      <ProposalV5PrivateMobilePreviewContent />
    </Suspense>
  );
}
