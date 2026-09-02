import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const crosswalk = readFileSync(
  new URL("../docs/delivery-management-requirement-crosswalk.md", import.meta.url),
  "utf8",
);

const governedTaskIds = ["869egeh5q", "869egfgtp", "869egfgu7", "869egfguf"];
const retainedLegacyRequirements = [
  "Per-client active workstreams",
  "Owner per workstream",
  "Tasks, milestones, deadlines and status",
  "Evidence per deliverable",
  "Claimed complete vs verified complete",
  "QA and approval workflow",
  "Blockers and overdue highlighting",
  "Dependencies between deliverables",
  "Client-health roll-up",
  "Exportable delivery summary",
];

function extractMappingRows() {
  const retainedMapping = crosswalk
    .split("## Retained Requirement Mapping")[1]
    .split("## Data Gaps")[0];

  return retainedMapping
    .split(/\r?\n/)
    .filter((line) => line.startsWith("| "))
    .filter((line) => !line.includes("---"))
    .slice(1)
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    );
}

test("delivery-management crosswalk lists every governed replacement task", () => {
  for (const taskId of governedTaskIds) {
    assert.match(crosswalk, new RegExp(`- \`${taskId}\``), `${taskId} must be listed as governed`);
  }

  assert.match(crosswalk, /Legacy task `869efyxy5` is not an ongoing governed owner/);
  assert.match(crosswalk, /closed only after this mapping is accepted by Max \/ Operations/);
});

test("every retained legacy requirement has an active governed replacement", () => {
  const rows = extractMappingRows();
  const requirements = rows.map(([legacyRequirement]) => legacyRequirement);

  assert.equal(rows.length, retainedLegacyRequirements.length);
  assert.deepEqual(requirements, retainedLegacyRequirements);
  assert.equal(new Set(requirements).size, requirements.length, "legacy requirements must not be duplicated");

  for (const row of rows) {
    const [legacyRequirement, retainedRequirement, governedTask, implementation, evidence, ownerBoundary, state] = row;

    assert.ok(retainedRequirement, `${legacyRequirement} must have a retained requirement`);
    assert.ok(implementation, `${legacyRequirement} must have an implementation or evidence location`);
    assert.ok(evidence, `${legacyRequirement} must name evidence`);
    assert.ok(ownerBoundary, `${legacyRequirement} must define ownership/boundary`);
    assert.ok(state, `${legacyRequirement} must define acceptance state`);
    assert.ok(
      governedTaskIds.some((taskId) => governedTask.includes(taskId)),
      `${legacyRequirement} must map to an active governed task`,
    );
    assert.doesNotMatch(
      governedTask,
      /869efyxy5/,
      `${legacyRequirement} must not use the legacy wrapper as governed authority`,
    );
  }
});

test("system ownership and closure gates are explicit", () => {
  assert.match(crosswalk, /Client delivery execution remains in the client delivery locations/);
  assert.match(crosswalk, /Mission Control owns the governed roll-up/);
  assert.match(crosswalk, /ClickUp owns task governance/);
  assert.match(crosswalk, /Status alone is not completion evidence/);
  assert.match(crosswalk, /Michael Hodgson provides business definitions, legacy context and UAT/);
  assert.match(crosswalk, /not the sole owner of the resulting\s+requirement or release decision/);
  assert.match(crosswalk, /Operations Manager \/ reviewer must accept this mapping before closing the legacy wrapper/);
});

test("Friday review and no-expansion controls are represented", () => {
  for (const expected of [
    "What changed",
    "Evidence",
    "Blockers and owners",
    "One next bounded milestone",
    "Max decision required",
  ]) {
    assert.match(crosswalk, new RegExp(expected));
  }

  assert.match(crosswalk, /does not authorize production release/);
  assert.match(crosswalk, /provider activation/);
  assert.match(crosswalk, /permission widening/);
  assert.match(crosswalk, /scope expansion/);
  assert.match(crosswalk, /No new DATA GAP is recorded from this crosswalk/);
});
