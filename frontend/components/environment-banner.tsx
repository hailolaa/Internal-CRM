import { publicEnv } from "@/lib/env";
import { getEnvironmentBannerContent } from "@/lib/environment-label";

export function EnvironmentBanner() {
  const content = getEnvironmentBannerContent(publicEnv.releaseEnvironment);
  if (!content) return null;

  return (
    <div
      role="status"
      aria-label={`${content.label} environment`}
      className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-amber-950"
    >
      <span className="mr-2 rounded-sm bg-amber-950 px-2 py-1 text-white">{content.label}</span>
      <span>{content.description}</span>
    </div>
  );
}
