import type { Metadata } from "next";
import { Suspense } from "react";
import { ProposalV5PrivatePreviewContent } from "./v5-preview-content";

export const metadata: Metadata = {
  title: "Private V5 Proposal Preview | Mission Control",
  description: "Private internal visual acceptance route for the isolated ClinicGrower V5 proposal renderer.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProposalV5PrivatePreviewPage() {
  return (
    <Suspense
      fallback={
        <section className="proposal-v5-private-preview-chrome rounded-[8px] border border-[#c8dfdd] bg-[#f4fafa] p-5 text-sm text-[#132e35]">
          Loading private V5 preview...
        </section>
      }
    >
      <ProposalV5PrivatePreviewContent />
    </Suspense>
  );
}
