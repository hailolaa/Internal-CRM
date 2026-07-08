"use client";

import { Card, StatCard, AlertBanner } from "@/components/ui";
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  FileText,
  Headphones,
  Info,
} from "lucide-react";
import type { CallLogRecord, ComplianceSettingsRecord } from "@/lib/api-types";

type ConsentRecord = {
  id: string;
  contact: string;
  date: string;
  consentStatus: "not_integrated";
  method: string;
  recording: boolean;
};

function buildConsentRecords(calls: CallLogRecord[]): ConsentRecord[] {
  return calls.slice(0, 12).map((call) => {
    const hasRecording = Boolean(call.recordingUrl);

    return {
      id: call.id,
      contact: call.contactName,
      date: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(call.createdAt || call.timestamp)),
      consentStatus: "not_integrated",
      method: "Not integrated",
      recording: hasRecording,
    };
  });
}

export function CallComplianceStats({
  calls = [],
}: {
  calls?: CallLogRecord[];
}) {
  const consentRecords = buildConsentRecords(calls);
  const total = consentRecords.length;
  const recorded = consentRecords.filter((r) => r.recording).length;
  const recordingRate = total > 0 ? Math.round((recorded / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Consent Rate"
        value="Not integrated"
        icon={Shield}
        color="amber"
      />
      <StatCard
        label="Calls Recorded"
        value={String(recorded)}
        icon={Headphones}
        color="teal"
      />
      <StatCard
        label="Without Recording"
        value={String(Math.max(total - recorded, 0))}
        icon={AlertTriangle}
        color="amber"
      />
      <StatCard
        label="Recording Coverage"
        value={total > 0 ? `${recordingRate}%` : "—"}
        icon={CheckCircle}
        color="green"
      />
    </div>
  );
}

export function CallComplianceAlert({ calls = [] }: { calls?: CallLogRecord[] }) {
  const consentRecords = buildConsentRecords(calls);

  return (
    <AlertBanner
      icon={Info}
      title="Call consent tracking is not integrated yet"
      description={`The backend currently returns ${consentRecords.length} live call record${consentRecords.length === 1 ? "" : "s"} and recording URLs, but it does not expose per-call consent capture, consent method, consent timestamp, retention deadline, or deletion workflow fields.`}
      variant="info"
    />
  );
}

export function CallConsentLog({ calls = [] }: { calls?: CallLogRecord[] }) {
  const consentRecords = buildConsentRecords(calls);

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
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">
                Contact
              </th>
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">
                Date
              </th>
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">
                Consent
              </th>
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">
                Method
              </th>
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">
                Recording
              </th>
            </tr>
          </thead>
          <tbody>
            {consentRecords.map((record) => (
              <tr
                key={record.id}
                className="border-b border-white/5 hover:bg-white/5"
              >
                <td className="px-5 py-4 font-medium text-sm">
                  {record.contact}
                </td>
                <td className="px-5 py-4 text-sm text-gray-400">
                  {record.date}
                </td>
                <td className="px-5 py-4">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 flex items-center gap-1 w-fit">
                    <AlertTriangle className="w-3 h-3" /> Not integrated
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-gray-400">
                  {record.method}
                </td>
                <td className="px-5 py-4">
                  {record.recording ? (
                    <Headphones className="w-4 h-4 text-teal-400" />
                  ) : (
                    <span className="text-xs text-gray-600">—</span>
                  )}
                </td>
              </tr>
            ))}
            {consentRecords.length === 0 && (
              <tr>
                <td className="px-5 py-8 text-sm text-gray-400" colSpan={5}>
                  No call consent records loaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function CallCompliancePolicies({
  settings,
}: {
  settings?: ComplianceSettingsRecord | null;
}) {
  const policies = [
    {
      label: "Data retention period",
      value: settings?.retentionPeriod ?? "Backend default",
      status: Boolean(settings),
    },
    {
      label: "Consent tracking setting",
      value:
        settings?.toggles?.consentTracking === undefined
          ? "Not loaded"
          : settings.toggles.consentTracking
            ? "Enabled"
            : "Disabled",
      status: settings?.toggles?.consentTracking === true,
    },
    {
      label: "Call-level consent capture",
      value: "Not integrated",
      status: false,
    },
    {
      label: "Recording deletion workflow",
      value: "Not integrated",
      status: false,
    },
  ];

  return (
    <Card>
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-violet-400" /> Compliance Policies
      </h3>
      <div className="space-y-3">
        {policies.map((policy) => (
          <div
            key={policy.label}
            className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
          >
            <span className="text-sm text-gray-300">{policy.label}</span>
            {policy.status ? (
              <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-right">
                {policy.value}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-right">
                {policy.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
