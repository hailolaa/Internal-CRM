import assert from "node:assert/strict";
import test from "node:test";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { clickUpService } from "../modules/clickup/clickup.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

test("accepted proposal stages one ClickUp delivery provision with CRM back-links", async () => {
  await testConnection();
  const workspace = await createTestClinicAndAdmin("clickup-delivery-provision");
  const profileId = uuidv4();
  const proposalId = uuidv4();
  const eventId = uuidv4();
  const idempotencyKey = `proposal_accepted:${proposalId}:snapshot-1`;
  await pool.execute(
    "INSERT INTO client_account_profile (id, clinic_id, active_services) VALUES (?, ?, JSON_ARRAY('Clinic Growth'))",
    [profileId, workspace.clinicId],
  );
  const input = {
    clinicId: workspace.clinicId,
    clientAccountProfileId: profileId,
    proposalId,
    eventId,
    idempotencyKey,
    payload: {
      packageId: "clinic-growth",
      packageName: "Clinic Growth",
      proposedStartDate: "2026-09-01",
      proposalUrl: "https://mission-control.test/proposals/example",
      contactId: uuidv4(),
      dealId: uuidv4(),
    },
  };

  const first = await (clickUpService as any).stageDeliveryProvision(input);
  const repeated = await (clickUpService as any).stageDeliveryProvision(input);
  const [rows]: any = await pool.execute(
    `SELECT id, status, proposal_id as proposalId, event_id as eventId,
            client_account_profile_id as clientAccountProfileId, payload
     FROM clickup_delivery_provision
     WHERE clinic_id = ? AND idempotency_key = ?`,
    [workspace.clinicId, idempotencyKey],
  );

  assert.equal(first.id, repeated.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].proposalId, proposalId);
  assert.equal(rows[0].eventId, eventId);
  assert.equal(rows[0].clientAccountProfileId, profileId);
  const payload = typeof rows[0].payload === "string" ? JSON.parse(rows[0].payload) : rows[0].payload;
  assert.equal(payload.packageName, "Clinic Growth");
  assert.equal(payload.proposalUrl, "https://mission-control.test/proposals/example");
});

test("client delivery summary returns the latest tenant-scoped provision checkpoints", async () => {
  const workspace = await createTestClinicAndAdmin("clickup-client-delivery-summary");
  const profileId = uuidv4();
  await pool.execute(
    "INSERT INTO client_account_profile (id, clinic_id, active_services) VALUES (?, ?, JSON_ARRAY('Clinic Growth'))",
    [profileId, workspace.clinicId],
  );
  const older = await (clickUpService as any).stageDeliveryProvision({
    clinicId: workspace.clinicId,
    clientAccountProfileId: profileId,
    proposalId: uuidv4(),
    eventId: uuidv4(),
    idempotencyKey: `proposal_accepted:${uuidv4()}:older`,
    payload: { packageName: "Older package" },
  });
  await pool.execute(
    "UPDATE clickup_delivery_provision SET created_at = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY) WHERE id = ?",
    [older.id],
  );
  const latest = await (clickUpService as any).stageDeliveryProvision({
    clinicId: workspace.clinicId,
    clientAccountProfileId: profileId,
    proposalId: uuidv4(),
    eventId: uuidv4(),
    idempotencyKey: `proposal_accepted:${uuidv4()}:latest`,
    payload: { packageName: "Current package" },
  });
  await pool.execute(
    `UPDATE clickup_delivery_provision
     SET status = 'processed', clickup_folder_id = 'folder-current',
         clickup_list_id = 'list-current', delivery_url = 'https://app.clickup.com/t/root-current'
     WHERE id = ?`,
    [latest.id],
  );

  const summary = await clickUpService.getClientDeliveryProvision(workspace.clinicId, profileId);
  assert.equal(summary.id, latest.id);
  assert.equal(summary.status, "processed");
  assert.equal(summary.payload.packageName, "Current package");
  assert.equal(summary.clickUpFolderId, "folder-current");
  assert.equal(summary.clickUpListId, "list-current");
  assert.equal(summary.deliveryUrl, "https://app.clickup.com/t/root-current");
  assert.equal(summary.retryState, null);
});

test("ClickUp delivery provisioning resumes from saved folder checkpoints without duplicates", async () => {
  const workspace = await createTestClinicAndAdmin("clickup-delivery-process");
  const profileId = uuidv4();
  const connectionId = uuidv4();
  await pool.execute(
    "INSERT INTO client_account_profile (id, clinic_id, active_services) VALUES (?, ?, JSON_ARRAY('Clinic Growth'))",
    [profileId, workspace.clinicId],
  );
  await pool.execute(
    `INSERT INTO clickup_connection
      (id, clinic_id, workspace_id, workspace_name, status, connected_by, connected_at)
     VALUES (?, ?, 'cu-workspace-delivery', 'Delivery Workspace', 'connected', ?, CURRENT_TIMESTAMP)`,
    [connectionId, workspace.clinicId, workspace.userId],
  );
  await pool.execute(
    `INSERT INTO clickup_client_mapping
      (id, clinic_id, client_account_profile_id, connection_id, workspace_id, space_id,
       mapping_status, mapping_source, created_by, updated_by)
     VALUES (?, ?, ?, ?, 'cu-workspace-delivery', 'cu-space-delivery', 'active', 'manual', ?, ?)`,
    [uuidv4(), workspace.clinicId, profileId, connectionId, workspace.userId, workspace.userId],
  );
  await pool.execute(
    `INSERT INTO clickup_category_mapping
      (id, clinic_id, client_account_profile_id, connection_id, workspace_id, space_id,
       category_key, list_id, default_assignee_ids, mapping_status, mapping_source, created_by, updated_by)
     VALUES (?, ?, ?, ?, 'cu-workspace-delivery', 'cu-space-delivery',
       'seo', 'cu-template-list', JSON_ARRAY('101'), 'active', 'manual', ?, ?)`,
    [uuidv4(), workspace.clinicId, profileId, connectionId, workspace.userId, workspace.userId],
  );
  const internalTaskId = uuidv4();
  await pool.execute(
    `INSERT INTO task
      (id, clinic_id, is_internal, title, description, priority, status, category, board_key,
       service_type, client_account_profile_id, due_date, template_key, qa_checklist, created_by)
     VALUES (?, ?, 1, 'Collect website access', 'CRM backlink task', 'high', 'pending',
       'client_onboarding', 'delivery', 'seo', ?, '2026-09-03',
       'won_client_onboarding:test:website-access', JSON_OBJECT('items', JSON_ARRAY('Request access', 'Verify access')), ?)`,
    [internalTaskId, workspace.clinicId, profileId, workspace.userId],
  );
  const provision = await (clickUpService as any).stageDeliveryProvision({
    clinicId: workspace.clinicId,
    clientAccountProfileId: profileId,
    proposalId: uuidv4(),
    eventId: uuidv4(),
    idempotencyKey: `proposal_accepted:${uuidv4()}:snapshot-1`,
    payload: { packageName: "Clinic Growth", proposedStartDate: "2026-09-01", proposalUrl: "https://mission-control.test/p/1" },
  });
  let folderCalls = 0;
  let listCalls = 0;
  let taskCalls = 0;
  let checklistCalls = 0;
  let checklistItemCalls = 0;
  let failList = true;
  let failVerifyChecklistItem = true;
  const adapter = {
    createFolder: async ({ spaceId, name }: any) => {
      folderCalls += 1;
      assert.equal(spaceId, "cu-space-delivery");
      assert.match(name, /Clinic Growth/);
      return { id: "cu-folder-created" };
    },
    createList: async ({ folderId, name }: any) => {
      listCalls += 1;
      assert.equal(folderId, "cu-folder-created");
      assert.equal(name, "Delivery");
      if (failList) throw new Error("Expected ClickUp list failure");
      return { id: "cu-list-created" };
    },
    createTask: async ({ listId, internalTaskId: sourceTaskId, title, description, parentTaskId, assigneeIds }: any) => {
      taskCalls += 1;
      assert.equal(listId, "cu-list-created");
      if (!sourceTaskId) {
        assert.match(title, /Clinic Growth Delivery/);
        assert.equal(parentTaskId, null);
        return { id: "cu-delivery-root", url: "https://app.clickup.com/t/cu-delivery-root" };
      }
      assert.equal(title, "Collect website access");
      assert.equal(parentTaskId, "cu-delivery-root");
      assert.deepEqual(assigneeIds, ["101"]);
      assert.match(description, new RegExp(internalTaskId));
      return { id: "cu-delivery-task", url: "https://app.clickup.com/t/cu-delivery-task" };
    },
    createChecklist: async ({ taskId, name }: any) => {
      checklistCalls += 1;
      assert.equal(taskId, "cu-delivery-task");
      assert.equal(name, "Delivery checklist");
      return { id: "cu-checklist" };
    },
    createChecklistItem: async ({ checklistId, name }: any) => {
      checklistItemCalls += 1;
      assert.equal(checklistId, "cu-checklist");
      assert.ok(["Request access", "Verify access"].includes(name));
      if (name === "Verify access" && failVerifyChecklistItem) {
        throw new Error("Expected ClickUp checklist item failure");
      }
    },
  };

  await assert.rejects(
    () => (clickUpService as any).processDeliveryProvision(
      { clinicId: workspace.clinicId, provisionId: provision.id, userId: workspace.userId },
      adapter,
    ),
    /Expected ClickUp list failure/,
  );
  failList = false;
  await assert.rejects(
    () => (clickUpService as any).processDeliveryProvision(
      { clinicId: workspace.clinicId, provisionId: provision.id, userId: workspace.userId },
      adapter,
    ),
    /Expected ClickUp checklist item failure/,
  );
  failVerifyChecklistItem = false;
  const processed = await (clickUpService as any).processDeliveryProvision(
    { clinicId: workspace.clinicId, provisionId: provision.id, userId: workspace.userId },
    adapter,
  );
  const repeated = await (clickUpService as any).processDeliveryProvision(
    { clinicId: workspace.clinicId, provisionId: provision.id, userId: workspace.userId },
    adapter,
  );

  assert.equal(processed.status, "processed");
  assert.equal(processed.clickUpFolderId, "cu-folder-created");
  assert.equal(processed.clickUpListId, "cu-list-created");
  assert.equal(repeated.status, "processed");
  assert.equal(folderCalls, 1);
  assert.equal(listCalls, 2);
  assert.equal(taskCalls, 2);
  assert.equal(checklistCalls, 1);
  assert.equal(checklistItemCalls, 3);
  const [taskMappings]: any = await pool.execute(
    `SELECT clickup_task_id as clickUpTaskId, clickup_list_id as clickUpListId
     FROM clickup_task_mapping
     WHERE clinic_id = ? AND internal_task_id = ?`,
    [workspace.clinicId, internalTaskId],
  );
  assert.deepEqual(taskMappings, [{ clickUpTaskId: "cu-delivery-task", clickUpListId: "cu-list-created" }]);
  const [clientMappings]: any = await pool.execute(
    "SELECT delivery_root_task_id as deliveryRootTaskId FROM clickup_client_mapping WHERE clinic_id = ? AND client_account_profile_id = ?",
    [workspace.clinicId, profileId],
  );
  assert.equal(clientMappings[0].deliveryRootTaskId, "cu-delivery-root");
});

test("ClickUp provision batches recover stale claims, respect retry limits, and expose failures", async () => {
  await pool.execute("DELETE FROM clickup_delivery_provision");
  const workspace = await createTestClinicAndAdmin("clickup-delivery-retries");
  const profileId = uuidv4();
  await pool.execute(
    "INSERT INTO client_account_profile (id, clinic_id, active_services) VALUES (?, ?, JSON_ARRAY())",
    [profileId, workspace.clinicId],
  );
  const stage = (label: string) => (clickUpService as any).stageDeliveryProvision({
    clinicId: workspace.clinicId,
    clientAccountProfileId: profileId,
    proposalId: uuidv4(),
    eventId: uuidv4(),
    idempotencyKey: `proposal_accepted:${label}:${uuidv4()}`,
    payload: { packageName: label },
  });
  const stale = await stage("Stale");
  const due = await stage("Due");
  const exhausted = await stage("Exhausted");
  await pool.execute(
    `UPDATE clickup_delivery_provision
     SET status = 'processing', attempt_count = 1,
         updated_at = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 2 HOUR)
     WHERE id = ?`,
    [stale.id],
  );
  await pool.execute(
    "UPDATE clickup_delivery_provision SET status = 'failed', attempt_count = 1, next_attempt_at = CURRENT_TIMESTAMP WHERE id = ?",
    [due.id],
  );
  await pool.execute(
    "UPDATE clickup_delivery_provision SET status = 'failed', attempt_count = 5, next_attempt_at = CURRENT_TIMESTAMP WHERE id = ?",
    [exhausted.id],
  );

  const result = await (clickUpService as any).processDeliveryProvisionBatch(
    { limit: 10, staleAfterMinutes: 30 },
    async () => ({}),
  );
  const failures = await (clickUpService as any).listDeliveryProvisionFailures(workspace.clinicId);
  const byId = new Map<string, any>(failures.map((row: any) => [row.id, row]));

  assert.deepEqual(result, { recoveredStale: 1, attempted: 2, processed: 0, failed: 2 });
  assert.equal(byId.get(stale.id)?.attemptCount, 2);
  assert.equal(byId.get(due.id)?.attemptCount, 2);
  assert.equal(byId.get(exhausted.id)?.attemptCount, 5);
  assert.equal(byId.get(exhausted.id)?.retryState, "exhausted");
  assert.equal(byId.get(due.id)?.retryState, "scheduled");

  await (clickUpService as any).retryDeliveryProvision(
    workspace.clinicId,
    workspace.userId,
    exhausted.id,
  );
  const replayedFailures = await (clickUpService as any).listDeliveryProvisionFailures(workspace.clinicId);
  const replayed = replayedFailures.find((row: any) => row.id === exhausted.id);
  assert.equal(replayed.attemptCount, 0);
  assert.equal(replayed.retryState, "scheduled");
});
