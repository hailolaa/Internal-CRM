import { v4 as uuidv4 } from "uuid";
import crypto from "node:crypto";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import type {
  ClientAccountAuditContext,
  ClientAccountListQuery,
  ClientAccountLinkedContactResponse,
  ClientAccountLinkedRecordsResponse,
  ClientAccountLinkedTaskResponse,
  ClientAccountProfileResponse,
  ClientAccountServiceListQuery,
  ClientAccountServiceResponse,
  ClientAccountSummaryResponse,
  CreateClientAccountDTO,
  CreateClientAccountFromContactDTO,
  CreateClientAccountServiceDTO,
  UpdateClientAccountDriveFolderDTO,
  UpdateClientAccountServiceDTO,
  UpdateClientAccountProfileDTO,
} from "./client-accounts.types.js";

const DEFAULT_PROFILE = {
  activeServices: [] as string[],
  onboardingStatus: "not_started",
  healthStatus: "attention_needed",
  clientStatus: "prospect",
  currentPackage: null as string | null,
  churnRisk: "low",
  contractStatus: "pending",
};

function parseServices(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toDateString(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toIsoString(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function ownKey<T extends object>(data: T, key: keyof T) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function normalizeServices(services: string[]) {
  return Array.from(new Set(services.map((service) => service.trim()).filter(Boolean)));
}

function contactDisplayName(row: any) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
    row.email ||
    row.phone ||
    row.accountName ||
    "Unnamed contact";
}

type GoogleDriveItemKind = "folder" | "zip" | "unknown";
type GoogleDriveTokenCache = {
  token: string;
  expiresAt: number;
};

function extractGoogleDriveItem(value: string): { id: string; kindHint: GoogleDriveItemKind } {
  const input = value.trim().replace(/^["'<\s]+|[>"'\s]+$/g, "");
  const validDriveId = (candidate: string | null | undefined) =>
    Boolean(candidate && /^[A-Za-z0-9_-]{5,255}$/.test(candidate));

  if (validDriveId(input) && !input.includes(".")) return { id: input, kindHint: "unknown" };

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw ApiError.badRequest("Enter a valid Google Drive folder or ZIP file URL or ID.");
  }

  const host = url.hostname.toLowerCase();
  if (!host.endsWith("drive.google.com")) {
    throw ApiError.badRequest("Only Google Drive folder or ZIP file links are supported.");
  }

  const path = decodeURIComponent(url.pathname);
  const fileId = path.match(/\/file\/d\/([^/?#]+)/)?.[1];
  const folderId =
    path.match(/\/drive\/(?:u\/\d+\/)?(?:mobile\/)?folders\/([^/?#]+)/)?.[1] ||
    path.match(/\/folders\/([^/?#]+)/)?.[1];
  const driveId =
    folderId ||
    fileId ||
    url.searchParams.get("id");
  const kindHint: GoogleDriveItemKind = folderId ? "folder" : fileId ? "zip" : "unknown";

  if (!validDriveId(driveId)) {
    throw ApiError.badRequest("Google Drive link must include a valid folder or ZIP file ID.");
  }

  return { id: String(driveId), kindHint };
}

export class ClientAccountsService {
  private googleDriveTokenCache: GoogleDriveTokenCache | null = null;

  async listAccounts(
    clinicId: string,
    options: { includeAllClinics: boolean; query?: ClientAccountListQuery },
  ): Promise<ClientAccountSummaryResponse[]> {
    const query = options.query || {};
    const conditions = ["c.deleted_at IS NULL"];
    const values: any[] = [];

    if (!options.includeAllClinics) {
      conditions.push("c.id = ?");
      values.push(clinicId);
    }

    if (query.healthStatus && query.healthStatus !== "all") {
      conditions.push("COALESCE(cap.health_status, ?) = ?");
      values.push(DEFAULT_PROFILE.healthStatus, query.healthStatus);
    }

    if (query.churnRisk && query.churnRisk !== "all") {
      conditions.push("COALESCE(cap.churn_risk, ?) = ?");
      values.push(DEFAULT_PROFILE.churnRisk, query.churnRisk);
    }

    if (query.clientStatus && query.clientStatus !== "all") {
      conditions.push("COALESCE(cap.client_status, ?) = ?");
      values.push(DEFAULT_PROFILE.clientStatus, query.clientStatus);
    }

    if (query.contractStatus && query.contractStatus !== "all") {
      conditions.push("COALESCE(cap.contract_status, ?) = ?");
      values.push(DEFAULT_PROFILE.contractStatus, query.contractStatus);
    }

    const search = query.search?.trim();
    if (search) {
      const wildcard = `%${search}%`;
      conditions.push(
        "(c.name LIKE ? OR c.email LIKE ? OR cap.current_package LIKE ? OR u.email LIKE ? OR CONCAT_WS(' ', u.first_name, u.last_name) LIKE ?)",
      );
      values.push(wildcard, wildcard, wildcard, wildcard, wildcard);
    }

    const [rows]: any = await pool.execute(
      `SELECT
          c.id as clinicId,
          c.name as clinicName,
          c.email,
          c.phone,
          c.website,
          c.address,
          c.city,
          c.state,
          c.postal_code as postalCode,
          c.country,
          c.updated_at as clinicUpdatedAt,
          cap.id,
          cap.account_manager_id as accountManagerId,
          cap.active_services as activeServices,
          cap.onboarding_status as onboardingStatus,
          cap.health_status as healthStatus,
          cap.client_status as clientStatus,
          cap.current_package as currentPackage,
          cap.churn_risk as churnRisk,
          cap.renewal_date as renewalDate,
          cap.contract_status as contractStatus,
          cap.key_notes as keyNotes,
          cap.google_drive_folder_id as googleDriveFolderId,
          cap.google_drive_folder_url as googleDriveFolderUrl,
          cap.google_drive_folder_name as googleDriveFolderName,
          cap.google_drive_folder_access_status as googleDriveFolderAccessStatus,
          cap.google_drive_folder_error as googleDriveFolderError,
          cap.google_drive_folder_checked_at as googleDriveFolderCheckedAt,
          cap.updated_at as updatedAt,
          u.first_name as accountManagerFirstName,
          u.last_name as accountManagerLastName,
          u.email as accountManagerEmail,
          service_summary.serviceTypes as derivedActiveServices,
          COALESCE(service_summary.activeServiceCount, 0) as activeServiceCount,
          COALESCE(service_summary.renewalRiskCount, 0) as renewalRiskCount,
          COALESCE(task_summary.pendingTaskCount, 0) as pendingTaskCount,
          COALESCE(task_summary.overdueTaskCount, 0) as overdueTaskCount,
          COALESCE(task_summary.qaTaskCount, 0) as qaTaskCount,
          COALESCE(task_summary.missedTaskCount, 0) as missedTaskCount,
          COALESCE(task_summary.escalatedTaskCount, 0) as escalatedTaskCount,
          strategy_summary.lastStrategyLogAt as lastStrategyLogAt,
          action_plan_summary.actionPlanId as actionPlanId,
          action_plan_summary.actionPlanMonth as actionPlanMonth,
          action_plan_summary.actionPlanStatus as actionPlanStatus,
          COALESCE(action_plan_summary.actionPlanTotalItems, 0) as actionPlanTotalItems,
          COALESCE(action_plan_summary.actionPlanCompletedItems, 0) as actionPlanCompletedItems,
          COALESCE(action_plan_summary.actionPlanOpenItems, 0) as actionPlanOpenItems,
          COALESCE(action_plan_summary.actionPlanHighPriorityOpenItems, 0) as actionPlanHighPriorityOpenItems,
          action_plan_summary.actionPlanLastUpdatedAt as actionPlanLastUpdatedAt
       FROM clinic c
       LEFT JOIN client_account_profile cap ON cap.clinic_id = c.id
       LEFT JOIN user u ON u.id = cap.account_manager_id AND u.deleted_at IS NULL
       LEFT JOIN (
          SELECT
            clinic_id,
            COUNT(*) as activeServiceCount,
            SUM(
              CASE
                WHEN renewal_date IS NOT NULL
                 AND renewal_date <= DATE_ADD(CURDATE(), INTERVAL 45 DAY)
                 AND contract_status IN ('active', 'trial', 'pending')
                THEN 1
                ELSE 0
              END
            ) as renewalRiskCount,
            GROUP_CONCAT(DISTINCT service_type ORDER BY service_type SEPARATOR ',') as serviceTypes
          FROM client_account_service
          WHERE archived_at IS NULL
            AND status <> 'archived'
          GROUP BY clinic_id
       ) service_summary ON service_summary.clinic_id = c.id
       LEFT JOIN (
          SELECT
            clinic_id,
            SUM(CASE WHEN status <> 'completed' THEN 1 ELSE 0 END) as pendingTaskCount,
            SUM(CASE WHEN status <> 'completed' AND due_date IS NOT NULL AND due_date < CURDATE() THEN 1 ELSE 0 END) as overdueTaskCount,
            SUM(CASE WHEN needs_qa = 1 OR approval_status IN ('pending', 'needs_changes') THEN 1 ELSE 0 END) as qaTaskCount,
            SUM(CASE WHEN status <> 'completed' AND missed_task = 1 THEN 1 ELSE 0 END) as missedTaskCount,
            SUM(CASE WHEN escalation_flag = 1 THEN 1 ELSE 0 END) as escalatedTaskCount
          FROM task
          WHERE is_internal = 1
            AND deleted_at IS NULL
            AND archived_at IS NULL
          GROUP BY clinic_id
       ) task_summary ON task_summary.clinic_id = c.id
       LEFT JOIN (
          SELECT clinic_id, MAX(updated_at) as lastStrategyLogAt
          FROM strategy_log
          WHERE archived_at IS NULL
          GROUP BY clinic_id
       ) strategy_summary ON strategy_summary.clinic_id = c.id
       LEFT JOIN (
          SELECT
            map.clinic_id,
            map.id as actionPlanId,
            DATE_FORMAT(map.plan_month, '%Y-%m') as actionPlanMonth,
            map.status as actionPlanStatus,
            COUNT(item.id) as actionPlanTotalItems,
            SUM(CASE WHEN item.status = 'completed' THEN 1 ELSE 0 END) as actionPlanCompletedItems,
            SUM(CASE WHEN item.status IN ('planned', 'in_progress') THEN 1 ELSE 0 END) as actionPlanOpenItems,
            SUM(CASE WHEN item.priority = 'high' AND item.status IN ('planned', 'in_progress') THEN 1 ELSE 0 END) as actionPlanHighPriorityOpenItems,
            MAX(COALESCE(item.updated_at, map.updated_at)) as actionPlanLastUpdatedAt
          FROM monthly_action_plan map
          LEFT JOIN monthly_action_plan_item item
            ON item.plan_id = map.id
           AND item.clinic_id = map.clinic_id
           AND item.deleted_at IS NULL
          WHERE map.deleted_at IS NULL
            AND map.plan_month = DATE_FORMAT(CURDATE(), '%Y-%m-01')
          GROUP BY map.clinic_id, map.id, map.plan_month, map.status
       ) action_plan_summary ON action_plan_summary.clinic_id = c.id
       WHERE ${conditions.join(" AND ")}
       ORDER BY
         CASE COALESCE(cap.health_status, 'attention_needed')
           WHEN 'critical' THEN 0
           WHEN 'at_risk' THEN 1
           WHEN 'attention_needed' THEN 2
           ELSE 3
         END,
         COALESCE(task_summary.escalatedTaskCount, 0) DESC,
         c.name ASC`,
      values,
    );

    return rows.map((row: any) => this.mapAccountSummaryRow(row));
  }

  async createAccount(
    userId: string,
    data: CreateClientAccountDTO,
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountSummaryResponse> {
    if (data.accountManagerId) {
      await this.ensureActiveInternalUser(data.accountManagerId);
    }

    const clinicId = uuidv4();
    const profileId = uuidv4();
    const payload = this.normalizeAccountPayload(data);

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      await connection.execute(
        `INSERT INTO clinic
          (id, name, email, website, phone, address, city, state, postal_code, country,
           timezone, subscription_plan, subscription_status, max_users)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Europe/London', 'professional', 'active', 20)`,
        [
          clinicId,
          payload.name,
          payload.email,
          payload.website,
          payload.phone,
          payload.address,
          payload.city,
          payload.state,
          payload.postalCode,
          payload.country,
        ],
      );

      await connection.execute(
        `INSERT INTO client_account_profile
          (id, clinic_id, account_manager_id, active_services, onboarding_status, health_status,
           client_status, current_package, churn_risk, renewal_date, contract_status, key_notes,
           created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          profileId,
          clinicId,
          payload.accountManagerId,
          JSON.stringify(payload.activeServices),
          payload.onboardingStatus,
          payload.healthStatus,
          payload.clientStatus,
          payload.currentPackage,
          payload.churnRisk,
          payload.renewalDate,
          payload.contractStatus,
          payload.keyNotes,
          userId,
          userId,
        ],
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "CLIENT_ACCOUNT_CREATED",
      entityType: "client_account_profile",
      entityId: profileId,
      changes: payload,
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getAccountSummary(clinicId);
  }

  async createAccountFromContact(
    sourceClinicId: string,
    userId: string,
    data: CreateClientAccountFromContactDTO,
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountSummaryResponse> {
    const [rows]: any = await pool.execute(
      `SELECT id, first_name as firstName, last_name as lastName, email, phone,
              address, city, state, postal_code as postalCode, country, value,
              treatment_interests as treatmentInterests, package_interest as packageInterest,
              recommended_package as recommendedPackage, notes
       FROM contact
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [data.contactId, sourceClinicId],
    );

    if (rows.length === 0) {
      throw ApiError.notFound("Prospect not found");
    }

    const contact = rows[0];
    const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
    const treatmentInterests = parseServices(contact.treatmentInterests);
    const recommendedPackage =
      data.currentPackage ||
      contact.recommendedPackage ||
      contact.packageInterest ||
      treatmentInterests[0] ||
      null;

    const account = await this.createAccount(
      userId,
      {
        ...data,
        name: data.accountName || contactName || contact.email || "New Client Account",
        email: contact.email || null,
        phone: contact.phone || null,
        address: contact.address || null,
        city: contact.city || null,
        state: contact.state || null,
        postalCode: contact.postalCode || null,
        country: contact.country || null,
        activeServices: data.activeServices || treatmentInterests,
        clientStatus: data.clientStatus || "onboarding",
        onboardingStatus: data.onboardingStatus || "in_progress",
        currentPackage: recommendedPackage,
        keyNotes:
          data.keyNotes ||
          [
            contact.notes,
            `Converted from prospect ${contactName || contact.email || data.contactId}.`,
          ]
            .filter(Boolean)
            .join("\n\n"),
      },
      auditContext,
    );

    const nextNotes = [
      contact.notes,
      `Converted to client account: ${account.clinicName}.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    await pool.execute(
      `UPDATE contact
       SET status = 'active',
           lead_status = 'converted',
           notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [nextNotes, data.contactId, sourceClinicId],
    );

    await logAuditEvent({
      clinicId: sourceClinicId,
      userId,
      action: "PROSPECT_CONVERTED_TO_CLIENT_ACCOUNT",
      entityType: "contact",
      entityId: data.contactId,
      changes: {
        clientAccountClinicId: account.clinicId,
        clientAccountProfileId: account.id,
        clientAccountName: account.clinicName,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return account;
  }

  async getProfile(clinicId: string): Promise<ClientAccountProfileResponse> {
    const [rows]: any = await pool.execute(
      `SELECT
          c.id as clinicId,
          c.name as clinicName,
          c.email,
          c.phone,
          c.website,
          c.address,
          c.city,
          c.state,
          c.postal_code as postalCode,
          c.country,
          cap.id,
          cap.account_manager_id as accountManagerId,
          cap.active_services as activeServices,
          cap.onboarding_status as onboardingStatus,
          cap.health_status as healthStatus,
          cap.client_status as clientStatus,
          cap.current_package as currentPackage,
          cap.churn_risk as churnRisk,
          cap.renewal_date as renewalDate,
          cap.contract_status as contractStatus,
          cap.key_notes as keyNotes,
          cap.google_drive_folder_id as googleDriveFolderId,
          cap.google_drive_folder_url as googleDriveFolderUrl,
          cap.google_drive_folder_name as googleDriveFolderName,
          cap.google_drive_folder_access_status as googleDriveFolderAccessStatus,
          cap.google_drive_folder_error as googleDriveFolderError,
          cap.google_drive_folder_checked_at as googleDriveFolderCheckedAt,
          cap.updated_at as updatedAt,
          u.first_name as accountManagerFirstName,
          u.last_name as accountManagerLastName,
          u.email as accountManagerEmail
       FROM clinic c
       LEFT JOIN client_account_profile cap ON cap.clinic_id = c.id
       LEFT JOIN user u ON u.id = cap.account_manager_id AND u.deleted_at IS NULL
       WHERE c.id = ? AND c.deleted_at IS NULL
       LIMIT 1`,
      [clinicId],
    );

    if (rows.length === 0) {
      throw ApiError.notFound("Clinic account not found");
    }

    const row = rows[0];
    return {
      id: row.id || null,
      clinicId: row.clinicId,
      clinicName: row.clinicName,
      email: row.email || null,
      phone: row.phone || null,
      website: row.website || null,
      address: row.address || null,
      city: row.city || null,
      state: row.state || null,
      postalCode: row.postalCode || null,
      country: row.country || null,
      accountManager: row.accountManagerId
        ? {
            id: row.accountManagerId,
            firstName: row.accountManagerFirstName || null,
            lastName: row.accountManagerLastName || null,
            email: row.accountManagerEmail || null,
          }
        : null,
      activeServices: parseServices(row.activeServices),
      onboardingStatus: row.onboardingStatus || DEFAULT_PROFILE.onboardingStatus,
      healthStatus: row.healthStatus || DEFAULT_PROFILE.healthStatus,
      clientStatus: row.clientStatus || DEFAULT_PROFILE.clientStatus,
      currentPackage: row.currentPackage || DEFAULT_PROFILE.currentPackage,
      churnRisk: row.churnRisk || DEFAULT_PROFILE.churnRisk,
      renewalDate: toDateString(row.renewalDate),
      contractStatus: row.contractStatus || DEFAULT_PROFILE.contractStatus,
      keyNotes: row.keyNotes || null,
      googleDriveFolderId: row.googleDriveFolderId || null,
      googleDriveFolderUrl: row.googleDriveFolderUrl || null,
      googleDriveFolderName: row.googleDriveFolderName || null,
      googleDriveFolderAccessStatus: row.googleDriveFolderAccessStatus || "not_checked",
      googleDriveFolderError: row.googleDriveFolderError || null,
      googleDriveFolderCheckedAt: toIsoString(row.googleDriveFolderCheckedAt),
      updatedAt: toIsoString(row.updatedAt),
    };
  }

  async getLinkedRecords(sourceClinicId: string, clientClinicId: string): Promise<ClientAccountLinkedRecordsResponse> {
    const account = await this.getProfile(clientClinicId);
    const [contacts, tasks] = await Promise.all([
      this.listLinkedContacts(sourceClinicId, account.clinicName),
      account.id ? this.listLinkedTasks(sourceClinicId, account.id) : Promise.resolve([]),
    ]);
    const openTasks = tasks.filter((task) => task.status !== "completed");
    const completedTasks = tasks.filter((task) => task.status === "completed");

    return {
      account,
      contacts,
      openTasks,
      completedTasks,
      counts: {
        contacts: contacts.length,
        openTasks: openTasks.length,
        completedTasks: completedTasks.length,
      },
    };
  }

  async linkContactToAccount(
    sourceClinicId: string,
    clientClinicId: string,
    contactId: string,
    userId: string,
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountLinkedRecordsResponse> {
    const account = await this.getProfile(clientClinicId);
    const contact = await this.getWorkspaceContact(sourceClinicId, contactId);

    await pool.execute(
      `UPDATE contact
       SET account_name = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [account.clinicName, contactId, sourceClinicId],
    );

    await logAuditEvent({
      clinicId: sourceClinicId,
      userId,
      action: "CONTACT_LINKED_TO_CLIENT_ACCOUNT",
      entityType: "contact",
      entityId: contactId,
      changes: {
        clientAccountClinicId: account.clinicId,
        clientAccountProfileId: account.id,
        clientAccountName: account.clinicName,
        previousAccountName: contact.accountName,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getLinkedRecords(sourceClinicId, clientClinicId);
  }

  async unlinkContactFromAccount(
    sourceClinicId: string,
    clientClinicId: string,
    contactId: string,
    userId: string,
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountLinkedRecordsResponse> {
    const account = await this.getProfile(clientClinicId);
    const contact = await this.getWorkspaceContact(sourceClinicId, contactId);

    if ((contact.accountName || "").toLowerCase() !== account.clinicName.toLowerCase()) {
      throw ApiError.badRequest("Contact is not linked to this client account");
    }

    await pool.execute(
      `UPDATE contact
       SET account_name = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [contactId, sourceClinicId],
    );

    await logAuditEvent({
      clinicId: sourceClinicId,
      userId,
      action: "CONTACT_UNLINKED_FROM_CLIENT_ACCOUNT",
      entityType: "contact",
      entityId: contactId,
      changes: {
        clientAccountClinicId: account.clinicId,
        clientAccountProfileId: account.id,
        clientAccountName: account.clinicName,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getLinkedRecords(sourceClinicId, clientClinicId);
  }

  async updateDriveFolder(
    sourceClinicId: string,
    clientClinicId: string,
    userId: string,
    data: UpdateClientAccountDriveFolderDTO,
    access: { canManageAllClientAccounts: boolean },
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountProfileResponse> {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);

    const before = await this.getProfile(clientClinicId);
    const profileId = before.id || await this.ensureProfileRow(clientClinicId, userId);
    const input = (data.folderId || data.folderUrl || "").trim();
    const displayName = data.displayName?.trim() || null;

    if (!input) {
      await pool.execute(
        `UPDATE client_account_profile
         SET google_drive_folder_id = NULL,
             google_drive_folder_url = NULL,
             google_drive_folder_name = NULL,
             google_drive_folder_access_status = 'not_checked',
             google_drive_folder_error = NULL,
             google_drive_folder_checked_at = NULL,
             updated_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ?`,
        [userId, profileId, clientClinicId],
      );

      await logAuditEvent({
        clinicId: clientClinicId,
        userId,
        action: "CLIENT_ACCOUNT_DRIVE_FOLDER_REMOVED",
        entityType: "client_account_profile",
        entityId: profileId,
        changes: {
          googleDriveFolderId: { before: before.googleDriveFolderId, after: null },
          googleDriveFolderUrl: { before: before.googleDriveFolderUrl, after: null },
        },
        ipAddress: auditContext.ipAddress || null,
        userAgent: auditContext.userAgent || null,
      });

      return this.getProfile(clientClinicId);
    }

    const driveItem = extractGoogleDriveItem(input);
    const accessCheck = await this.checkGoogleDriveItemAccess(driveItem.id, driveItem.kindHint);
    const folderId = driveItem.id;
    const folderUrl =
      accessCheck.itemType === "zip" || driveItem.kindHint === "zip"
        ? `https://drive.google.com/file/d/${folderId}/view`
        : `https://drive.google.com/drive/folders/${folderId}`;

    const driveItemName =
      displayName ||
      accessCheck.name ||
      (accessCheck.itemType === "zip" ? "Google Drive ZIP archive" : "Google Drive folder");

    await pool.execute(
      `UPDATE client_account_profile
       SET google_drive_folder_id = ?,
           google_drive_folder_url = ?,
           google_drive_folder_name = ?,
           google_drive_folder_access_status = ?,
           google_drive_folder_error = ?,
           google_drive_folder_checked_at = ?,
           updated_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ?`,
      [
        folderId,
        folderUrl,
        driveItemName,
        accessCheck.status,
        accessCheck.error,
        accessCheck.checkedAt,
        userId,
        profileId,
        clientClinicId,
      ],
    );

    await logAuditEvent({
      clinicId: clientClinicId,
      userId,
      action: "CLIENT_ACCOUNT_DRIVE_FOLDER_UPDATED",
      entityType: "client_account_profile",
      entityId: profileId,
      changes: {
        googleDriveFolderId: { before: before.googleDriveFolderId, after: folderId },
        googleDriveFolderUrl: { before: before.googleDriveFolderUrl, after: folderUrl },
        googleDriveFolderAccessStatus: { before: before.googleDriveFolderAccessStatus, after: accessCheck.status },
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getProfile(clientClinicId);
  }

  async updateProfile(
    clinicId: string,
    userId: string,
    data: UpdateClientAccountProfileDTO,
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountProfileResponse> {
    if (ownKey(data, "accountManagerId") && data.accountManagerId) {
      await this.ensureAccountManagerBelongsToClinic(clinicId, data.accountManagerId);
    }

    const before = await this.getProfile(clinicId);
    const profileId = before.id || uuidv4();
    const fields: string[] = [];
    const values: any[] = [];
    const changes: Record<string, { before: unknown; after: unknown }> = {};

    const addChange = (field: string, column: string, beforeValue: unknown, afterValue: unknown) => {
      if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) return;
      fields.push(`${column} = ?`);
      values.push(Array.isArray(afterValue) ? JSON.stringify(afterValue) : afterValue);
      changes[field] = { before: beforeValue, after: afterValue };
    };

    if (ownKey(data, "accountManagerId")) {
      addChange("accountManagerId", "account_manager_id", before.accountManager?.id || null, data.accountManagerId || null);
    }

    if (ownKey(data, "activeServices") && data.activeServices) {
      addChange("activeServices", "active_services", before.activeServices, normalizeServices(data.activeServices));
    }

    if (ownKey(data, "onboardingStatus")) {
      addChange("onboardingStatus", "onboarding_status", before.onboardingStatus, data.onboardingStatus);
    }

    if (ownKey(data, "healthStatus")) {
      addChange("healthStatus", "health_status", before.healthStatus, data.healthStatus);
    }

    if (ownKey(data, "clientStatus")) {
      addChange("clientStatus", "client_status", before.clientStatus, data.clientStatus);
    }

    if (ownKey(data, "currentPackage")) {
      addChange("currentPackage", "current_package", before.currentPackage, data.currentPackage || null);
    }

    if (ownKey(data, "churnRisk")) {
      addChange("churnRisk", "churn_risk", before.churnRisk, data.churnRisk);
    }

    if (ownKey(data, "renewalDate")) {
      addChange("renewalDate", "renewal_date", before.renewalDate, toDateString(data.renewalDate));
    }

    if (ownKey(data, "contractStatus")) {
      addChange("contractStatus", "contract_status", before.contractStatus, data.contractStatus);
    }

    if (ownKey(data, "keyNotes")) {
      addChange("keyNotes", "key_notes", before.keyNotes, data.keyNotes || null);
    }

    if (fields.length === 0) {
      return before;
    }

    fields.push("updated_by = ?");
    values.push(userId);

    if (before.id) {
      values.push(before.id, clinicId);
      await pool.execute(
        `UPDATE client_account_profile
         SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ?`,
        values,
      );
    } else {
      await pool.execute(
        `INSERT INTO client_account_profile
          (id, clinic_id, created_by, ${fields.map((field) => field.split(" = ")[0]).join(", ")})
         VALUES (?, ?, ?, ${fields.map(() => "?").join(", ")})`,
        [profileId, clinicId, userId, ...values],
      );
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "CLIENT_ACCOUNT_PROFILE_UPDATED",
      entityType: "client_account_profile",
      entityId: profileId,
      changes,
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getProfile(clinicId);
  }

  async listServices(
    clinicId: string,
    query: ClientAccountServiceListQuery,
  ): Promise<ClientAccountServiceResponse[]> {
    const conditions = ["1 = 1"];
    const values: any[] = [];

    if (String(query.includeAllClinics) !== "true") {
      conditions.push("cas.clinic_id = ?");
      values.push(clinicId);
    }

    if (String(query.includeArchived) !== "true") {
      conditions.push("cas.archived_at IS NULL", "cas.status <> 'archived'");
    }

    if (query.status) {
      conditions.push("cas.status = ?");
      values.push(query.status);
    }

    if (query.contractStatus) {
      conditions.push("cas.contract_status = ?");
      values.push(query.contractStatus);
    }

    if (query.renewalFrom) {
      conditions.push("cas.renewal_date >= ?");
      values.push(toDateString(query.renewalFrom));
    }

    if (query.renewalTo) {
      conditions.push("cas.renewal_date <= ?");
      values.push(toDateString(query.renewalTo));
    }

    const [rows]: any = await pool.execute(
      `SELECT ${this.serviceSelectColumns()}
       FROM client_account_service cas
       JOIN client_account_profile cap ON cap.id = cas.client_account_profile_id AND cap.clinic_id = cas.clinic_id
       LEFT JOIN user owner ON owner.id = cas.owner_id AND owner.deleted_at IS NULL
       WHERE ${conditions.join(" AND ")}
       ORDER BY cas.archived_at IS NULL DESC, cas.renewal_date IS NULL ASC, cas.renewal_date ASC, cas.name ASC`,
      values,
    );

    return rows.map((row: any) => this.mapServiceRow(row));
  }

  async createService(
    clinicId: string,
    userId: string,
    data: CreateClientAccountServiceDTO,
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountServiceResponse> {
    if (data.ownerId) {
      await this.ensureAccountManagerBelongsToClinic(clinicId, data.ownerId);
    }

    const profileId = await this.ensureProfileRow(clinicId, userId);
    const serviceId = uuidv4();
    const payload = {
      serviceType: data.serviceType,
      name: data.name.trim(),
      status: data.status || "onboarding",
      startDate: toDateString(data.startDate),
      renewalDate: toDateString(data.renewalDate),
      endDate: toDateString(data.endDate),
      ownerId: data.ownerId || null,
      recurringValue: this.normalizeMoney(data.recurringValue),
      currency: (data.currency || "USD").trim().toUpperCase(),
      contractStatus: data.contractStatus || "pending",
      notes: data.notes || null,
    };

    await pool.execute(
      `INSERT INTO client_account_service
        (id, clinic_id, client_account_profile_id, service_type, name, status, start_date, renewal_date, end_date,
         owner_id, recurring_value, currency, contract_status, notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serviceId,
        clinicId,
        profileId,
        payload.serviceType,
        payload.name,
        payload.status,
        payload.startDate,
        payload.renewalDate,
        payload.endDate,
        payload.ownerId,
        payload.recurringValue,
        payload.currency,
        payload.contractStatus,
        payload.notes,
        userId,
        userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "CLIENT_ACCOUNT_SERVICE_CREATED",
      entityType: "client_account_service",
      entityId: serviceId,
      changes: payload,
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getService(clinicId, serviceId);
  }

  async updateService(
    clinicId: string,
    userId: string,
    serviceId: string,
    data: UpdateClientAccountServiceDTO,
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountServiceResponse> {
    if (ownKey(data, "ownerId") && data.ownerId) {
      await this.ensureAccountManagerBelongsToClinic(clinicId, data.ownerId);
    }

    const before = await this.getService(clinicId, serviceId);
    if (before.archivedAt || before.status === "archived") {
      throw ApiError.badRequest("Archived services cannot be updated");
    }

    const fields: string[] = [];
    const values: any[] = [];
    const changes: Record<string, { before: unknown; after: unknown }> = {};

    const addChange = (field: string, column: string, beforeValue: unknown, afterValue: unknown) => {
      if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) return;
      fields.push(`${column} = ?`);
      values.push(afterValue);
      changes[field] = { before: beforeValue, after: afterValue };
    };

    if (ownKey(data, "serviceType")) {
      addChange("serviceType", "service_type", before.serviceType, data.serviceType);
    }

    if (ownKey(data, "name") && data.name) {
      addChange("name", "name", before.name, data.name.trim());
    }

    if (ownKey(data, "status")) {
      addChange("status", "status", before.status, data.status);
    }

    if (ownKey(data, "startDate")) {
      addChange("startDate", "start_date", before.startDate, toDateString(data.startDate));
    }

    if (ownKey(data, "renewalDate")) {
      addChange("renewalDate", "renewal_date", before.renewalDate, toDateString(data.renewalDate));
    }

    if (ownKey(data, "endDate")) {
      addChange("endDate", "end_date", before.endDate, toDateString(data.endDate));
    }

    if (ownKey(data, "ownerId")) {
      addChange("ownerId", "owner_id", before.owner?.id || null, data.ownerId || null);
    }

    if (ownKey(data, "recurringValue")) {
      addChange("recurringValue", "recurring_value", before.recurringValue, this.normalizeMoney(data.recurringValue));
    }

    if (ownKey(data, "currency") && data.currency) {
      addChange("currency", "currency", before.currency, data.currency.trim().toUpperCase());
    }

    if (ownKey(data, "contractStatus")) {
      addChange("contractStatus", "contract_status", before.contractStatus, data.contractStatus);
    }

    if (ownKey(data, "notes")) {
      addChange("notes", "notes", before.notes, data.notes || null);
    }

    if (fields.length === 0) {
      return before;
    }

    fields.push("updated_by = ?");
    values.push(userId, serviceId, clinicId);

    await pool.execute(
      `UPDATE client_account_service
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND archived_at IS NULL`,
      values,
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "CLIENT_ACCOUNT_SERVICE_UPDATED",
      entityType: "client_account_service",
      entityId: serviceId,
      changes,
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getService(clinicId, serviceId);
  }

  async archiveService(
    clinicId: string,
    userId: string,
    serviceId: string,
    auditContext: ClientAccountAuditContext,
  ): Promise<void> {
    const before = await this.getService(clinicId, serviceId);
    if (before.archivedAt || before.status === "archived") {
      return;
    }

    await pool.execute(
      `UPDATE client_account_service
       SET status = 'archived', archived_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND archived_at IS NULL`,
      [userId, serviceId, clinicId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "CLIENT_ACCOUNT_SERVICE_ARCHIVED",
      entityType: "client_account_service",
      entityId: serviceId,
      changes: {
        status: { before: before.status, after: "archived" },
        archivedAt: { before: before.archivedAt, after: "CURRENT_TIMESTAMP" },
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });
  }

  private async getService(clinicId: string, serviceId: string): Promise<ClientAccountServiceResponse> {
    const [rows]: any = await pool.execute(
      `SELECT ${this.serviceSelectColumns()}
       FROM client_account_service cas
       JOIN client_account_profile cap ON cap.id = cas.client_account_profile_id AND cap.clinic_id = cas.clinic_id
       LEFT JOIN user owner ON owner.id = cas.owner_id AND owner.deleted_at IS NULL
       WHERE cas.id = ? AND cas.clinic_id = ?
       LIMIT 1`,
      [serviceId, clinicId],
    );

    if (rows.length === 0) {
      throw ApiError.notFound("Client service not found");
    }

    return this.mapServiceRow(rows[0]);
  }

  private serviceSelectColumns() {
    return `cas.id,
            cas.clinic_id as clinicId,
            cas.client_account_profile_id as clientAccountProfileId,
            cas.service_type as serviceType,
            cas.name,
            cas.status,
            cas.start_date as startDate,
            cas.renewal_date as renewalDate,
            cas.end_date as endDate,
            cas.owner_id as ownerId,
            cas.recurring_value as recurringValue,
            cas.currency,
            cas.contract_status as contractStatus,
            cas.notes,
            cas.archived_at as archivedAt,
            cas.updated_at as updatedAt,
            owner.first_name as ownerFirstName,
            owner.last_name as ownerLastName,
            owner.email as ownerEmail`;
  }

  private mapServiceRow(row: any): ClientAccountServiceResponse {
    return {
      id: row.id,
      clinicId: row.clinicId,
      clientAccountProfileId: row.clientAccountProfileId,
      serviceType: row.serviceType,
      name: row.name,
      status: row.status,
      startDate: toDateString(row.startDate),
      renewalDate: toDateString(row.renewalDate),
      endDate: toDateString(row.endDate),
      owner: row.ownerId
        ? {
            id: row.ownerId,
            firstName: row.ownerFirstName || null,
            lastName: row.ownerLastName || null,
            email: row.ownerEmail || null,
          }
        : null,
      recurringValue: row.recurringValue === null || row.recurringValue === undefined ? null : Number(row.recurringValue),
      currency: row.currency,
      contractStatus: row.contractStatus,
      notes: row.notes || null,
      archivedAt: toIsoString(row.archivedAt),
      updatedAt: toIsoString(row.updatedAt),
    };
  }

  private async getAccountSummary(clinicId: string): Promise<ClientAccountSummaryResponse> {
    const profile = await this.getProfile(clinicId);
    return {
      ...profile,
      activeServiceCount: 0,
      renewalRiskCount: 0,
      pendingTaskCount: 0,
      overdueTaskCount: 0,
      qaTaskCount: 0,
      missedTaskCount: 0,
      escalatedTaskCount: 0,
      lastStrategyLogAt: null,
      actionPlanId: null,
      actionPlanMonth: null,
      actionPlanStatus: null,
      actionPlanTotalItems: 0,
      actionPlanCompletedItems: 0,
      actionPlanOpenItems: 0,
      actionPlanHighPriorityOpenItems: 0,
      actionPlanProgressPercent: 0,
      actionPlanLastUpdatedAt: null,
    };
  }

  private mapAccountSummaryRow(row: any): ClientAccountSummaryResponse {
    const profileServices = parseServices(row.activeServices);
    const derivedServices = row.derivedActiveServices
      ? String(row.derivedActiveServices).split(",").filter(Boolean)
      : [];

    return {
      id: row.id || null,
      clinicId: row.clinicId,
      clinicName: row.clinicName,
      email: row.email || null,
      phone: row.phone || null,
      website: row.website || null,
      address: row.address || null,
      city: row.city || null,
      state: row.state || null,
      postalCode: row.postalCode || null,
      country: row.country || null,
      accountManager: row.accountManagerId
        ? {
            id: row.accountManagerId,
            firstName: row.accountManagerFirstName || null,
            lastName: row.accountManagerLastName || null,
            email: row.accountManagerEmail || null,
          }
        : null,
      activeServices: profileServices.length > 0 ? profileServices : derivedServices,
      onboardingStatus: row.onboardingStatus || DEFAULT_PROFILE.onboardingStatus,
      healthStatus: row.healthStatus || DEFAULT_PROFILE.healthStatus,
      clientStatus: row.clientStatus || DEFAULT_PROFILE.clientStatus,
      currentPackage: row.currentPackage || DEFAULT_PROFILE.currentPackage,
      churnRisk: row.churnRisk || DEFAULT_PROFILE.churnRisk,
      renewalDate: toDateString(row.renewalDate),
      contractStatus: row.contractStatus || DEFAULT_PROFILE.contractStatus,
      keyNotes: row.keyNotes || null,
      googleDriveFolderId: row.googleDriveFolderId || null,
      googleDriveFolderUrl: row.googleDriveFolderUrl || null,
      googleDriveFolderName: row.googleDriveFolderName || null,
      googleDriveFolderAccessStatus: row.googleDriveFolderAccessStatus || "not_checked",
      googleDriveFolderError: row.googleDriveFolderError || null,
      googleDriveFolderCheckedAt: toIsoString(row.googleDriveFolderCheckedAt),
      updatedAt: toIsoString(row.updatedAt || row.clinicUpdatedAt),
      activeServiceCount: Number(row.activeServiceCount || 0),
      renewalRiskCount: Number(row.renewalRiskCount || 0),
      pendingTaskCount: Number(row.pendingTaskCount || 0),
      overdueTaskCount: Number(row.overdueTaskCount || 0),
      qaTaskCount: Number(row.qaTaskCount || 0),
      missedTaskCount: Number(row.missedTaskCount || 0),
      escalatedTaskCount: Number(row.escalatedTaskCount || 0),
      lastStrategyLogAt: toIsoString(row.lastStrategyLogAt),
      actionPlanId: row.actionPlanId || null,
      actionPlanMonth: row.actionPlanMonth || null,
      actionPlanStatus: row.actionPlanStatus || null,
      actionPlanTotalItems: Number(row.actionPlanTotalItems || 0),
      actionPlanCompletedItems: Number(row.actionPlanCompletedItems || 0),
      actionPlanOpenItems: Number(row.actionPlanOpenItems || 0),
      actionPlanHighPriorityOpenItems: Number(row.actionPlanHighPriorityOpenItems || 0),
      actionPlanProgressPercent: this.calculatePercent(row.actionPlanCompletedItems, row.actionPlanTotalItems),
      actionPlanLastUpdatedAt: toIsoString(row.actionPlanLastUpdatedAt),
    };
  }

  private calculatePercent(numerator: unknown, denominator: unknown) {
    const total = Number(denominator || 0);
    if (total <= 0) return 0;
    return Math.round((Number(numerator || 0) / total) * 100);
  }

  private normalizeMoney(value: number | string | null | undefined) {
    if (value === null || value === undefined || value === "") return null;
    return Number(value).toFixed(2);
  }

  private normalizeAccountPayload(data: CreateClientAccountDTO) {
    return {
      name: data.name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      website: data.website?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      postalCode: data.postalCode?.trim() || null,
      country: data.country?.trim() || "UK",
      accountManagerId: data.accountManagerId || null,
      activeServices: normalizeServices(data.activeServices || []),
      onboardingStatus: data.onboardingStatus || DEFAULT_PROFILE.onboardingStatus,
      healthStatus: data.healthStatus || DEFAULT_PROFILE.healthStatus,
      clientStatus: data.clientStatus || "onboarding",
      currentPackage: data.currentPackage?.trim() || null,
      churnRisk: data.churnRisk || DEFAULT_PROFILE.churnRisk,
      renewalDate: toDateString(data.renewalDate),
      contractStatus: data.contractStatus || DEFAULT_PROFILE.contractStatus,
      keyNotes: data.keyNotes?.trim() || null,
    };
  }

  private async ensureClientAccountAvailableToWorkspace(
    sourceClinicId: string,
    clientClinicId: string,
    access: { canManageAllClientAccounts: boolean },
  ) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM clinic
       WHERE id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clientClinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Client account not found");

    if (sourceClinicId === clientClinicId) return;
    if (access.canManageAllClientAccounts) return;

    throw ApiError.forbidden("Client account is not available to this workspace");
  }

  private async checkGoogleDriveItemAccess(folderId: string, kindHint: GoogleDriveItemKind): Promise<{
    name: string | null;
    itemType: "folder" | "zip" | null;
    status: "not_checked" | "accessible" | "inaccessible";
    error: string | null;
    checkedAt: string | null;
  }> {
    if (!config.googleDrive.validationEnabled) {
      throw ApiError.serviceUnavailable("Google Drive validation must be enabled before Drive links can be saved.");
    }

    const accessToken = await this.getGoogleDriveAccessToken();
    const checkedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,trashed&supportsAllDrives=true`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        },
      );
      const payload: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload.error?.message || "Google Drive item is inaccessible to the configured account.";
        throw ApiError.badRequest(message);
      }

      const isFolder = payload.mimeType === "application/vnd.google-apps.folder";
      const isZip =
        ["application/zip", "application/x-zip", "application/x-zip-compressed"].includes(String(payload.mimeType || "")) ||
        (String(payload.mimeType || "") === "application/octet-stream" && String(payload.name || "").toLowerCase().endsWith(".zip")) ||
        String(payload.name || "").toLowerCase().endsWith(".zip");

      if (!isFolder && !isZip) {
        throw ApiError.badRequest("Google Drive link must point to a folder or ZIP file.");
      }

      if (payload.trashed) {
        throw ApiError.badRequest("Google Drive item is in trash and cannot be linked.");
      }

      return {
        name: payload.name || null,
        itemType: isZip ? "zip" : "folder",
        status: "accessible",
        error: null,
        checkedAt,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.serviceUnavailable("Google Drive item access could not be checked. Try again or check the Google credentials.");
    }
  }

  private async getGoogleDriveAccessToken() {
    if (
      this.googleDriveTokenCache &&
      this.googleDriveTokenCache.expiresAt > Date.now() + 60_000
    ) {
      return this.googleDriveTokenCache.token;
    }

    const tokenPayload = config.googleDrive.refreshToken
      ? await this.refreshGoogleDriveOAuthToken()
      : await this.fetchGoogleDriveServiceAccountToken();

    this.googleDriveTokenCache = {
      token: tokenPayload.accessToken,
      expiresAt: Date.now() + Math.max(tokenPayload.expiresInSeconds - 60, 60) * 1000,
    };

    return tokenPayload.accessToken;
  }

  private async refreshGoogleDriveOAuthToken() {
    if (!config.oauth.google.clientId || !config.oauth.google.clientSecret) {
      throw ApiError.serviceUnavailable("Google Drive OAuth refresh requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.oauth.google.clientId,
        client_secret: config.oauth.google.clientSecret,
        refresh_token: config.googleDrive.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw ApiError.serviceUnavailable(payload.error_description || payload.error || "Google Drive OAuth token refresh failed.");
    }

    return {
      accessToken: String(payload.access_token),
      expiresInSeconds: Number(payload.expires_in || 3600),
    };
  }

  private async fetchGoogleDriveServiceAccountToken() {
    if (!config.googleDrive.serviceAccountEmail || !config.googleDrive.serviceAccountPrivateKey) {
      throw ApiError.serviceUnavailable("Google Drive validation requires GOOGLE_DRIVE_REFRESH_TOKEN or service-account credentials.");
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const claimSet: Record<string, unknown> = {
      iss: config.googleDrive.serviceAccountEmail,
      scope: config.googleDrive.scopes.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };
    if (config.googleDrive.serviceAccountSubject) {
      claimSet.sub = config.googleDrive.serviceAccountSubject;
    }

    const jwtUnsigned = [
      Buffer.from(JSON.stringify(header)).toString("base64url"),
      Buffer.from(JSON.stringify(claimSet)).toString("base64url"),
    ].join(".");
    const signature = crypto
      .createSign("RSA-SHA256")
      .update(jwtUnsigned)
      .sign(config.googleDrive.serviceAccountPrivateKey, "base64url");
    const assertion = `${jwtUnsigned}.${signature}`;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw ApiError.serviceUnavailable(payload.error_description || payload.error || "Google Drive service-account token request failed.");
    }

    return {
      accessToken: String(payload.access_token),
      expiresInSeconds: Number(payload.expires_in || 3600),
    };
  }

  private async listLinkedContacts(sourceClinicId: string, accountName: string): Promise<ClientAccountLinkedContactResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT id,
              account_name as accountName,
              contact_role as role,
              first_name as firstName,
              last_name as lastName,
              email,
              phone,
              role_title as roleTitle,
              website,
              status,
              lead_status as leadStatus,
              source,
              updated_at as updatedAt
       FROM contact
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND LOWER(COALESCE(account_name, '')) = LOWER(?)
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 100`,
      [sourceClinicId, accountName],
    );

    return rows.map((row: any) => ({
      id: row.id,
      name: contactDisplayName(row),
      accountName: row.accountName || null,
      role: row.role || null,
      roleTitle: row.roleTitle || null,
      email: row.email || null,
      phone: row.phone || null,
      website: row.website || null,
      source: row.source || null,
      status: row.status || "lead",
      leadStatus: row.leadStatus || "new",
      updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
    }));
  }

  private async listLinkedTasks(sourceClinicId: string, clientAccountProfileId: string): Promise<ClientAccountLinkedTaskResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT id,
              title,
              status,
              priority,
              category,
              contact_id as contactId,
              contact_name as contact,
              due_label as due,
              DATE_FORMAT(due_date, '%Y-%m-%d') as dueDate,
              assigned_to as assignedTo,
              (status <> 'completed' AND due_date < CURRENT_DATE) as isOverdue,
              client_account_profile_id as clientAccountProfileId,
              client_account_service_id as clientAccountServiceId,
              updated_at as updatedAt
       FROM task
       WHERE clinic_id = ?
         AND is_internal = 1
         AND deleted_at IS NULL
         AND archived_at IS NULL
         AND client_account_profile_id = ?
       ORDER BY status ASC, due_date IS NULL ASC, due_date ASC, updated_at DESC
       LIMIT 200`,
      [sourceClinicId, clientAccountProfileId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      category: row.category || null,
      contactId: row.contactId || null,
      contact: row.contact || null,
      due: row.due || null,
      dueDate: row.dueDate || null,
      assignedTo: row.assignedTo || null,
      isOverdue: Boolean(row.isOverdue),
      clientAccountProfileId: row.clientAccountProfileId || null,
      clientAccountServiceId: row.clientAccountServiceId || null,
      updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
    }));
  }

  private async getWorkspaceContact(sourceClinicId: string, contactId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              account_name as accountName
       FROM contact
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [contactId, sourceClinicId],
    );

    if (rows.length === 0) {
      throw ApiError.badRequest("Contact must belong to this workspace");
    }

    return {
      id: rows[0].id,
      accountName: rows[0].accountName || null,
    };
  }

  private async ensureProfileRow(clinicId: string, userId: string) {
    const existing = await this.getProfile(clinicId);
    if (existing.id) return existing.id;

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO client_account_profile (id, clinic_id, active_services, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?)`,
      [id, clinicId, JSON.stringify([]), userId, userId],
    );

    return id;
  }

  private async ensureAccountManagerBelongsToClinic(clinicId: string, userId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM user
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
         AND status = 'active'
         AND is_active = 1
       LIMIT 1`,
      [userId, clinicId],
    );

    if (rows.length === 0) {
      throw ApiError.badRequest("Account manager must be an active user in this clinic");
    }
  }

  private async ensureActiveInternalUser(userId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM user
       WHERE id = ?
         AND deleted_at IS NULL
         AND status = 'active'
         AND is_active = 1
       LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) {
      throw ApiError.badRequest("Account manager must be an active internal user");
    }
  }
}

export const clientAccountsService = new ClientAccountsService();
