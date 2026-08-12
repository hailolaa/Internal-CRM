import type { Metadata } from "next";
import { Suspense } from "react";
import { ProposalV5RealRecordPreviewRouteContent } from "../preview/v5-real-record-preview";

export const metadata: Metadata = {
  title: "Real Record V5 Proposal Preview | Mission Control",
  description: "Private internal route for previewing frozen ClinicGrower V5 proposal snapshots from real CRM records.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProposalV5RealRecordPreviewPage() {
  return (
    <Suspense
      fallback={
        <section className="rounded-[8px] border border-[#c8dfdd] bg-[#f4fafa] p-5 text-sm text-[#132e35]">
          Loading real-record V5 preview...
        </section>
      }
    >
      <ProposalV5RealRecordPreviewRouteContent />
    </Suspense>
  );
}
