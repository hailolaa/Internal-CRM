#!/usr/bin/env node

const scenarios = [
  ["Auth", "Login, refresh authenticated session, and logout."],
  ["Tenant switching", "Switch primary clinic to Harbour and back; confirm scoped data reloads."],
  ["Revenue dashboard", "Check KPI cards, executive summary, monthly trend, opportunities and risks."],
  ["Leakage", "Open leakage summary/detail and verify linked source records."],
  ["Insights/action plans", "Generate or refresh insights and verify monthly action plan context."],
  ["Leads", "Search/filter inbox, open detail drawer, run major drawer actions, move stages."],
  ["Calls", "Open calls/missed-call workflow and update a call outcome."],
  ["Reports", "Open reporting centre and monthly report detail."],
  ["Treatment detail", "Open treatment performance detail where present and verify record links."],
  ["Internal ops", "Check client accounts, services, internal tasks, QA, strategy logs and SOPs."],
  ["Settings/integrations", "Check connector health, sync state, missing permissions and manual fallback."],
  ["Command palette", "Open by keyboard and mobile button; verify actions and clinic switching."],
  ["Permissions", "Confirm restricted users cannot see internal/admin-only actions."]
];

console.log("Phase 1 Browser QA Pack");
console.log("=======================");
console.log("");
console.log("Full checklist: docs/phase1-browser-qa.md");
console.log("");
console.log("Required browsers/viewports:");
console.log("- Desktop: 1440x900");
console.log("- Mobile: 390x844");
console.log("");
console.log("Automation split:");
console.log("- This backend repo provides documented manual browser QA plus this repeatable checklist runner.");
console.log("- Add Playwright specs in the frontend repo when its browser test harness is available.");
console.log("");
console.log("Pre-release commands:");
console.log("- Backend: npm run build && npm run qa:phase1");
console.log("- Frontend repo: npm run typecheck && npm run build");
console.log("");
console.log("Required clinics:");
console.log("- Seeded primary clinic");
console.log("- Harbour clinic");
console.log("");
console.log("Critical scenarios:");

for (const [area, scenario] of scenarios) {
  console.log(`- [ ] ${area}: ${scenario}`);
}

console.log("");
console.log("Release gate:");
console.log("- [ ] Tenant switching checked both directions.");
console.log("- [ ] Seeded, empty, loading and error states checked where supported.");
console.log("- [ ] Screenshots captured for failures and high-risk workflows.");
console.log("- [ ] Frontend typecheck/build completed for user-facing changes.");
console.log("- [ ] Known gaps recorded in docs/phase1-browser-qa.md or the release ticket.");
