import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultPipelineStages,
  legacyPipelineStageAliases,
} from "../modules/pipeline/pipeline.constants.js";
import {
  getSalesProcessPolicy,
  salesProcessPolicyVersion,
} from "../modules/pipeline/pipeline.sales-process-rules.js";

const expectedStageNames = [
  "New Lead",
  "Contact Needed",
  "Contact Attempted",
  "Spoken To",
  "Free Audit Needed",
  "Free Audit In Progress",
  "Audit Complete",
  "Dashboard Access Given",
  "Proposal Needed",
  "Proposal Sent",
  "Follow-up Needed",
  "Negotiation",
  "Won",
  "Lost",
  "Nurture",
  "Future Opportunity",
];

test("default internal sales stages match the required order and terminal kinds", () => {
  assert.deepEqual(defaultPipelineStages.map((stage) => stage.name), expectedStageNames);
  assert.deepEqual(
    defaultPipelineStages.map((stage) => stage.position),
    expectedStageNames.map((_, index) => index + 1),
  );
  assert.equal(defaultPipelineStages.find((stage) => stage.name === "Won")?.kind, "won");
  assert.equal(defaultPipelineStages.find((stage) => stage.name === "Lost")?.kind, "lost");
});

test("legacy default stages map to canonical internal sales stages", () => {
  assert.equal(legacyPipelineStageAliases["New Lead"]?.includes("New Enquiry"), true);
  assert.equal(legacyPipelineStageAliases["Contact Attempted"]?.includes("Contacted"), true);
  assert.equal(legacyPipelineStageAliases["Won"]?.includes("Sold"), true);
});

test("sales process policy exposes the currently enforced commercial gates", () => {
  const policy = getSalesProcessPolicy();
  assert.equal(policy.version, salesProcessPolicyVersion);
  assert.equal(policy.statusIsNotEvidence, true);
  assert.equal(policy.maxDecisionRequired, true);
  assert.deepEqual(policy.revenueCriticalTransitions, ["won", "lost"]);
  assert.ok(
    policy.rules.some((rule) =>
      rule.stage === "Won"
      && rule.enforcedRequirements.includes("human commercial confirmation")
      && rule.enforcedRequirements.includes("final value greater than zero")
      && rule.enforcedRequirements.includes("package or service recorded"),
    ),
  );
  assert.ok(
    policy.rules.some((rule) =>
      rule.stage === "Lost"
      && rule.enforcedRequirements.includes("lost reason recorded")
      && rule.enforcedRequirements.includes("objection type recorded"),
    ),
  );
  assert.match(policy.externalApprovalGate, /Max must approve/);
});
