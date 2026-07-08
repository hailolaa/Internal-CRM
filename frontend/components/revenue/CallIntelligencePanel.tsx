import Link from "next/link";
import { CardSkeleton, StatCardSkeleton } from "@/components/ui";

export type CallMetric = {
  label: string;
  value: string;
  explanation: string;
  status: string;
  statusOk: boolean;
};

export default function CallIntelligencePanel({
  metrics,
  insight,
  sourceDescription,
  sourceHref,
  sourceLabel = "View source calls",
  isLoading = false,
}: {
  metrics: CallMetric[];
  insight: string;
  sourceDescription?: string;
  sourceHref?: string;
  sourceLabel?: string;
  isLoading?: boolean;
}) {
  return (
    <div
      className="rounded-[28px] px-8 py-10 sm:px-10 sm:py-12"
      style={{
        backgroundColor: "#FDFCFA",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.03), 0 4px 24px rgba(0,0,0,0.02)",
      }}
    >
      {/* Section header */}
      <div className="mb-8">
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 mb-4"
          style={{
            backgroundColor: "rgba(110,106,232,0.06)",
            border: "1px solid rgba(110,106,232,0.12)",
          }}
        >
          <span
            className="block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "#6E6AE8" }}
          />
          <span
            className="text-xs font-medium tracking-wide"
            style={{ color: "#6E6AE8" }}
          >
            Call Intelligence
          </span>
        </div>

        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug"
          style={{ color: "#111111", letterSpacing: "-0.02em" }}
        >
          Call Intelligence
        </h2>
        <p
          className="mt-2 max-w-2xl text-sm sm:text-base leading-relaxed"
          style={{ color: "#6B7280" }}
        >
          Understand how quickly enquiries are answered, which calls convert,
          and where lost revenue is leaking from clinic follow-up.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }, (_, index) => (
              <StatCardSkeleton key={index} />
            ))
          : metrics.map((item) => (
          <div
            key={item.label}
            className="rounded-[20px] px-6 py-7 flex flex-col gap-3 transition-shadow duration-200 hover:shadow-md"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.05)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            {/* Label */}
            <p
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "#6B7280", letterSpacing: "0.06em" }}
            >
              {item.label}
            </p>

            {/* Value */}
            <p
              className="text-4xl font-bold tracking-tight leading-none"
              style={{ color: "#111111", letterSpacing: "-0.03em" }}
            >
              {item.value}
            </p>

            {/* Explanation */}
            <p
              className="text-xs leading-relaxed flex-1"
              style={{ color: "#6B7280" }}
            >
              {item.explanation}
            </p>

            {/* Status pill */}
            <div className="pt-1">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  backgroundColor: item.statusOk
                    ? "rgba(110,106,232,0.07)"
                    : "rgba(194,120,90,0.07)",
                  color: item.statusOk ? "#6E6AE8" : "#C2785A",
                  border: item.statusOk
                    ? "1px solid rgba(110,106,232,0.14)"
                    : "1px solid rgba(194,120,90,0.14)",
                }}
              >
                <span
                  className="block h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: item.statusOk ? "#6E6AE8" : "#C2785A",
                  }}
                />
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Insight callout */}
      {isLoading ? (
        <div className="mt-6">
          <CardSkeleton lines={2} />
        </div>
      ) : (
        <div
          className="mt-6 rounded-[16px] px-6 py-4"
          style={{
            backgroundColor: "rgba(194,120,90,0.04)",
            border: "1px solid rgba(194,120,90,0.10)",
          }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>
            <span className="font-medium" style={{ color: "#C2785A" }}>
              Insight:
            </span>{" "}
            {insight}
          </p>
          {(sourceDescription || sourceHref) && (
            <div className="mt-3 flex flex-col gap-3 border-t border-[rgba(194,120,90,0.10)] pt-3 sm:flex-row sm:items-center sm:justify-between">
              {sourceDescription && (
                <p className="text-xs leading-relaxed text-[#8A8176]">
                  {sourceDescription}
                </p>
              )}
              {sourceHref && (
                <Link
                  href={sourceHref}
                  className="inline-flex w-fit items-center rounded-xl border border-[rgba(194,120,90,0.18)] bg-[#FFFCF9] px-3 py-2 text-xs font-semibold text-[#9A5524] transition-colors hover:bg-[rgba(194,120,90,0.07)]"
                >
                  {sourceLabel}
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
