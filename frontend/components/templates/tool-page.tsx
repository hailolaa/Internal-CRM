"use client";

import { useMemo } from "react";
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
// ToolPageTemplate — Premium operational tool layout
// ============================================================
export function ToolPageTemplate({
  title,
  description,
  fields,
  buildOutput,
  backHref = "/app/ai-tools",
  backLabel = "Back to AI Tools",
  footerNote,
}: {
  title: string;
  description: string;
  fields: FormFieldConfig[];
  buildOutput: (formData: Record<string, string>) => unknown;
  backHref?: string;
  backLabel?: string;
  footerNote?: string;
}) {
  const initialFields: Record<string, string> = {};
  fields.forEach((f) => {
    initialFields[f.name] = "";
  });

  const { fields: formData, updateField } = useFormFields(initialFields);
  const { output, isLoading, run } = useSimulatedAction<unknown>(900);
  const { copied, copy } = useClipboard();

  const outputText = useMemo(() => {
    if (!output) return "";
    return JSON.stringify(output, null, 2);
  }, [output]);

  const handleRun = () => {
    run(() => buildOutput(formData));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 transition-colors"
        style={{ color: "#7A746A" }}
      >
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </Link>

      <div data-gsap-reveal>
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight"
          style={{ color: "#252421" }}
        >
          {title}
        </h1>
        <p className="mt-1" style={{ color: "#7A746A" }}>
          {description}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input Panel */}
        <div
          data-gsap-reveal
          className="rounded-2xl p-5 md:p-6 space-y-4"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid #E5DED6",
            boxShadow: "0 2px 12px rgba(37, 36, 33, 0.05)",
          }}
        >
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
                <Loader2 className="w-4 h-4 animate-spin" /> Building…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Generate
              </>
            )}
          </button>

          {footerNote && (
            <p className="text-xs" style={{ color: "#7A746A" }}>
              {footerNote}
            </p>
          )}
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold" style={{ color: "#252421" }}>
              Structured output
            </h2>
            {outputText && (
              <button
                onClick={() => copy(outputText)}
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
            <pre
              data-gsap-output
              className="text-xs rounded-xl p-4 overflow-auto max-h-[520px]"
              style={{
                backgroundColor: "#F7F5F2",
                border: "1px solid #E5DED6",
                color: "#3A3834",
              }}
            >
              {outputText}
            </pre>
          ) : (
            <div
              data-gsap-output
              className="text-sm py-16 text-center"
              style={{ color: "#A8A39B" }}
            >
              Fill the inputs and generate your output.
            </div>
          )}

          <div
            className="mt-4 pt-4 text-xs"
            style={{ borderTop: "1px solid #E5DED6", color: "#A8A39B" }}
          >
            Copy/export is enabled. Phase 1 only.
          </div>
        </div>
      </div>
    </div>
  );
}
