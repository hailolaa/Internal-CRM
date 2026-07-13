import assert from "node:assert/strict";
import test from "node:test";
import { mapPipelineDeal } from "../modules/pipeline/pipeline.mappers.js";

test("pipeline deal mapper exposes Kanban follow-up context", () => {
  const deal = mapPipelineDeal({
    id: "deal-1",
    pipelineId: "pipeline-1",
    stageId: "stage-1",
    stageName: "Contact Needed",
    stageKind: "open",
    title: "Example opportunity",
    value: 2500,
    probability: 25,
    expectedCloseDate: "2026-07-30",
    ownerId: "user-1",
    ownerName: "Alex Owner",
    nextFollowUpDate: "2026-07-14",
    priority: "high",
    contactId: "contact-1",
    contactFirstName: "Jamie",
    contactLastName: "Lead",
    contactEmail: "jamie@example.com",
    contactPhone: "07000000000",
    contactSource: "Referral",
    source: "Referral",
    treatment: "Growth Package",
    status: "open",
    daysInStage: 2,
    stageChangedAt: "2026-07-12T10:00:00.000Z",
    createdAt: "2026-07-11T10:00:00.000Z",
    updatedAt: "2026-07-12T10:00:00.000Z",
  });

  assert.equal(deal.ownerName, "Alex Owner");
  assert.equal(deal.nextFollowUpDate, "2026-07-14");
  assert.equal(deal.priority, "high");
});
