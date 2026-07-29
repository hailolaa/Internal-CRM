#!/usr/bin/env node

const checks = [
  ["Lead creation and edit", "Create/edit a manual lead with contact method, source, website, location and package interest."],
  ["Website lead entry", "Submit website lead payloads with UTM, CTA, consent and package mapping."],
  ["Free guide lead flow", "Confirm guide name/date, dedupe update and Clinic Growth Score next action."],
  ["Duplicate handling", "Verify strong matches update and possible matches go to review."],
  ["Pipeline moves", "Move opportunities through active, Won and Lost stages with reasons/audit history."],
  ["Notes/tasks/follow-ups", "Add notes, create/assign/complete/reopen tasks and check due/overdue views."],
  ["Growth Score/audit flow", "Store Growth Score categories, snapshots and audit statuses."],
  ["Proposal workflow", "Create, preview, share, send/log, follow up, accept/win/loss proposals."],
  ["Client conversion/onboarding/files", "Convert Won to client, verify history, onboarding checklist, files and missing access."],
  ["Permissions/security", "Check internal roles, blocked external signup/access and internal-only notes/audit logs."],
  ["Desktop usability", "Verify dashboard, tables, forms, subnavs and detail views at desktop width."],
  ["Mobile usability", "Verify lead/client/task/proposal flows without horizontal overflow on mobile."],
];

console.log("MC-055 Mission Control Phase-One MVP QA");
console.log("======================================");
console.log("");
console.log("Checklist: docs/mc-055-phase-one-mvp-qa.md");
console.log("");
console.log("Preflight commands:");
console.log("- Backend: npm run build");
console.log("- Backend targeted tests: node --test --test-force-exit --test-concurrency=1 <MVP test files>");
console.log("- Frontend: npm run typecheck && npm run lint && npm run test && npm run build");
console.log("");
console.log("Required QA checks:");

for (const [area, scenario] of checks) {
  console.log(`- [ ] ${area}: ${scenario}`);
}

console.log("");
console.log("Release gate:");
console.log("- [ ] Critical MVP flows pass on desktop.");
console.log("- [ ] Mobile is usable for lead, client, task and proposal flows.");
console.log("- [ ] Permission checks prove internal-only access.");
console.log("- [ ] Integration fallbacks are labelled clearly.");
console.log("- [ ] Known gaps are assigned to Trello cards.");
