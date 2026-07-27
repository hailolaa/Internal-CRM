import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { contactsService } from "../modules/contacts/contacts.service.js";
import proposalsRoutes from "../modules/proposals/proposals.routes.js";
import errorHandler from "../middleware/errorHandler.js";
import { generateToken, hashPassword } from "../utils/helpers.js";

type TestUser = { id: string; roleId: string; token: string };

async function createUser(clinicId: string, roleName: string, permissions: string[]): Promise<TestUser> {
  const id = uuidv4();
  const roleId = uuidv4();
  const email = `${id}@proposal.test`;
  await pool.execute(
    "INSERT INTO role (id, clinic_id, name, display_name, is_system) VALUES (?, ?, ?, ?, 0)",
    [roleId, clinicId, roleName, roleName],
  );
  if (permissions.length) {
    await pool.execute(
      `INSERT INTO role_permission (role_id, permission_id)
       SELECT ?, id FROM permission WHERE key_name IN (${permissions.map(() => "?").join(", ")})`,
      [roleId, ...permissions],
    );
  }
  await pool.execute(
    `INSERT INTO user
       (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at, status, is_active)
     VALUES (?, ?, ?, ?, 'Proposal', 'Tester', ?, CURRENT_TIMESTAMP, 'active', 1)`,
    [id, clinicId, email, await hashPassword("password123"), roleName],
  );
  await pool.execute(
    "INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary) VALUES (?, ?, ?, 'active', 1)",
    [id, clinicId, roleName],
  );
  return { id, roleId, token: generateToken({ userId: id, clinicId, role: roleName, email }) };
}

async function request(baseUrl: string, path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  return { response, body: await response.json() as any };
}

async function requestPublic(baseUrl: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json" },
  });
  return { response, body: await response.json() as any };
}

async function closeServer(server: Server) {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("proposal API enforces permissions, persists statuses, and isolates tenants", async () => {
  await testConnection();
  await pool.execute(
    `INSERT IGNORE INTO permission (id, key_name, description) VALUES
       ('perm-proposals-read', 'proposals:read', 'Read internal proposals'),
       ('perm-proposals-write', 'proposals:write', 'Create and update internal proposals')`,
  );
  const primaryClinicId = uuidv4();
  const otherClinicId = uuidv4();
  const contactId = uuidv4();
  const pipelineId = uuidv4();
  const openStageId = uuidv4();
  const proposalSentStageId = uuidv4();
  const wonStageId = uuidv4();
  const dealId = uuidv4();
  const users: TestUser[] = [];
  let convertedClientClinicId: string | null = null;

  await pool.execute(
    `INSERT INTO clinic (id, name, email, timezone, subscription_plan, subscription_status, max_users)
     VALUES (?, 'Proposal Test', ?, 'Europe/London', 'professional', 'active', 10),
            (?, 'Other Proposal Test', ?, 'Europe/London', 'professional', 'active', 10)`,
    [primaryClinicId, `${primaryClinicId}@test.local`, otherClinicId, `${otherClinicId}@test.local`],
  );

  const writer = await createUser(primaryClinicId, `PROPOSAL_WRITER_${Date.now()}`, ["proposals:read", "proposals:write"]);
  const contactsOnly = await createUser(primaryClinicId, `CONTACT_WRITER_${Date.now()}`, ["contacts:read", "contacts:write"]);
  const otherWriter = await createUser(otherClinicId, `OTHER_PROPOSAL_WRITER_${Date.now()}`, ["proposals:read", "proposals:write"]);
  users.push(writer, contactsOnly, otherWriter);

  await pool.execute(
    `INSERT INTO contact (id, clinic_id, first_name, last_name, email, status, lead_status, source)
     VALUES (?, ?, 'Week', 'Two', ?, 'lead', 'qualified', 'referral')`,
    [contactId, primaryClinicId, `${contactId}@test.local`],
  );
  for (const unsafeDriveUrl of [
    "javascript://drive.google.com/file/d/unsafe-item/view",
    "data://drive.google.com/file/d/unsafe-item/view",
    "https://drive.google.com.evil.example/file/d/unsafe-item/view",
  ]) {
    await assert.rejects(
      contactsService.updateDocumentLink(
        primaryClinicId,
        contactsOnly.id,
        contactId,
        "audit",
        { driveUrl: unsafeDriveUrl },
        {},
      ),
      /valid folder, file, or ZIP ID/i,
    );
  }
  const safeContactDocuments = await contactsService.updateDocumentLink(
    primaryClinicId,
    contactsOnly.id,
    contactId,
    "audit",
    { driveUrl: "https://docs.google.com/document/d/safe-contact-doc/edit" },
    {},
  );
  assert.equal(
    safeContactDocuments.find((document) => document.documentType === "audit")?.driveUrl,
    "https://docs.google.com/document/d/safe-contact-doc/edit",
  );
  await pool.execute(
    "INSERT INTO pipeline (id, clinic_id, name, description, stages) VALUES (?, ?, ?, ?, JSON_ARRAY('Open', 'Client Secured'))",
    [pipelineId, primaryClinicId, `Proposal outcome pipeline ${Date.now()}`, "Proposal outcome conversion test"],
  );
  await pool.execute(
    `INSERT INTO pipeline_stage
      (id, clinic_id, pipeline_id, name, color, position, kind, is_locked, created_by)
     VALUES
      (?, ?, ?, 'Open', 'bg-slate-500', 1, 'open', 0, ?),
      (?, ?, ?, 'Client Secured', 'bg-emerald-500', 2, 'won', 1, ?)`,
    [
      openStageId,
      primaryClinicId,
      pipelineId,
      writer.id,
      wonStageId,
      primaryClinicId,
      pipelineId,
      writer.id,
    ],
  );
  await pool.execute(
    `INSERT INTO deal
      (id, clinic_id, contact_id, pipeline_id, pipeline_stage_id, title, value, stage,
       probability, owner_id, source, treatment, status, stage_changed_at, created_by)
     VALUES (?, ?, ?, ?, ?, 'Proposal-linked Growth Engine opportunity', 1250.00, 'Open',
       50, ?, 'referral', 'Growth Engine', 'open', CURRENT_TIMESTAMP, ?)`,
    [dealId, primaryClinicId, contactId, pipelineId, openStageId, writer.id, writer.id],
  );

  const expressModule = await import("express") as any;
  const app = expressModule.default();
  app.use(expressModule.default.json());
  app.use("/api/proposals", proposalsRoutes);
  app.use(errorHandler);
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start proposal test server");
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const forbidden = await request(baseUrl, "/api/proposals", contactsOnly.token);
    assert.equal(forbidden.response.status, 403, "contact permissions must not grant proposal access");

    const created = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify({
        contactId,
        dealId,
        proposalName: "Week 2 API proposal",
        status: "draft",
        valueCents: 125000,
        currency: "GBP",
      }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.status, "draft");
    assert.equal(created.body.data.valueCents, 125000);

    const prematureShare = await request(
      baseUrl,
      `/api/proposals/${created.body.data.id}/share`,
      writer.token,
      { method: "POST" },
    );
    assert.equal(prematureShare.response.status, 400);

    const ready = await request(baseUrl, `/api/proposals/${created.body.data.id}`, writer.token, {
      method: "PATCH",
      body: JSON.stringify({ status: "ready" }),
    });
    assert.equal(ready.response.status, 200);
    assert.equal(ready.body.data.status, "ready");
    assert.ok(ready.body.data.readyAt);

    const share = await request(baseUrl, `/api/proposals/${created.body.data.id}/share`, writer.token, {
      method: "POST",
    });
    assert.equal(share.response.status, 201);
    const proposalUrl = new URL(share.body.data.proposalUrl);
    assert.equal(proposalUrl.pathname, "/proposals/shared/");
    const publicToken = proposalUrl.searchParams.get("token");
    assert.ok(publicToken);

    const publicPreview = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(publicToken)}`,
    );
    assert.equal(publicPreview.response.status, 200);
    assert.equal(publicPreview.response.headers.get("cache-control"), "no-store");
    assert.equal(publicPreview.body.data.proposal.proposalName, "Week 2 API proposal");
    for (const sensitiveField of [
      "id",
      "contactId",
      "dealId",
      "clientAccountProfileId",
      "recommendedPackageId",
      "ownerId",
      "ownerName",
      "status",
      "followUpAt",
      "sentAt",
      "sentToEmail",
      "sentToName",
      "sendMethod",
      "sendNote",
      "sentBy",
      "sentByName",
      "viewedAt",
      "acceptedAt",
      "acceptedReason",
      "wonAt",
      "wonReason",
      "lostAt",
      "lostReason",
      "objectionType",
      "proposalUrl",
      "notes",
      "internalMarginNote",
      "contactEmail",
      "dealTitle",
      "createdBy",
      "updatedBy",
      "createdAt",
      "updatedAt",
      "acceptanceRecord",
    ]) {
      assert.equal(
        Object.hasOwn(publicPreview.body.data.proposal, sensitiveField),
        false,
        `${sensitiveField} must not be public`,
      );
    }

    const viewed = await request(baseUrl, `/api/proposals/${created.body.data.id}`, writer.token);
    assert.equal(viewed.response.status, 200);
    assert.equal(viewed.body.data.status, "viewed");
    assert.ok(viewed.body.data.viewedAt);

    const [firstViewActivityRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM activity
       WHERE clinic_id = ?
         AND contact_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.action')) = 'proposal_viewed'`,
      [primaryClinicId, contactId],
    );
    assert.equal(Number(firstViewActivityRows[0].total), 1);

    const repeatedPublicPreview = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(publicToken)}`,
    );
    assert.equal(repeatedPublicPreview.response.status, 200);
    const [repeatedViewActivityRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM activity
       WHERE clinic_id = ?
         AND contact_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.action')) = 'proposal_viewed'`,
      [primaryClinicId, contactId],
    );
    assert.equal(Number(repeatedViewActivityRows[0].total), 1);

    const updated = await request(baseUrl, `/api/proposals/${created.body.data.id}`, writer.token, {
      method: "PATCH",
      body: JSON.stringify({ status: "follow_up_due", followUpAt: "2026-07-24T09:00:00.000Z" }),
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.data.status, "follow_up_due");
    assert.equal(updated.body.data.contactId, contactId);

    const accepted = await request(baseUrl, `/api/proposals/${created.body.data.id}/status`, writer.token, {
      method: "POST",
      body: JSON.stringify({
        status: "accepted",
        reason: "Email acceptance",
        acceptedByName: "Week Two Owner",
        acceptedByEmail: "owner@example.com",
        acceptedAt: "2026-07-25T10:00:00.000Z",
        paymentTerms: "Monthly in advance, setup due before kickoff.",
      }),
    });
    assert.equal(accepted.response.status, 200);
    assert.equal(accepted.body.data.status, "accepted");
    assert.equal(accepted.body.data.acceptanceRecord.acceptedByName, "Week Two Owner");
    assert.equal(accepted.body.data.acceptanceRecord.acceptedByEmail, "owner@example.com");
    assert.equal(accepted.body.data.acceptanceRecord.packageName, null);
    assert.equal(accepted.body.data.acceptanceRecord.monthlyFeeCents, null);
    assert.equal(accepted.body.data.acceptanceRecord.paymentTerms, "Monthly in advance, setup due before kickoff.");
    assert.ok(accepted.body.data.clientAccountProfileId);
    assert.equal(
      accepted.body.data.acceptanceRecord.clientAccountProfileId,
      accepted.body.data.clientAccountProfileId,
    );

    const [convertedDealRows]: any = await pool.execute(
      `SELECT d.pipeline_stage_id as stageId,
              d.stage,
              d.status,
              d.client_account_profile_id as clientAccountProfileId,
              cap.clinic_id as clientClinicId
       FROM deal d
       JOIN client_account_profile cap ON cap.id = d.client_account_profile_id
       WHERE d.id = ?
         AND d.clinic_id = ?`,
      [dealId, primaryClinicId],
    );
    assert.equal(convertedDealRows.length, 1);
    assert.equal(convertedDealRows[0].stageId, wonStageId);
    assert.equal(convertedDealRows[0].stage, "Client Secured", "terminal proposal sync must resolve stages by kind");
    assert.equal(convertedDealRows[0].status, "won");
    assert.equal(convertedDealRows[0].clientAccountProfileId, accepted.body.data.clientAccountProfileId);
    convertedClientClinicId = convertedDealRows[0].clientClinicId;

    const [onboardingTaskRows]: any = await pool.execute(
      `SELECT assigned_user_id as assignedUserId, due_date as dueDate
       FROM task
       WHERE clinic_id = ?
         AND template_key LIKE ?
         AND archived_at IS NULL
         AND deleted_at IS NULL`,
      [primaryClinicId, `won_client_onboarding:${dealId}:%`],
    );
    assert.equal(onboardingTaskRows.length, 16);
    assert.equal(onboardingTaskRows.every((row: any) => row.assignedUserId === writer.id), true);
    assert.equal(onboardingTaskRows.every((row: any) => row.dueDate), true);

    const [movementRows]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM pipeline_deal_movement WHERE clinic_id = ? AND deal_id = ?",
      [primaryClinicId, dealId],
    );
    assert.equal(Number(movementRows[0].count), 1);

    const acceptedRetry = await request(baseUrl, `/api/proposals/${created.body.data.id}/status`, writer.token, {
      method: "POST",
      body: JSON.stringify({
        status: "accepted",
        reason: "Email acceptance",
        acceptedByName: "Week Two Owner",
        acceptedByEmail: "owner@example.com",
        acceptedAt: "2026-07-25T10:00:00.000Z",
        paymentTerms: "Monthly in advance, setup due before kickoff.",
      }),
    });
    assert.equal(acceptedRetry.response.status, 200);
    assert.equal(acceptedRetry.body.data.clientAccountProfileId, accepted.body.data.clientAccountProfileId);
    const [retryRows]: any = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM task
          WHERE clinic_id = ?
            AND template_key LIKE ?
            AND archived_at IS NULL
            AND deleted_at IS NULL) as taskCount,
         (SELECT COUNT(*) FROM pipeline_deal_movement
          WHERE clinic_id = ?
            AND deal_id = ?) as movementCount`,
      [
        primaryClinicId,
        `won_client_onboarding:${dealId}:%`,
        primaryClinicId,
        dealId,
      ],
    );
    assert.equal(Number(retryRows[0].taskCount), 16);
    assert.equal(Number(retryRows[0].movementCount), 1);

    const rejectedAcceptedResend = await request(
      baseUrl,
      `/api/proposals/${created.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "owner@example.com",
          recipientName: "Week Two Owner",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(rejectedAcceptedResend.response.status, 400);
    assert.match(rejectedAcceptedResend.body.message, /accepted proposal cannot be marked sent/i);

    const rejectedAcceptedFollowUp = await request(
      baseUrl,
      `/api/proposals/${created.body.data.id}/status`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          status: "follow_up_due",
          followUpAt: "2026-07-29T09:00:00.000Z",
        }),
      },
    );
    assert.equal(rejectedAcceptedFollowUp.response.status, 400);
    assert.match(rejectedAcceptedFollowUp.body.message, /accepted proposal cannot be moved back/i);

    await pool.execute(
      `INSERT INTO pipeline_stage
        (id, clinic_id, pipeline_id, name, color, position, kind, is_locked, created_by)
       VALUES (?, ?, ?, 'Proposal Sent', 'bg-orange-500', 3, 'open', 0, ?)`,
      [proposalSentStageId, primaryClinicId, pipelineId, writer.id],
    );
    const postWinProposal = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify({
        contactId,
        dealId,
        proposalName: "Post-win add-on proposal",
        status: "ready",
        valueCents: 25000,
        currency: "GBP",
      }),
    });
    assert.equal(postWinProposal.response.status, 201);
    const postWinSent = await request(
      baseUrl,
      `/api/proposals/${postWinProposal.body.data.id}/send`,
      writer.token,
      {
        method: "POST",
        body: JSON.stringify({
          recipientEmail: "owner@example.com",
          recipientName: "Week Two Owner",
          sendMethod: "manual_email",
        }),
      },
    );
    assert.equal(postWinSent.response.status, 200);
    assert.equal(postWinSent.body.data.status, "sent");

    const [postWinSyncRows]: any = await pool.execute(
      `SELECT
         (SELECT status FROM deal WHERE id = ? AND clinic_id = ?) as dealStatus,
         (SELECT client_account_profile_id FROM deal WHERE id = ? AND clinic_id = ?) as profileId,
         (SELECT COUNT(*) FROM task
          WHERE clinic_id = ?
            AND template_key LIKE ?
            AND archived_at IS NULL
            AND deleted_at IS NULL) as taskCount,
         (SELECT COUNT(*) FROM pipeline_deal_movement
          WHERE clinic_id = ?
            AND deal_id = ?) as movementCount`,
      [
        dealId,
        primaryClinicId,
        dealId,
        primaryClinicId,
        primaryClinicId,
        `won_client_onboarding:${dealId}:%`,
        primaryClinicId,
        dealId,
      ],
    );
    assert.equal(postWinSyncRows[0].dealStatus, "won");
    assert.equal(postWinSyncRows[0].profileId, accepted.body.data.clientAccountProfileId);
    assert.equal(Number(postWinSyncRows[0].taskCount), 16);
    assert.equal(Number(postWinSyncRows[0].movementCount), 1);

    const acceptedPublicPreview = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(publicToken)}`,
    );
    assert.equal(acceptedPublicPreview.response.status, 200, "accepted proposals remain publicly visible");

    await pool.execute(
      "UPDATE proposal SET expires_at = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND) WHERE id = ?",
      [created.body.data.id],
    );
    const expiredPublicPreview = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(publicToken)}`,
    );
    assert.equal(expiredPublicPreview.response.status, 404);

    await pool.execute(
      `UPDATE proposal
       SET expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 DAY),
           status = 'lost',
           lost_reason = 'budget',
           objection_type = 'budget'
       WHERE id = ?`,
      [created.body.data.id],
    );
    const lostPublicPreview = await requestPublic(
      baseUrl,
      `/api/proposals/shared/${encodeURIComponent(publicToken)}`,
    );
    assert.equal(lostPublicPreview.response.status, 404);

    const crossTenant = await request(baseUrl, `/api/proposals/${created.body.data.id}`, otherWriter.token);
    assert.equal(crossTenant.response.status, 404);

    const archived = await request(baseUrl, `/api/proposals/${created.body.data.id}`, writer.token, { method: "DELETE" });
    assert.equal(archived.response.status, 200);
    const missing = await request(baseUrl, `/api/proposals/${created.body.data.id}`, writer.token);
    assert.equal(missing.response.status, 404);
  } finally {
    try {
      await closeServer(server);
      await pool.execute("DELETE FROM audit_log WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM activity WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute(
        `DELETE FROM task
         WHERE clinic_id IN (?, ?)
           AND (
             template_key LIKE 'proposal_follow_up:%'
             OR category = 'proposal_follow_up'
             OR template_key LIKE ?
           )`,
        [primaryClinicId, otherClinicId, `won_client_onboarding:${dealId}:%`],
      );
      await pool.execute("DELETE FROM proposal_acceptance_record WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM proposal WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM contact_document_link WHERE clinic_id = ? AND contact_id = ?", [primaryClinicId, contactId]);
      await pool.execute(
        "DELETE FROM client_account_contact WHERE clinic_id = ? AND contact_id = ?",
        [primaryClinicId, contactId],
      );
      await pool.execute(
        "DELETE FROM pipeline_deal_movement WHERE clinic_id = ? AND deal_id = ?",
        [primaryClinicId, dealId],
      );
      await pool.execute("DELETE FROM deal WHERE id = ?", [dealId]);
      await pool.execute(
        "DELETE FROM pipeline_stage WHERE id IN (?, ?, ?)",
        [openStageId, proposalSentStageId, wonStageId],
      );
      await pool.execute("DELETE FROM pipeline WHERE id = ?", [pipelineId]);
      await pool.execute("DELETE FROM contact WHERE id = ?", [contactId]);
      if (convertedClientClinicId) {
        await pool.execute("DELETE FROM audit_log WHERE clinic_id = ?", [convertedClientClinicId]);
        await pool.execute("DELETE FROM client_account_profile WHERE clinic_id = ?", [convertedClientClinicId]);
        await pool.execute("DELETE FROM clinic WHERE id = ?", [convertedClientClinicId]);
      }
      for (const user of users) {
        await pool.execute("DELETE FROM clinic_membership WHERE user_id = ?", [user.id]);
        await pool.execute("DELETE FROM user WHERE id = ?", [user.id]);
        await pool.execute("DELETE FROM role_permission WHERE role_id = ?", [user.roleId]);
        await pool.execute("DELETE FROM role WHERE id = ?", [user.roleId]);
      }
      await pool.execute("DELETE FROM clinic WHERE id IN (?, ?)", [primaryClinicId, otherClinicId]);
    } finally {
      await pool.end();
    }
  }
});
