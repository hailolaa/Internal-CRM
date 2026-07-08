import { Loader2, Sparkles } from "lucide-react";
import { CardSkeleton } from "@/components/ui";

export type RevenueInsightItem = {
  label: string;
  body: string;
  accent: string;
  provenance?: string;
};

export default function RevenueAIInsightPanel({
  insights,
  generationMessage,
  generationTone = "neutral",
  isGenerating = false,
  isLoading = false,
  onGenerate,
}: {
  insights: RevenueInsightItem[];
  generationMessage?: string;
  generationTone?: "error" | "neutral" | "success";
  isGenerating?: boolean;
  isLoading?: boolean;
  onGenerate?: () => void;
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
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
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
              AI Growth Insight
            </span>
          </div>

          <h2
            className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug"
            style={{ color: "#111111", letterSpacing: "-0.02em" }}
          >
            AI Growth Insight
          </h2>
          <p
            className="mt-2 max-w-2xl text-sm sm:text-base leading-relaxed"
            style={{ color: "#6B7280" }}
          >
            Generate revenue leakage insights from live calls, opportunities and
            action records, then review the source provenance before acting.
          </p>
        </div>

        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={isLoading || isGenerating}
            className="inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-[#6E6AE8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5D59D6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? "Generating..." : "Generate AI insight"}
          </button>
        )}
      </div>

      {generationMessage && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            generationTone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : generationTone === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-[#E5DED6] bg-[#FFFCF9] text-[#6B7280]"
          }`}
        >
          {generationMessage}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <CardSkeleton key={index} lines={3} />
          ))}
        </div>
      ) : insights.length > 0 ? (
        <div className="space-y-4">
          {insights.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className="grid grid-cols-[2rem_1fr] gap-x-4 gap-y-3 rounded-[20px] px-6 py-6 sm:grid-cols-[2rem_minmax(13rem,16rem)_1fr_0.25rem] sm:items-start"
              style={{
                backgroundColor: "#FFFCF9",
                border: "1px solid rgba(0,0,0,0.05)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: "rgba(110,106,232,0.07)",
                  color: "#6E6AE8",
                  border: "1px solid rgba(110,106,232,0.14)",
                }}
              >
                {index + 1}
              </span>

              <div className="min-w-0 sm:pr-4">
                <p
                  className="text-sm font-semibold leading-snug"
                  style={{ color: "#111111" }}
                >
                  {item.label}
                </p>
              </div>

              <p
                className="col-span-2 min-w-0 text-sm leading-relaxed sm:col-span-1"
                style={{ color: "#6B7280" }}
              >
                {item.body}
                {item.provenance && (
                  <span className="mt-3 block text-xs font-medium text-[#8A8176]">
                    {item.provenance}
                  </span>
                )}
              </p>

              <div
                className="hidden h-full min-h-8 w-1 rounded-full sm:block"
                style={{
                  backgroundColor: item.accent,
                  opacity: 0.18,
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          className="rounded-[20px] px-6 py-6"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid rgba(0,0,0,0.05)",
          }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>
            No live revenue insights are available for this range yet. As calls,
            consults, deposits and action tasks build up, revenue recovery
            opportunities will appear here.
          </p>
        </div>
      )}

      <div
        className="mt-6 pt-5"
        style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}
      >
        <p className="text-xs leading-relaxed" style={{ color: "#9CA3AF" }}>
          Insights are generated from live revenue leakage, open opportunities
          and action records. Cards marked OpenAI generated came from the live
          AI generation endpoint; deterministic cards are rule-based fallbacks.
        </p>
      </div>
    </div>
  );
}
