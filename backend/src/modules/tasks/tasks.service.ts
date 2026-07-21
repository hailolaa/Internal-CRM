import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import {
  CreateInternalTaskDTO,
  CreateTaskDTO,
  InternalTaskListQuery,
  TaskResponse,
  UpdateInternalTaskDTO,
  UpdateInternalTaskQaDTO,
  UpdateTaskDTO,
} from "./tasks.types.js";

function mapTask(row: any): TaskResponse {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    category: row.category,
    contactId: row.contactId || null,
    contact: row.contactName,
    due: row.dueLabel,
    dueDate: row.dueDate || null,
    assignedTo: row.assignedTo,
    isInternal: Boolean(row.isInternal),
    boardKey: row.boardKey || null,
    serviceType: row.serviceType || null,
    clientAccountProfileId: row.clientAccountProfileId || null,
    clientAccountServiceId: row.clientAccountServiceId || null,
    assignedUserId: row.assignedUserId || null,
    proofReference: row.proofReference || null,
    workflowMonth: row.workflowMonth || null,
    templateKey: row.templateKey || null,
    recurrenceRule: parseJson(row.recurrenceRule),
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
    isOverdue: Boolean(row.isOverdue),
    needsQa: Boolean(row.needsQa),
    qaChecklist: parseJson(row.qaChecklist),
    approvalStatus: row.approvalStatus || "not_required",
    reviewerUserId: row.reviewerUserId || null,
    completionProofReference: row.completionProofReference || null,
    missedTask: Boolean(row.missedTask),
    escalationFlag: Boolean(row.escalationFlag),
    freelancerTeamScore: row.freelancerTeamScore === null || row.freelancerTeamScore === undefined ? null : Number(row.freelancerTeamScore),
    qaUpdatedAt: row.qaUpdatedAt ? new Date(row.qaUpdatedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function parseJson(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;

  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function ownKey<T extends object>(data: T, key: keyof T) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function toDateString(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function addMonthsDateOnly(value: unknown, months: number, dayOverride?: number) {
  const date = value instanceof Date ? value : new Date(String(value));
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const requestedDay = dayOverride || date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(requestedDay, lastDay);
  return new Date(Date.UTC(year, month, day));
}

function addDaysDateOnly(value: unknown, days: number) {
  const date = value instanceof Date ? value : new Date(String(value));
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export class TasksService {
  // List active clinic tasks for lightweight follow-up workflows
  async listTasks(clinicId: string): Promise<TaskResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT id, title, description, priority, status, category,
              contact_id as contactId,
              contact_name as contactName, due_label as dueLabel,
              DATE_FORMAT(due_date, '%Y-%m-%d') as dueDate,
              assigned_to as assignedTo,
              is_internal as isInternal,
              created_at as createdAt, updated_at as updatedAt
       FROM task
       WHERE clinic_id = ? AND is_internal = 0 AND deleted_at IS NULL
       ORDER BY status ASC, due_date IS NULL ASC, due_date ASC, created_at DESC`,
      [clinicId],
    );

    return rows.map(mapTask);
  }

  // Create standalone tasks without binding into the future contact module
  async createTask(clinicId: string, userId: string, data: CreateTaskDTO): Promise<string> {
    const id = uuidv4();
    const linkedContact = await this.resolveTaskContact(clinicId, data.contactId, data.contact);
    await pool.execute(
      `INSERT INTO task
        (id, clinic_id, title, description, priority, status, category,
         contact_id, contact_name, due_label, due_date, assigned_to, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.title,
        data.description || null,
        data.priority || "medium",
        data.status || "pending",
        data.category || null,
        linkedContact.contactId,
        linkedContact.contactName,
        data.due || null,
        data.dueDate || null,
        data.assignedTo || null,
        userId,
      ],
    );

    await logAuditEvent({ clinicId, userId, action: "TASK_CREATED", entityType: "task", entityId: id, changes: { ...data } });
    return id;
  }

  // Update task metadata or completion status
  async updateTask(clinicId: string, userId: string, taskId: string, data: UpdateTaskDTO): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    const mapping: Record<string, string> = {
      title: "title",
      description: "description",
      priority: "priority",
      status: "status",
      category: "category",
      contact: "contact_name",
      due: "due_label",
      dueDate: "due_date",
      assignedTo: "assigned_to",
    };

    if (ownKey(data, "contactId")) {
      const linkedContact = await this.resolveTaskContact(clinicId, data.contactId, data.contact);
      fields.push("contact_id = ?");
      values.push(linkedContact.contactId);

      if (!ownKey(data, "contact")) {
        fields.push("contact_name = ?");
        values.push(linkedContact.contactName);
      }
    }

    Object.entries(data).forEach(([key, value]) => {
      if (mapping[key]) {
        fields.push(`${mapping[key]} = ?`);
        values.push(value ?? null);
      }
    });

    if (fields.length === 0) return;
    values.push(taskId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE task SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND is_internal = 0 AND deleted_at IS NULL`,
      values,
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Task not found");
    await logAuditEvent({ clinicId, userId, action: "TASK_UPDATED", entityType: "task", entityId: taskId, changes: { ...data } });
  }

  // Soft delete tasks so audit history stays intact
  async deleteTask(clinicId: string, userId: string, taskId: string): Promise<void> {
    const [result]: any = await pool.execute(
      "UPDATE task SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND is_internal = 0 AND deleted_at IS NULL",
      [taskId, clinicId],
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Task not found");
    await logAuditEvent({ clinicId, userId, action: "TASK_DELETED", entityType: "task", entityId: taskId });
  }

  async listInternalTasks(
    clinicId: string,
    query: InternalTaskListQuery,
    access: { canManageAllClientAccounts: boolean } = { canManageAllClientAccounts: false },
  ): Promise<TaskResponse[]> {
    const conditions = ["clinic_id = ?", "is_internal = 1", "deleted_at IS NULL"];
    const values: any[] = [clinicId];

    if (String(query.includeArchived) !== "true") {
      conditions.push("archived_at IS NULL");
    }

    if (query.boardKey) {
      conditions.push("board_key = ?");
      values.push(query.boardKey);
    }

    if (query.serviceType) {
      conditions.push("service_type = ?");
      values.push(query.serviceType);
    }

    if (query.clientAccountProfileId) {
      await this.ensureClientAccountProfileAvailable(clinicId, query.clientAccountProfileId, access);
      conditions.push("client_account_profile_id = ?");
      values.push(query.clientAccountProfileId);
    }

    if (query.clientAccountServiceId) {
      await this.ensureClientAccountServiceAvailable(clinicId, query.clientAccountServiceId, access);
      conditions.push("client_account_service_id = ?");
      values.push(query.clientAccountServiceId);
    }

    if (query.assignedUserId) {
      conditions.push("assigned_user_id = ?");
      values.push(query.assignedUserId);
    }

    if (query.status) {
      conditions.push("status = ?");
      values.push(query.status);
    }

    if (String(query.completed) === "true") {
      conditions.push("status = 'completed'");
    } else if (String(query.completed) === "false") {
      conditions.push("status <> 'completed'");
    }

    if (String(query.needsQa) === "true") {
      conditions.push("needs_qa = 1");
    } else if (String(query.needsQa) === "false") {
      conditions.push("needs_qa = 0");
    }

    if (query.approvalStatus) {
      conditions.push("approval_status = ?");
      values.push(query.approvalStatus);
    }

    if (String(query.missedTask) === "true") {
      conditions.push("missed_task = 1");
    } else if (String(query.missedTask) === "false") {
      conditions.push("missed_task = 0");
    }

    if (String(query.escalationFlag) === "true") {
      conditions.push("escalation_flag = 1");
    } else if (String(query.escalationFlag) === "false") {
      conditions.push("escalation_flag = 0");
    }

    if (String(query.overdue) === "true") {
      conditions.push("status <> 'completed'", "due_date < CURRENT_DATE");
    } else if (String(query.overdue) === "false") {
      conditions.push("(due_date IS NULL OR due_date >= CURRENT_DATE OR status = 'completed')");
    }

    if (query.workflowMonth) {
      conditions.push("workflow_month = ?");
      values.push(toDateString(query.workflowMonth));
    }

    const [rows]: any = await pool.execute(
      `SELECT ${this.taskSelectColumns()}
       FROM task
       WHERE ${conditions.join(" AND ")}
       ORDER BY status ASC, due_date IS NULL ASC, due_date ASC, priority DESC, created_at DESC`,
      values,
    );

    return rows.map(mapTask);
  }

  async createInternalTask(
    clinicId: string,
    userId: string,
    data: CreateInternalTaskDTO,
    access: { canManageAllClientAccounts: boolean } = { canManageAllClientAccounts: false },
  ): Promise<string> {
    const links = await this.resolveInternalTaskLinks(clinicId, data.clientAccountProfileId, data.clientAccountServiceId, access);
    const linkedContact = await this.resolveTaskContact(clinicId, data.contactId, data.contact);
    if (data.assignedUserId) {
      await this.ensureActiveUserInClinic(clinicId, data.assignedUserId);
    }

    const id = uuidv4();
    const status = data.status || "pending";
    await pool.execute(
      `INSERT INTO task
        (id, clinic_id, is_internal, title, description, priority, status, category, board_key, service_type,
         client_account_profile_id, client_account_service_id, contact_id, contact_name, due_label, due_date, assigned_to,
         assigned_user_id, proof_reference, workflow_month, template_key, recurrence_rule, completed_at, created_by)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.title,
        data.description || null,
        data.priority || "medium",
        status,
        data.category || null,
        data.boardKey,
        data.serviceType || null,
        links.clientAccountProfileId,
        links.clientAccountServiceId,
        linkedContact.contactId,
        linkedContact.contactName,
        data.due || null,
        toDateString(data.dueDate),
        data.assignedTo || null,
        data.assignedUserId || null,
        data.proofReference || null,
        toDateString(data.workflowMonth),
        data.templateKey || null,
        data.recurrenceRule ? JSON.stringify(data.recurrenceRule) : null,
        status === "completed" ? new Date() : null,
        userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "INTERNAL_TASK_CREATED",
      entityType: "task",
      entityId: id,
      changes: { ...data, clientAccountProfileId: links.clientAccountProfileId, clientAccountServiceId: links.clientAccountServiceId },
    });

    return id;
  }

  async updateInternalTask(
    clinicId: string,
    userId: string,
    taskId: string,
    data: UpdateInternalTaskDTO,
    access: { canManageAllClientAccounts: boolean } = { canManageAllClientAccounts: false },
  ): Promise<void> {
    await this.ensureInternalTaskExists(clinicId, taskId, false);

    const fields: string[] = [];
    const values: any[] = [];
    const mapping: Record<string, string> = {
      title: "title",
      description: "description",
      priority: "priority",
      status: "status",
      category: "category",
      contact: "contact_name",
      due: "due_label",
      assignedTo: "assigned_to",
      boardKey: "board_key",
      serviceType: "service_type",
      assignedUserId: "assigned_user_id",
      proofReference: "proof_reference",
      templateKey: "template_key",
    };

    if (ownKey(data, "contactId")) {
      const linkedContact = await this.resolveTaskContact(clinicId, data.contactId, data.contact);
      fields.push("contact_id = ?");
      values.push(linkedContact.contactId);

      if (!ownKey(data, "contact")) {
        fields.push("contact_name = ?");
        values.push(linkedContact.contactName);
      }
    }

    if (ownKey(data, "clientAccountProfileId") || ownKey(data, "clientAccountServiceId")) {
      const links = await this.resolveInternalTaskLinks(clinicId, data.clientAccountProfileId, data.clientAccountServiceId, access);
      fields.push("client_account_profile_id = ?", "client_account_service_id = ?");
      values.push(links.clientAccountProfileId, links.clientAccountServiceId);
    }

    if (ownKey(data, "assignedUserId") && data.assignedUserId) {
      await this.ensureActiveUserInClinic(clinicId, data.assignedUserId);
    }

    Object.entries(data).forEach(([key, value]) => {
      if (mapping[key]) {
        fields.push(`${mapping[key]} = ?`);
        values.push(value ?? null);
      }
    });

    if (ownKey(data, "dueDate")) {
      fields.push("due_date = ?");
      values.push(toDateString(data.dueDate));
    }

    if (ownKey(data, "workflowMonth")) {
      fields.push("workflow_month = ?");
      values.push(toDateString(data.workflowMonth));
    }

    if (ownKey(data, "recurrenceRule")) {
      fields.push("recurrence_rule = ?");
      values.push(data.recurrenceRule ? JSON.stringify(data.recurrenceRule) : null);
    }

    if (ownKey(data, "status")) {
      fields.push("completed_at = ?");
      values.push(data.status === "completed" ? new Date() : null);
    }

    if (fields.length === 0) return;
    values.push(taskId, clinicId);

    const [result]: any = await pool.execute(
      `UPDATE task SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND is_internal = 1 AND archived_at IS NULL AND deleted_at IS NULL`,
      values,
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Internal task not found");
    await logAuditEvent({ clinicId, userId, action: "INTERNAL_TASK_UPDATED", entityType: "task", entityId: taskId, changes: { ...data } });

    if (data.status === "completed") {
      try {
        await this.generateNextOccurrence(taskId);
      } catch (error: any) {
        // Log recurrence generation error but do not fail the task update itself
      }
    }
  }

  async archiveInternalTask(clinicId: string, userId: string, taskId: string): Promise<void> {
    await this.ensureInternalTaskExists(clinicId, taskId, false);

    const [result]: any = await pool.execute(
      `UPDATE task SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND is_internal = 1 AND archived_at IS NULL AND deleted_at IS NULL`,
      [taskId, clinicId],
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Internal task not found");
    await logAuditEvent({ clinicId, userId, action: "INTERNAL_TASK_ARCHIVED", entityType: "task", entityId: taskId });
  }

  async updateInternalTaskQa(clinicId: string, userId: string, taskId: string, data: UpdateInternalTaskQaDTO): Promise<void> {
    await this.ensureInternalTaskExists(clinicId, taskId, false);

    if (ownKey(data, "reviewerUserId") && data.reviewerUserId) {
      await this.ensureActiveUserInClinic(clinicId, data.reviewerUserId);
    }

    const fields: string[] = [];
    const values: any[] = [];
    const mapping: Record<string, string> = {
      needsQa: "needs_qa",
      approvalStatus: "approval_status",
      reviewerUserId: "reviewer_user_id",
      completionProofReference: "completion_proof_reference",
      missedTask: "missed_task",
      escalationFlag: "escalation_flag",
      freelancerTeamScore: "freelancer_team_score",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (mapping[key]) {
        fields.push(`${mapping[key]} = ?`);
        values.push(value ?? null);
      }
    });

    if (ownKey(data, "qaChecklist")) {
      fields.push("qa_checklist = ?");
      values.push(data.qaChecklist ? JSON.stringify(data.qaChecklist) : null);
    }

    if (fields.length === 0) return;

    fields.push("qa_updated_at = CURRENT_TIMESTAMP");
    values.push(taskId, clinicId);

    const [result]: any = await pool.execute(
      `UPDATE task SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND is_internal = 1 AND archived_at IS NULL AND deleted_at IS NULL`,
      values,
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Internal task not found");
    await logAuditEvent({ clinicId, userId, action: "INTERNAL_TASK_QA_UPDATED", entityType: "task", entityId: taskId, changes: { ...data } });

    if (data.approvalStatus === "approved") {
      try {
        await this.generateNextOccurrence(taskId);
      } catch (error: any) {
        // Log recurrence generation error but do not fail the QA update itself
      }
    }
  }

  private taskSelectColumns() {
    return `id, title, description, priority, status, category,
            contact_name as contactName,
            contact_id as contactId,
            due_label as dueLabel,
            DATE_FORMAT(due_date, '%Y-%m-%d') as dueDate,
            assigned_to as assignedTo,
            is_internal as isInternal,
            board_key as boardKey,
            service_type as serviceType,
            client_account_profile_id as clientAccountProfileId,
            client_account_service_id as clientAccountServiceId,
            assigned_user_id as assignedUserId,
            proof_reference as proofReference,
            DATE_FORMAT(workflow_month, '%Y-%m-%d') as workflowMonth,
            template_key as templateKey,
            recurrence_rule as recurrenceRule,
            completed_at as completedAt,
            archived_at as archivedAt,
            (status <> 'completed' AND due_date < CURRENT_DATE) as isOverdue,
            needs_qa as needsQa,
            qa_checklist as qaChecklist,
            approval_status as approvalStatus,
            reviewer_user_id as reviewerUserId,
            completion_proof_reference as completionProofReference,
            missed_task as missedTask,
            escalation_flag as escalationFlag,
            freelancer_team_score as freelancerTeamScore,
            qa_updated_at as qaUpdatedAt,
            created_at as createdAt,
            updated_at as updatedAt`;
  }

  private async ensureInternalTaskExists(clinicId: string, taskId: string, includeArchived: boolean) {
    const archivedClause = includeArchived ? "" : "AND archived_at IS NULL";
    const [rows]: any = await pool.execute(
      `SELECT id FROM task
       WHERE id = ? AND clinic_id = ? AND is_internal = 1 AND deleted_at IS NULL ${archivedClause}
       LIMIT 1`,
      [taskId, clinicId],
    );

    if (rows.length === 0) throw ApiError.notFound("Internal task not found");
  }

  private async resolveInternalTaskLinks(
    clinicId: string,
    clientAccountProfileId?: string | null,
    clientAccountServiceId?: string | null,
    access: { canManageAllClientAccounts: boolean } = { canManageAllClientAccounts: false },
  ) {
    let resolvedProfileId = clientAccountProfileId || null;
    const resolvedServiceId = clientAccountServiceId || null;

    if (resolvedServiceId) {
      const service = await this.ensureClientAccountServiceAvailable(clinicId, resolvedServiceId, access);
      if (resolvedProfileId && resolvedProfileId !== service.profileId) {
        throw ApiError.badRequest("Client account profile and service do not match");
      }
      resolvedProfileId = service.profileId;
    }

    if (resolvedProfileId) {
      await this.ensureClientAccountProfileAvailable(clinicId, resolvedProfileId, access);
    }

    return { clientAccountProfileId: resolvedProfileId, clientAccountServiceId: resolvedServiceId };
  }

  private async ensureClientAccountProfileAvailable(
    sourceClinicId: string,
    clientAccountProfileId: string,
    access: { canManageAllClientAccounts: boolean },
  ) {
    const [rows]: any = await pool.execute(
      `SELECT cap.id, cap.clinic_id as clientClinicId
       FROM client_account_profile cap
       JOIN clinic c
         ON c.id = cap.clinic_id
        AND c.deleted_at IS NULL
       WHERE cap.id = ?
       LIMIT 1`,
      [clientAccountProfileId],
    );
    if (rows.length === 0) throw ApiError.badRequest("Client account profile is not available");
    if (rows[0].clientClinicId !== sourceClinicId && !access.canManageAllClientAccounts) {
      throw ApiError.forbidden("Client account profile is not available to this workspace");
    }
    return { id: rows[0].id, clientClinicId: rows[0].clientClinicId };
  }

  private async ensureClientAccountServiceAvailable(
    sourceClinicId: string,
    clientAccountServiceId: string,
    access: { canManageAllClientAccounts: boolean },
  ) {
    const [rows]: any = await pool.execute(
      `SELECT cas.id,
              cas.client_account_profile_id as profileId,
              cas.clinic_id as clientClinicId
       FROM client_account_service cas
       JOIN client_account_profile cap
         ON cap.id = cas.client_account_profile_id
        AND cap.clinic_id = cas.clinic_id
       JOIN clinic c
         ON c.id = cas.clinic_id
        AND c.deleted_at IS NULL
       WHERE cas.id = ?
         AND cas.archived_at IS NULL
       LIMIT 1`,
      [clientAccountServiceId],
    );
    if (rows.length === 0) throw ApiError.badRequest("Client account service is not available");
    if (rows[0].clientClinicId !== sourceClinicId && !access.canManageAllClientAccounts) {
      throw ApiError.forbidden("Client account service is not available to this workspace");
    }
    return {
      id: rows[0].id,
      profileId: rows[0].profileId,
      clientClinicId: rows[0].clientClinicId,
    };
  }

  private async resolveTaskContact(
    clinicId: string,
    contactId?: string | null,
    contactName?: string | null,
  ) {
    const fallbackName = contactName?.trim() || null;
    if (!contactId) return { contactId: null, contactName: fallbackName };

    const [rows]: any = await pool.execute(
      `SELECT id,
              NULLIF(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))), '') as name,
              email,
              phone
       FROM contact
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [contactId, clinicId],
    );

    if (rows.length === 0) throw ApiError.badRequest("Prospect/contact must belong to this workspace");

    return {
      contactId,
      contactName: fallbackName || rows[0].name || rows[0].email || rows[0].phone || "Linked prospect",
    };
  }

  private async ensureActiveUserInClinic(clinicId: string, userId: string) {
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

    if (rows.length === 0) throw ApiError.badRequest("Assigned user must be active in this workspace");
  }

  async generateNextOccurrence(taskId: string): Promise<string | null> {
    const [rows]: any = await pool.execute(
      `SELECT * FROM task WHERE id = ? AND is_internal = 1 AND deleted_at IS NULL AND archived_at IS NULL LIMIT 1`,
      [taskId]
    );
    if (rows.length === 0) return null;
    const task = rows[0];

    const rule = parseJson(task.recurrence_rule);
    if (!rule || !rule.frequency) return null;

    const frequency = String(rule.frequency).toLowerCase();
    const interval = Number(rule.interval || 1);

    if (frequency !== "monthly" && frequency !== "weekly") {
      return null;
    }

    let nextWorkflowMonth: Date | null = null;
    if (task.workflow_month) {
      if (frequency === "monthly") {
        nextWorkflowMonth = addMonthsDateOnly(task.workflow_month, interval, 1);
      } else if (frequency === "weekly") {
        nextWorkflowMonth = addDaysDateOnly(task.workflow_month, interval * 7);
      }
    }

    let nextDueDate: Date | null = null;
    if (task.due_date) {
      if (frequency === "monthly") {
        nextDueDate = addMonthsDateOnly(task.due_date, interval);
      } else if (frequency === "weekly") {
        nextDueDate = addDaysDateOnly(task.due_date, interval * 7);
      }
    }

    if (!nextWorkflowMonth) {
      return null;
    }

    const nextWorkflowMonthStr = toDateString(nextWorkflowMonth);
    const nextDueDateStr = nextDueDate ? toDateString(nextDueDate) : null;

    const profileId = task.client_account_profile_id || null;
    const serviceId = task.client_account_service_id || null;
    const templateKey = task.template_key || null;
    const title = task.title;

    let existingCheckQuery = `
      SELECT id FROM task 
      WHERE clinic_id = ? 
        AND is_internal = 1 
        AND deleted_at IS NULL
        AND workflow_month = ?
    `;
    const checkParams: any[] = [task.clinic_id, nextWorkflowMonthStr];

    if (templateKey) {
      existingCheckQuery += " AND template_key = ?";
      checkParams.push(templateKey);
    } else {
      existingCheckQuery += " AND title = ?";
      checkParams.push(title);
    }

    if (profileId) {
      existingCheckQuery += " AND client_account_profile_id = ?";
      checkParams.push(profileId);
    } else {
      existingCheckQuery += " AND client_account_profile_id IS NULL";
    }

    if (serviceId) {
      existingCheckQuery += " AND client_account_service_id = ?";
      checkParams.push(serviceId);
    } else {
      existingCheckQuery += " AND client_account_service_id IS NULL";
    }

    const [existingRows]: any = await pool.execute(existingCheckQuery, checkParams);
    if (existingRows.length > 0) {
      return null;
    }

    const nextId = uuidv4();
    await pool.execute(
      `INSERT INTO task
        (id, clinic_id, is_internal, title, description, priority, status, category, board_key, service_type,
         client_account_profile_id, client_account_service_id, contact_id, contact_name, due_label, due_date, assigned_to,
         assigned_user_id, template_key, recurrence_rule, workflow_month, needs_qa, qa_checklist, created_by)
       VALUES (?, ?, 1, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nextId,
        task.clinic_id,
        title,
        task.description || null,
        task.priority || "medium",
        task.category || null,
        task.board_key || null,
        task.service_type || null,
        profileId,
        serviceId,
        task.contact_id || null,
        task.contact_name || null,
        task.due_label || null,
        nextDueDateStr,
        task.assigned_to || null,
        task.assigned_user_id || null,
        templateKey,
        task.recurrence_rule ? JSON.stringify(task.recurrence_rule) : null,
        nextWorkflowMonthStr,
        task.needs_qa || 0,
        task.qa_checklist ? JSON.stringify(task.qa_checklist) : null,
        task.created_by || null,
      ],
    );

    await logAuditEvent({
      clinicId: task.clinic_id,
      userId: task.created_by || "system",
      action: "INTERNAL_TASK_RECURRENCE_GENERATED",
      entityType: "task",
      entityId: nextId,
      changes: {
        title,
        isRecurringOccurrence: true,
        previousTaskId: task.id,
        workflowMonth: nextWorkflowMonthStr,
      },
    });

    return nextId;
  }

  async processAllRecurringTasks(): Promise<number> {
    const [tasks]: any = await pool.execute(
      `SELECT id FROM task 
       WHERE is_internal = 1 
         AND deleted_at IS NULL 
         AND archived_at IS NULL 
         AND recurrence_rule IS NOT NULL
         AND (status = 'completed' OR approval_status = 'approved')`
    );

    let count = 0;
    for (const t of tasks) {
      const nextId = await this.generateNextOccurrence(t.id);
      if (nextId) {
        count++;
      }
    }
    return count;
  }
}

export const tasksService = new TasksService();
