import { StatCardSkeleton } from "@/components/ui";

export type RevenueKPI = {
  label: string;
  value: string;
  support: string;
  trend: string;
  trendUp: boolean;
};

export default function RevenueKPISection({
  kpis,
  isLoading = false,
}: {
  kpis: RevenueKPI[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-[28px] px-6 py-7 flex flex-col gap-3 transition-shadow duration-200 hover:shadow-md"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow:
              "0 1px 4px rgba(0,0,0,0.03), 0 2px 12px rgba(0,0,0,0.02)",
          }}
        >
          {/* Label */}
          <p
            className="text-xs font-medium tracking-wide uppercase"
            style={{ color: "#6B7280", letterSpacing: "0.06em" }}
          >
            {kpi.label}
          </p>

          {/* Value */}
          <p
            className="text-4xl font-bold tracking-tight leading-none"
            style={{ color: "#111111", letterSpacing: "-0.03em" }}
          >
            {kpi.value}
          </p>

          {/* Footer row */}
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs" style={{ color: "#6B7280" }}>
              {kpi.support}
            </p>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: kpi.trendUp
                  ? "rgba(110,106,232,0.07)"
                  : "rgba(220,38,38,0.07)",
                color: kpi.trendUp ? "#6E6AE8" : "#DC2626",
                border: kpi.trendUp
                  ? "1px solid rgba(110,106,232,0.14)"
                  : "1px solid rgba(220,38,38,0.14)",
              }}
            >
              <span>{kpi.trendUp ? "↑" : "↓"}</span>
              {kpi.trend}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
