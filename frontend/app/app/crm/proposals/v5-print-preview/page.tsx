import type { Metadata } from "next";
import { Suspense } from "react";
import { ProposalV5PrivatePrintPreviewContent } from "./v5-print-preview-content";

export const metadata: Metadata = {
  title: "Private V5 Print Preview | Mission Control",
  description: "Private internal print/PDF acceptance route for the isolated ClinicGrower V5 proposal renderer.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProposalV5PrivatePrintPreviewPage() {
  return (
    <Suspense
      fallback={
        <section className="proposal-v5-print-preview-chrome rounded-[8px] border border-[#c8dfdd] bg-[#f4fafa] p-5 text-sm text-[#132e35]">
          Loading private V5 print preview...
        </section>
      }
    >
      <ProposalV5PrivatePrintPreviewContent />
    </Suspense>
  );
}
