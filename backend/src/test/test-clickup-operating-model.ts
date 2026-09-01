import assert from "node:assert/strict";
import test from "node:test";
import {
  CLICKUP_TASK_DUPLICATE_RULES,
  CLICKUP_TASK_FIELD_SOURCE_RULES,
  CLICKUP_TASK_OPERATING_MODEL_VERSION,
  clickUpTaskOperatingModel,
} from "../modules/clickup/clickup-operating-model.js";

const requiredFields = [
  "missionControlTaskId",
  "clickupTaskId",
  "clientAccountProfileId",
  "deliveryWorkspaceList",
  "title",
  "description",
  "status",
  "priority",
  "dueDate",
  "assignee",
  "workstreamCategory",
  "dependenciesAndBlockers",
  "evidenceAndAttachments",
  "reviewerAcceptance",
  "commentsAndActivity",
];

test("ClickUp task operating model has one source-of-truth rule for every governed task field", () => {
  const rulesByField = new Map(CLICKUP_TASK_FIELD_SOURCE_RULES.map((rule) => [rule.field, rule]));

  assert.equal(CLICKUP_TASK_OPERATING_MODEL_VERSION, "cg-024-2026-09-01");
  assert.equal(rulesByField.size, CLICKUP_TASK_FIELD_SOURCE_RULES.length);

  for (const field of requiredFields) {
    const rule = rulesByField.get(field);
    assert.ok(rule, `missing source-of-truth rule for ${field}`);
    assert.ok(rule.sourceOfTruth, `${field} must name a source of truth`);
    assert.ok(rule.syncedTo.length > 0, `${field} must define sync visibility`);
    assert.ok(rule.editableIn.length > 0, `${field} must define where edits are allowed`);
    assert.ok(rule.conflictResolution.length > 20, `${field} must document conflict handling`);
    assert.equal(rule.silentOverwriteAllowed, false, `${field} must prohibit silent overwrites`);
  }
});

test("ClickUp operating model explicitly prevents duplicate task work", () => {
  const identities = CLICKUP_TASK_DUPLICATE_RULES.map((rule) => rule.identity);

  assert.deepEqual(identities, [
    "internalTaskId",
    "clickupTaskId",
    "providerEventKey",
    "clientAccountProfileId + workspace/list/rootTask",
  ]);

  for (const rule of CLICKUP_TASK_DUPLICATE_RULES) {
    assert.match(rule.preventionRule, /One|Duplicate|rejected/i);
    assert.match(rule.recoveryRule, /reuse|recover|existing|needs_review|rejected/i);
  }
});

test("ClickUp operating model export is stable for documentation and API evidence", () => {
  const model = clickUpTaskOperatingModel();

  assert.equal(model.version, CLICKUP_TASK_OPERATING_MODEL_VERSION);
  assert.equal(model.sourceRules, CLICKUP_TASK_FIELD_SOURCE_RULES);
  assert.equal(model.duplicateRules, CLICKUP_TASK_DUPLICATE_RULES);
});
