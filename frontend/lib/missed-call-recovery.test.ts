import { describe, expect, it } from "vitest";
import type { MissedCallRecoveryRecord } from "@/lib/api-types";
import {
  groupMissedCallRecoveries,
  isMissedCallRecoveryTerminal,
  missedCallRecoveryTransitions,
} from "./missed-call-recovery";

function recovery(
  id: string,
  overrides: Partial<MissedCallRecoveryRecord>,
): MissedCallRecoveryRecord {
  return {
    id,
    clinicId: "clinic-001",
    clientAccountProfileId: "profile-001",
    clientClinicId: "client-clinic-001",
    clientName: "Test Clinic",
    contactId: `contact-${id}`,
    contactName: "Patient",
    contactPhone: "07700900000",
    taskId: `task-${id}`,
    ownerUserId: null,
    ownerLabel: "Missed Call Recovery queue",
    state: "attempted",
    slaStatus: "due",
    occurredAt: "2026-08-19T09:00:00.000Z",
    recoverySlaTargetAt: "2026-08-19T09:15:00.000Z",
    attemptedAt: "2026-08-19T09:00:00.000Z",
    contactedAt: null,
    bookedAt: null,
    closedNoResponseAt: null,
    completedWithinSla: null,
    missedCallState: "no_answer",
    voicemailState: null,
    source: "ClinicGrower",
    trackingNumber: "+442000000000",
    providerCallSid: `CA${id}`,
    clinicGrowerCallId: `call-${id}`,
    acknowledgementStatus: "sent",
    createdAt: "2026-08-19T09:00:00.000Z",
    updatedAt: "2026-08-19T09:00:00.000Z",
    ...overrides,
  };
}

describe("missed-call recovery queue helpers", () => {
  it("groups overdue, voicemail, contacted, booked and closed recovery rows", () => {
    const groups = groupMissedCallRecoveries([
      recovery("1", { slaStatus: "due_soon" }),
      recovery("2", { slaStatus: "overdue" }),
      recovery("3", { state: "contacted" }),
      recovery("4", { state: "booked", slaStatus: "completed_within_sla", completedWithinSla: true }),
      recovery("5", { state: "closed_no_response", slaStatus: "completed_after_sla", completedWithinSla: false }),
      recovery("6", { missedCallState: "voicemail", voicemailState: "recorded" }),
    ]);

    expect(groups.pending.map((item) => item.id)).toEqual(["1", "6"]);
    expect(groups.dueSoon.map((item) => item.id)).toEqual(["1"]);
    expect(groups.overdue.map((item) => item.id)).toEqual(["2"]);
    expect(groups.contacted.map((item) => item.id)).toEqual(["3"]);
    expect(groups.booked.map((item) => item.id)).toEqual(["4"]);
    expect(groups.closedNoResponse.map((item) => item.id)).toEqual(["5"]);
    expect(groups.voicemail.map((item) => item.id)).toEqual(["6"]);
  });

  it("does not allow terminal state regression", () => {
    expect(missedCallRecoveryTransitions.attempted).toEqual(["contacted", "booked", "closed_no_response"]);
    expect(missedCallRecoveryTransitions.contacted).toEqual(["booked", "closed_no_response"]);
    expect(missedCallRecoveryTransitions.booked).toEqual([]);
    expect(missedCallRecoveryTransitions.closed_no_response).toEqual([]);
    expect(isMissedCallRecoveryTerminal("booked")).toBe(true);
    expect(isMissedCallRecoveryTerminal("attempted")).toBe(false);
  });
});
