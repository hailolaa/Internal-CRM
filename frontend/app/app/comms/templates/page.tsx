"use client";

import { useState } from "react";
import { useEffect } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Copy,
  Mail,
  MessageSquare,
  Send,
  X,
} from "lucide-react";
import {
  PageHeader,
  DataTable,
  TableRow,
  TableCell,
  StatusBadge,
  MoreButton,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import type { MessageTemplateRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

interface Template {
  id: string;
  name: string;
  category: string;
  channel: MessageTemplateRecord["channel"];
  subject: string | null;
  updatedAt: string;
  status: MessageTemplateRecord["status"];
  body: string;
}

const DEFAULT_VARIABLE_VALUES: Record<string, string> = {
  first_name: "Test",
  last_name: "Prospect",
  workspace_name: "The Growth Group",
  meeting_date: "June 1, 2026",
  meeting_time: "10:00 AM",
  service_package: "Website build",
};

function extractPlaceholderKeys(...values: Array<string | null | undefined>) {
  const keys = new Set<string>();
  values.filter(Boolean).forEach((value) => {
    for (const match of String(value).matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)) {
      keys.add(String(match[1]).toLowerCase());
    }
  });
  return [...keys].sort();
}

function mapTemplate(record: MessageTemplateRecord): Template {
  return {
    id: record.id,
    name: record.name,
    category: record.subject ?? "General",
    channel: record.channel,
    subject: record.subject,
    updatedAt: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(record.updatedAt)),
    status: record.status,
    body: record.body,
  };
}

export default function TemplatesPage() {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.token;
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [testTemplate, setTestTemplate] = useState<Template | null>(null);
  const [testRecipient, setTestRecipient] = useState("");
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadTemplates() {
      try {
        const rows = await api.messageTemplates.list(authToken);
        if (!cancelled) {
          setTemplates(rows.map(mapTemplate));
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load templates", error);
        if (!cancelled) {
          setTemplates([]);
          setStatusMessage(
            error instanceof Error
              ? error.message
              : "Unable to load live message templates.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const openSendTest = (template: Template) => {
    if (template.channel !== "email" && template.channel !== "sms") {
      setStatusMessage("Test send supports email and SMS templates only.");
      return;
    }

    const variables = extractPlaceholderKeys(template.subject, template.body).reduce<Record<string, string>>(
      (values, key) => ({
        ...values,
        [key]: DEFAULT_VARIABLE_VALUES[key] ?? "",
      }),
      {},
    );

    setTestTemplate(template);
    setTestRecipient("");
    setTestVariables(variables);
    setTestError(null);
    setStatusMessage(null);
  };

  const closeSendTest = () => {
    if (isSendingTest) return;
    setTestTemplate(null);
    setTestRecipient("");
    setTestVariables({});
    setTestError(null);
  };

  const handleSendTest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !testTemplate) return;

    setIsSendingTest(true);
    setTestError(null);
    try {
      const result = await api.messageTemplates.testSend(token, testTemplate.id, {
        recipient: testRecipient,
        channel: testTemplate.channel,
        variables: testVariables,
      });
      setStatusMessage(
        result.deliveryStatus === "sent"
          ? `Test email sent to ${result.recipient}.`
          : `Test SMS queued for ${result.recipient}.`,
      );
      setTestTemplate(null);
      setTestRecipient("");
      setTestVariables({});
      setTestError(null);
    } catch (error) {
      console.error("Failed to send template test", error);
      setTestError(
        error instanceof Error
          ? error.message
          : "Unable to send the test message.",
      );
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleCopyTemplate = async (template: Template) => {
    await navigator.clipboard.writeText(template.body);
    setStatusMessage(`${template.name} copied.`);
  };

  const handleArchiveTemplate = async (template: Template) => {
    if (!token) return;
    if (!window.confirm(`Archive ${template.name}?`)) return;

    try {
      await api.messageTemplates.update(token, template.id, {
        status: "archived",
      });
      setTemplates((items) =>
        items.map((item) =>
          item.id === template.id ? { ...item, status: "archived" } : item,
        ),
      );
      setStatusMessage("Template archived.");
    } catch (error) {
      console.error("Failed to archive template", error);
      setStatusMessage("Could not archive template.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        subtitle="Reusable message templates for quick replies."
        right={
          <button
            onClick={() => router.push("/app/comms/templates/new")}
            className="bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-medium px-4 py-2.5 rounded-[14px] flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Template
          </button>
        }
      />

      {statusMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <DataTable
        headers={[
          { label: "Template" },
          { label: "Category" },
          { label: "Channel" },
          { label: "Usage" },
          { label: "Updated" },
          { label: "Actions" },
        ]}
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <TableRow key={index}>
              <td colSpan={6} className="px-6 py-3">
                <div className="h-12 rounded-[14px] bg-[rgba(110,106,232,0.08)] animate-pulse" />
              </td>
            </TableRow>
          ))
        ) : templates.length ? (
          templates.map((template) => (
            <TableRow key={template.id}>
              <TableCell className="font-medium">{template.name}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-[rgba(110,106,232,0.08)] px-2 py-1 rounded-[8px] text-[#6B7280]">
                  {template.category}
                </span>
                <StatusBadge status={template.status} />
              </div>
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-2 text-[#6B7280]">
                {template.channel === "email" ? (
                  <Mail className="w-4 h-4" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
                {template.channel}
              </span>
            </TableCell>
            <TableCell className="text-[#6B7280] text-sm">Test enabled</TableCell>
            <TableCell className="text-[#6B7280] text-sm">
              {template.updatedAt}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openSendTest(template)}
                  aria-label={`Send test for ${template.name}`}
                  disabled={isSendingTest}
                  className="px-2.5 py-1 rounded-[10px] text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50 bg-[rgba(110,106,232,0.08)] text-[#6E6AE8] border border-[rgba(110,106,232,0.14)] hover:bg-[rgba(110,106,232,0.14)]"
                >
                  <Send className="w-3 h-3" /> Send Test
                </button>
                <button
                  onClick={() => handleCopyTemplate(template)}
                  aria-label={`Copy ${template.name}`}
                  className="p-1.5 rounded-[10px] hover:bg-[rgba(110,106,232,0.06)] transition-colors"
                >
                  <Copy className="w-4 h-4 text-[#6B7280]" />
                </button>
                <MoreButton
                  label={`Archive ${template.name}`}
                  onClick={() => handleArchiveTemplate(template)}
                />
              </div>
            </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <td colSpan={6} className="px-6 py-10 text-center text-[#6B7280]">
              No live message templates found.
            </td>
          </TableRow>
        )}
      </DataTable>

      {testTemplate && (
        <div
          data-gsap-overlay
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6"
        >
          <div
            data-gsap-popover
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-test-title"
            className="w-full max-w-lg rounded-[16px] bg-white shadow-xl border border-[rgba(0,0,0,0.08)]"
          >
            <div className="flex items-center justify-between border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
              <div>
                <h2 id="send-test-title" className="text-base font-semibold text-[#111111]">
                  Send Test
                </h2>
                <p className="text-xs text-[#6B7280]">{testTemplate.name}</p>
              </div>
              <button
                type="button"
                onClick={closeSendTest}
                disabled={isSendingTest}
                aria-label="Close send test"
                className="p-2 rounded-[10px] hover:bg-[rgba(110,106,232,0.06)] disabled:opacity-50"
              >
                <X className="w-4 h-4 text-[#6B7280]" />
              </button>
            </div>

            <form onSubmit={handleSendTest} className="space-y-4 px-5 py-5">
              {testError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {testError}
                </div>
              )}

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#6B7280]">
                  {testTemplate.channel === "email" ? "Email recipient" : "SMS recipient"}
                </span>
                <input
                  id="template-test-recipient"
                  name="template-test-recipient"
                  aria-label={testTemplate.channel === "email" ? "Email recipient" : "SMS recipient"}
                  value={testRecipient}
                  onChange={(event) => setTestRecipient(event.target.value)}
                  required
                  type={testTemplate.channel === "email" ? "email" : "tel"}
                  placeholder={testTemplate.channel === "email" ? "name@example.com" : "+1 555 210 0001"}
                  className="w-full rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-[#FAF8F5] px-3 py-2 text-sm text-[#111111] outline-none focus:border-[rgba(110,106,232,0.45)]"
                />
              </label>

              {Object.keys(testVariables).length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-[#6B7280]">Template variables</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(testVariables).map(([key, value]) => (
                      <label key={key} className="block space-y-1.5">
                        <span className="text-xs text-[#6B7280]">{key}</span>
                        <input
                          id={`template-test-variable-${key}`}
                          name={`template-test-variable-${key}`}
                          aria-label={`Template variable ${key}`}
                          value={value}
                          onChange={(event) =>
                            setTestVariables((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                          required
                          className="w-full rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-[#FAF8F5] px-3 py-2 text-sm text-[#111111] outline-none focus:border-[rgba(110,106,232,0.45)]"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeSendTest}
                  disabled={isSendingTest}
                  className="rounded-[12px] border border-[rgba(0,0,0,0.08)] px-4 py-2 text-sm font-medium text-[#6B7280] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="rounded-[12px] bg-[#6E6AE8] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isSendingTest ? "Sending..." : "Send Test"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
