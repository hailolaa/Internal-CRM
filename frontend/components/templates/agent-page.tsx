"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  CheckCircle2,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { useClipboard, useSimulatedAction, useFormFields } from "@/hooks";
import { FormField } from "@/components/ui/forms";
import type { FormFieldConfig } from "@/lib/types";

// ============================================================
// AgentPageTemplate — Premium operational tool layout
// ============================================================
export function AgentPageTemplate({
  character,
  title,
  image,
  accentColor,
  greeting,
  fields,
  generateOutput,
  loadingText,
  emptyText,
  outputTitle,
}: {
  character: string;
  title: string;
  image: string;
  accentColor: string;
  greeting: string;
  fields: FormFieldConfig[];
  generateOutput: (formData: Record<string, string>) => string;
  loadingText?: string;
  emptyText?: string;
  outputTitle?: string;
}) {
  const initialFields: Record<string, string> = {};
  fields.forEach((f) => {
    initialFields[f.name] = "";
  });

  const { fields: formData, updateField } = useFormFields(initialFields);
  const { output, isLoading, run } = useSimulatedAction<string>(2000);
  const { copied, copy } = useClipboard();

  const handleRun = () => {
    run(() => generateOutput(formData));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        href="/app/ai/agents"
        className="inline-flex items-center gap-2 transition-colors"
        style={{ color: "#7A746A" }}
      >
        <ArrowLeft className="w-4 h-4" /> Back to AI Growth Insights
      </Link>

      {/* Tool Header */}
      <div
        data-gsap-reveal
        className="rounded-2xl p-5 md:p-6"
        style={{
          background:
            "linear-gradient(135deg, rgba(125, 143, 122, 0.06) 0%, rgba(168, 181, 162, 0.08) 100%)",
          border: "1px solid rgba(125, 143, 122, 0.2)",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: "rgba(125, 143, 122, 0.1)",
              border: "1px solid rgba(125, 143, 122, 0.2)",
            }}
          >
            <Sparkles className="w-7 h-7 text-[#7D8F7A]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="text-xl md:text-2xl font-bold"
                style={{ color: "#252421" }}
              >
                {title}
              </h1>
              <span
                className="text-sm flex items-center gap-1"
                style={{ color: "#5A8A6A" }}
              >
                <span className="w-2 h-2 rounded-full bg-[#5A8A6A] animate-pulse" />{" "}
                Active
              </span>
            </div>
            <p className="font-medium" style={{ color: "#7D8F7A" }}>
              {character}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm" style={{ color: "#5F5A52" }}>
          {greeting}
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div
          data-gsap-reveal
          className="rounded-2xl p-5 md:p-6 space-y-5"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid #E5DED6",
            boxShadow: "0 2px 12px rgba(37, 36, 33, 0.05)",
          }}
        >
          <h2
            className="font-semibold text-lg flex items-center gap-2"
            style={{ color: "#252421" }}
          >
            <Sparkles className="w-5 h-5 text-[#7D8F7A]" /> Provide details
          </h2>

          {fields.map((field) => (
            <FormField
              key={field.name}
              label={field.label}
              value={formData[field.name] || ""}
              onChange={updateField(field.name)}
              placeholder={field.placeholder}
              type={field.type}
              rows={field.rows}
              options={field.options?.map((o) =>
                typeof o === "string" ? { value: o, label: o } : o,
              )}
            />
          ))}

          <button
            onClick={handleRun}
            disabled={isLoading}
            className="w-full font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            style={{
              backgroundColor: "#3A3834",
              color: "#FFFCF9",
              boxShadow: "0 2px 8px rgba(37, 36, 33, 0.2)",
            }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />{" "}
                {loadingText || "Analysing..."}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Generate Insights
              </>
            )}
          </button>
        </div>

        {/* Output Panel */}
        <div
          data-gsap-output
          className="rounded-2xl p-5 md:p-6"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid #E5DED6",
            boxShadow: "0 2px 12px rgba(37, 36, 33, 0.05)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg" style={{ color: "#252421" }}>
              {outputTitle || "Analysis"}
            </h2>
            {output && (
              <button
                onClick={() => copy(output)}
                className="p-2 rounded-lg transition-colors"
                style={{ backgroundColor: "#F7F5F2" }}
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 text-[#5A8A6A]" />
                ) : (
                  <Copy className="w-4 h-4 text-[#7A746A]" />
                )}
              </button>
            )}
          </div>
          {output ? (
            <div
              data-gsap-output
              className="prose prose-sm max-w-none whitespace-pre-wrap text-sm"
              style={{ color: "#3A3834" }}
            >
              {output}
            </div>
          ) : (
            <div data-gsap-output className="text-center py-12 md:py-16">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{
                  backgroundColor: "rgba(125, 143, 122, 0.08)",
                  border: "1px solid rgba(125, 143, 122, 0.15)",
                }}
              >
                <Sparkles className="w-8 h-8 text-[#A8B5A2]" />
              </div>
              <p className="text-sm" style={{ color: "#A8A39B" }}>
                {emptyText ||
                  "Provide the details above and generate your insights."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
