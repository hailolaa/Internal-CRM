import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultPipelineStages,
  legacyPipelineStageAliases,
} from "../modules/pipeline/pipeline.constants.js";

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
