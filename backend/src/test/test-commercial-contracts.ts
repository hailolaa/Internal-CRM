import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import pool, { testConnection } from "../config/database.js";
import { commercialContractsService } from "../modules/commercial-contracts/commercial-contracts.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("commercial contract routes expose the lifecycle behind client account permissions", () => {
  const app = read("src/app.ts");
  const routes = read("src/modules/commercial-contracts/commercial-contracts.routes.ts");

  assert.match(app, /commercialContractsRoutes/);
  assert.match(app, /\/api\/commercial-contracts/);
  assert.match(routes, /authorizePermission\("client_accounts:read"\)/);
  assert.match(routes, /authorizePermission\("client_accounts:write"\)/);
  assert.match(routes, /\/:id\/status/);
  assert.match(routes, /\/:id\/change-orders/);
  assert.match(routes, /\/alerts\/notice/);
  assert.match(routes, /\/renewals/);
});

test("commercial contracts enforce lifecycle transitions", async () => {
  await testConnection();
  const clinic = await createTestClinicAndAdmin("contract-states");
  const contract = await commercialContractsService.createContract({
    clinicId: clinic.clinicId,
    contractKey: "contract-states-001",
    startDate: "2026-08-01",
    renewalDate: "2026-10-01",
    noticePeriodDays: 30,
    terms: { package: "Clinic Growth Engine" },
    createdBy: "Haile Michael",
  });

  await assert.rejects(
    () => commercialContractsService.transitionContract(clinic.clinicId, contract.id, "ended"),
    /cannot move/,
  );
  const sent = await commercialContractsService.transitionContract(clinic.clinicId, contract.id, "sent");
  const active = await commercialContractsService.transitionContract(clinic.clinicId, contract.id, "active");
  const notice = await commercialContractsService.transitionContract(clinic.clinicId, contract.id, "notice_given");
  const ended = await commercialContractsService.transitionContract(clinic.clinicId, contract.id, "ended");

  assert.equal(sent.status, "sent");
  assert.equal(active.status, "active");
  assert.equal(notice.status, "notice_given");
  assert.equal(ended.status, "ended");
});

test("change orders create versioned contract records", async () => {
  const clinic = await createTestClinicAndAdmin("contract-change-order");
  const contract = await commercialContractsService.createContract({
    clinicId: clinic.clinicId,
    contractKey: "change-order-001",
    startDate: "2026-08-01",
    renewalDate: "2026-12-01",
    noticePeriodDays: 45,
    terms: { monthlyFee: 2495 },
    createdBy: "Haile Michael",
  });
  await commercialContractsService.transitionContract(clinic.clinicId, contract.id, "sent");
  await commercialContractsService.transitionContract(clinic.clinicId, contract.id, "active");

  const changeOrder = await commercialContractsService.createChangeOrder({
    clinicId: clinic.clinicId,
    contractId: contract.id,
    summary: "Add conversion tracking implementation.",
    effectiveDate: "2026-09-01",
    terms: { monthlyFee: 2995, addedScope: "conversion tracking" },
    createdBy: "Haile Michael",
  });
  const [rows]: any = await pool.execute(
    `SELECT version, status, change_type as changeType FROM commercial_contract_version WHERE contract_id = ? ORDER BY version ASC`,
    [contract.id],
  );

  assert.equal(changeOrder.version, 2);
  assert.equal(changeOrder.changeType, "change_order");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].status, "superseded");
  assert.equal(rows[1].status, "approved");
});

test("notice alerts and renewal versions are generated from renewal dates", async () => {
  const clinic = await createTestClinicAndAdmin("contract-renewal");
  const contract = await commercialContractsService.createContract({
    clinicId: clinic.clinicId,
    contractKey: "renewal-001",
    startDate: "2026-08-01",
    renewalDate: "2026-08-30",
    noticePeriodDays: 15,
    terms: { monthlyFee: 2495 },
    createdBy: "Haile Michael",
  });
  await commercialContractsService.transitionContract(clinic.clinicId, contract.id, "sent");
  await commercialContractsService.transitionContract(clinic.clinicId, contract.id, "active");

  const alerts = await commercialContractsService.createNoticeAlerts({ clinicId: clinic.clinicId, untilDate: "2026-08-20" });
  const renewals = await commercialContractsService.generateRenewals({ clinicId: clinic.clinicId, untilDate: "2026-08-31", createdBy: "Haile Michael" });
  const [contractRows]: any = await pool.execute(
    `SELECT status, current_version as currentVersion FROM commercial_contract WHERE id = ?`,
    [contract.id],
  );
  const [alertRows]: any = await pool.execute(
    `SELECT alert_type as alertType, status FROM commercial_contract_alert WHERE contract_id = ? ORDER BY alert_type`,
    [contract.id],
  );

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.alertType, "notice_due");
  assert.equal(renewals.length, 1);
  assert.equal(renewals[0]!.changeType, "renewal");
  assert.equal(contractRows[0].status, "renewal_pending");
  assert.equal(Number(contractRows[0].currentVersion), 2);
  assert.deepEqual(alertRows.map((row: any) => row.alertType), ["notice_due", "renewal_due"]);
});

test("commercial contract lists remain tenant scoped", async () => {
  const primary = await createTestClinicAndAdmin("contract-list-primary");
  const other = await createTestClinicAndAdmin("contract-list-other");
  const contract = await commercialContractsService.createContract({
    clinicId: primary.clinicId,
    contractKey: "tenant-list-primary",
    startDate: "2026-08-01",
    renewalDate: "2026-09-01",
    noticePeriodDays: 14,
    terms: { package: "Market Leader" },
    createdBy: "Haile Michael",
  });
  await commercialContractsService.createContract({
    clinicId: other.clinicId,
    contractKey: "tenant-list-other",
    startDate: "2026-08-01",
    renewalDate: "2026-09-01",
    noticePeriodDays: 14,
    terms: { package: "Market Leader" },
    createdBy: "Haile Michael",
  });

  const contracts = await commercialContractsService.listContracts(primary.clinicId);
  const filtered = await commercialContractsService.listContracts(primary.clinicId, { status: "draft" });
  await commercialContractsService.transitionContract(primary.clinicId, contract.id, "sent");
  await commercialContractsService.transitionContract(primary.clinicId, contract.id, "active");
  await commercialContractsService.createNoticeAlerts({ clinicId: primary.clinicId, untilDate: "2026-08-20" });
  const alerts = await commercialContractsService.listAlerts(primary.clinicId, { status: "open" });

  assert.ok(contracts.some((item) => item.contractKey === "tenant-list-primary"));
  assert.equal(contracts.some((item) => item.contractKey === "tenant-list-other"), false);
  assert.ok(filtered.every((item) => item.status === "draft"));
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.contractId, contract.id);
});
