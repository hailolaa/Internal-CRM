"use client";

import { Card, StatCard, AlertBanner } from "@/components/ui";
import { Shield, CheckCircle, AlertTriangle, FileText, Headphones, Trash2 } from "lucide-react";
import type {
  CallLogRecord,
  CallUpdatePayload,
  ComplianceSettingsRecord,
  RecordingDeletionRequestRecord,
} from "@/lib/api-types";

const consentMethodLabels: Record<NonNullable<CallLogRecord["consentMethod"]>, string> = {
  verbal: "Verbal",
  recorded_prompt: "Recorded Prompt",
  written: "Written",
  implied: "Implied",
  unknown: "Unknown",
};

const deletionStatusLabels: Record<RecordingDeletionRequestRecord["status"], string> = {
  requested: "Requested",
  approved: "Approved",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isRetentionDue(call: CallLogRecord) {
  if (!call.retentionDeadline || !call.recordingUrl) return false;
  const deadline = new Date(call.retentionDeadline);
  if (Number.isNaN(deadline.getTime())) return false;
  return deadline.getTime() <= Date.now() + 30 * 24 * 60 * 60 * 1000;
}

export function CallComplianceStats({ calls = [] }: { calls?: CallLogRecord[] }) {
  const total = calls.length;
  const recorded = calls.filter((call) => Boolean(call.recordingUrl)).length;
  const consented = calls.filter((call) => call.consentCaptured).length;
  const dueSoon = calls.filter(isRetentionDue).length;
  const consentRate = total > 0 ? Math.round((consented / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard label="Consent Rate" value={total > 0 ? `${consentRate}%` : "-"} icon={Shield} color="green" />
      <StatCard label="Calls Recorded" value={String(recorded)} icon={Headphones} color="teal" />
      <StatCard label="Missing Consent" value={String(Math.max(total - consented, 0))} icon={AlertTriangle} color="amber" />
      <StatCard label="Retention Due" value={String(dueSoon)} icon={CheckCircle} color={dueSoon > 0 ? "amber" : "green"} />
    </div>
  );
}

export function CallComplianceAlert({ calls = [] }: { calls?: CallLogRecord[] }) {
  const missingConsent = calls.filter((call) => !call.consentCaptured).length;
  const dueSoon = calls.filter(isRetentionDue).length;

  if (missingConsent === 0 && dueSoon === 0) {
    return (
      <AlertBanner
        icon={CheckCircle}
        title="Call compliance records are up to date"
        description="All loaded calls have consent captured and no recording retention deadline is due soon."
        variant="success"
      />
    );
  }

  return (
    <AlertBanner
      icon={AlertTriangle}
      title="Call compliance needs review"
      description={`${missingConsent} call${missingConsent === 1 ? "" : "s"} missing consent capture. ${dueSoon} recording${dueSoon === 1 ? "" : "s"} due for retention review within 30 days.`}
      variant="warning"
    />
  );
}

export function CallConsentLog({
  calls = [],
  isMutating = false,
  onUpdateCall,
  onRequestDeletion,
  onUpdateDeletionRequest,
}: {
  calls?: CallLogRecord[];
  isMutating?: boolean;
  onUpdateCall?: (call: CallLogRecord, payload: CallUpdatePayload) => Promise<void>;
  onRequestDeletion?: (call: CallLogRecord) => Promise<void>;
  onUpdateDeletionRequest?: (call: CallLogRecord, status: RecordingDeletionRequestRecord["status"]) => Promise<void>;
}) {
  return (
    <Card padding="p-0">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" /> Consent Log
        </h2>
        <span className="text-xs text-gray-500">Live calls</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Contact</th>
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Consent</th>
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Method</th>
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Retention</th>
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Recording</th>
            </tr>
          </thead>
          <tbody>
            {calls.slice(0, 20).map((call) => (
              <tr key={call.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-5 py-4">
                  <p className="font-medium text-sm">{call.contactName}</p>
                  <p className="text-xs text-gray-500">{formatDate(call.createdAt)}</p>
                </td>
                <td className="px-5 py-4">
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={call.consentCaptured}
                      disabled={isMutating || !onUpdateCall}
                      onChange={(event) =>
                        void onUpdateCall?.(call, {
                          consentCaptured: event.target.checked,
                          consentTimestamp: event.target.checked ? new Date().toISOString() : null,
                          consentMethod: event.target.checked ? call.consentMethod || "verbal" : null,
                        })
                      }
                      className="h-4 w-4 accent-violet-500"
                    />
                    {call.consentCaptured ? "Captured" : "Missing"}
                  </label>
                  <p className="mt-1 text-xs text-gray-500">{formatDate(call.consentTimestamp)}</p>
                </td>
                <td className="px-5 py-4">
                  <select
                    value={call.consentMethod || "unknown"}
                    disabled={isMutating || !onUpdateCall}
                    onChange={(event) =>
                      void onUpdateCall?.(call, {
                        consentMethod: event.target.value as CallLogRecord["consentMethod"],
                        consentCaptured: true,
                        consentTimestamp: call.consentTimestamp || new Date().toISOString(),
                      })
                    }
                    className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-200"
                  >
                    {Object.entries(consentMethodLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-4">
                  <input
                    type="date"
                    value={call.retentionDeadline || ""}
                    disabled={isMutating || !onUpdateCall}
                    onChange={(event) => void onUpdateCall?.(call, { retentionDeadline: event.target.value || null })}
                    className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-200"
                  />
                  {isRetentionDue(call) && <p className="mt-1 text-xs text-amber-400">Review due</p>}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    {call.recordingUrl ? (
                      <Headphones className="w-4 h-4 text-teal-400" />
                    ) : (
                      <span className="text-xs text-gray-600">Deleted/none</span>
                    )}
                    {call.recordingDeletionRequest ? (
                      <select
                        value={call.recordingDeletionRequest.status}
                        disabled={isMutating || !onUpdateDeletionRequest}
                        onChange={(event) =>
                          void onUpdateDeletionRequest?.(
                            call,
                            event.target.value as RecordingDeletionRequestRecord["status"],
                          )
                        }
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-200"
                      >
                        {Object.entries(deletionStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onRequestDeletion?.(call)}
                        disabled={isMutating || !call.recordingUrl || !onRequestDeletion}
                        className="rounded-lg p-1.5 hover:bg-white/10 disabled:opacity-40"
                        aria-label={`Request recording deletion for ${call.contactName}`}
                      >
                        <Trash2 className="h-4 w-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {calls.length === 0 && (
              <tr>
                <td className="px-5 py-8 text-sm text-gray-400" colSpan={5}>No call consent records loaded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function CallCompliancePolicies({ settings }: { settings?: ComplianceSettingsRecord | null }) {
  const policies = [
    { label: "Data retention period", value: settings?.retentionPeriod ?? "Backend default", status: Boolean(settings) },
    {
      label: "Consent tracking setting",
      value: settings?.toggles?.consentTracking === undefined ? "Not loaded" : settings.toggles.consentTracking ? "Enabled" : "Disabled",
      status: settings?.toggles?.consentTracking === true,
    },
    { label: "Call-level consent capture", value: "Live per call", status: true },
    { label: "Recording deletion workflow", value: "Request tracked", status: true },
  ];

  return (
    <Card>
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-violet-400" /> Compliance Policies
      </h3>
      <div className="space-y-3">
        {policies.map((policy) => (
          <div key={policy.label} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <span className="text-sm text-gray-300">{policy.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded text-right ${policy.status ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"}`}>
              {policy.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
