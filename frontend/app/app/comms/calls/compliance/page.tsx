"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Shield } from "lucide-react";
import {
  AlertBanner,
  CardSkeleton,
  PageHeader,
  StatCardSkeleton,
  TableSkeleton,
} from "@/components/ui";
import {
  CallComplianceStats,
  CallComplianceAlert,
  CallConsentLog,
  CallCompliancePolicies,
} from "@/components/calls/call-compliance-live";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  CallLogRecord,
  CallUpdatePayload,
  ComplianceSettingsRecord,
  RecordingDeletionRequestRecord,
} from "@/lib/api-types";

export default function CallCompliancePage() {
  const { session } = useAuth();
  const [calls, setCalls] = useState<CallLogRecord[]>([]);
  const [settings, setSettings] = useState<ComplianceSettingsRecord | null>(null);
  const [loadedToken, setLoadedToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [mutatingCallId, setMutatingCallId] = useState<string | null>(null);
  const isLoading = Boolean(session?.token && loadedToken !== session.token);

  useEffect(() => {
    if (!session?.token) return;

    let isMounted = true;
    Promise.all([
      api.calls.list(session.token),
      api.compliance.getSettings(session.token),
    ])
      .then(([callRecords, complianceSettings]) => {
        if (!isMounted) return;
        setCalls(callRecords);
        setSettings(complianceSettings);
        setError("");
      })
      .catch((err) => {
        if (!isMounted) return;
        setCalls([]);
        setSettings(null);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load call compliance records.",
        );
      })
      .finally(() => {
        if (isMounted) setLoadedToken(session.token);
      });

    return () => {
      isMounted = false;
    };
  }, [session?.token]);

  const replaceCall = (updatedCall: CallLogRecord) => {
    setCalls((currentCalls) =>
      currentCalls.map((call) => (call.id === updatedCall.id ? updatedCall : call)),
    );
  };

  const updateCallCompliance = async (
    call: CallLogRecord,
    payload: CallUpdatePayload,
  ) => {
    if (!session?.token) return;

    setMutatingCallId(call.id);
    setError("");
    setActionMessage("");

    try {
      const updatedCall = await api.calls.update(session.token, call.id, payload);
      replaceCall(updatedCall);
      setActionMessage("Call compliance fields saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update call compliance fields.",
      );
    } finally {
      setMutatingCallId(null);
    }
  };

  const requestRecordingDeletion = async (call: CallLogRecord) => {
    if (!session?.token) return;

    const reason =
      window.prompt("Reason for recording deletion request", "Retention review") ||
      "Retention review";

    setMutatingCallId(call.id);
    setError("");
    setActionMessage("");

    try {
      const request = await api.calls.createRecordingDeletionRequest(
        session.token,
        call.id,
        { reason },
      );
      replaceCall({ ...call, recordingDeletionRequest: request });
      setActionMessage("Recording deletion request created.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create recording deletion request.",
      );
    } finally {
      setMutatingCallId(null);
    }
  };

  const updateRecordingDeletionRequest = async (
    call: CallLogRecord,
    status: RecordingDeletionRequestRecord["status"],
  ) => {
    if (!session?.token || !call.recordingDeletionRequest) return;

    setMutatingCallId(call.id);
    setError("");
    setActionMessage("");

    try {
      await api.calls.updateRecordingDeletionRequest(
        session.token,
        call.recordingDeletionRequest.id,
        { status },
      );
      const refreshedCall = await api.calls.get(session.token, call.id);
      replaceCall(refreshedCall);
      setActionMessage("Recording deletion workflow updated.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update recording deletion workflow.",
      );
    } finally {
      setMutatingCallId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Call Compliance"
        subtitle="Recording consent tracking, policies, and audit log."
        icon={Shield}
        iconColor="text-[#6E6AE8]"
        iconBg="bg-[rgba(110,106,232,0.08)]"
      />

      {error && (
        <AlertBanner
          icon={AlertTriangle}
          title="Call compliance records could not be loaded"
          description={error}
          variant="warning"
        />
      )}

      {actionMessage && (
        <AlertBanner
          icon={CheckCircle}
          title="Call compliance updated"
          description={actionMessage}
          variant="success"
        />
      )}

      {isLoading ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <TableSkeleton rows={5} columns={5} />
            </div>
            <CardSkeleton lines={5} />
          </div>
        </>
      ) : (
        <>
          <CallComplianceAlert calls={calls} />
          <CallComplianceStats calls={calls} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <CallConsentLog
                calls={calls}
                isMutating={Boolean(mutatingCallId)}
                onUpdateCall={updateCallCompliance}
                onRequestDeletion={requestRecordingDeletion}
                onUpdateDeletionRequest={updateRecordingDeletionRequest}
              />
            </div>
            <div>
              <CallCompliancePolicies settings={settings} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
