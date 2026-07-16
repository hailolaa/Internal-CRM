import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function DashboardReturnLink({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <Link
      href="/app"
      aria-label="Back to Mission Control dashboard"
      className="inline-flex w-fit items-center gap-2 rounded-xl border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] px-3 py-2 text-sm font-semibold text-[#315f62] transition-colors hover:bg-[#eaedeb] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to Mission Control
    </Link>
  );
}
