import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { buildTimelineMetadata, logTimelineActivity } from "../../utils/activity.js";
import { logAuditEvent } from "../../utils/audit.js";
import { CreateSequenceDTO, EnrollSequenceDTO, UpdateSequenceDTO } from "./sequences.types.js";

function parseSteps(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return [];
  }
}

type SequenceStep = {
  id?: string | number;
  type?: string;
  delay?: number;
  subject?: string;
  body?: string;
  sendOnWeekends?: boolean;
};

function communicationSteps(steps: unknown[]): SequenceStep[] {
  return steps.filter((step: any): step is SequenceStep =>
    ["email", "sms"].includes(String(step?.type || "").toLowerCase()),
  );
}

function getSequenceSettings(steps: unknown[]) {
  const settings = steps.find((step: any) => step?.type === "settings") as SequenceStep | undefined;
  return {
    sendOnWeekends: settings?.sendOnWeekends === true,
  };
}

function toMysqlDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dayInTimezone(date: Date, timezone: string) {
  try {
    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: timezone,
    }).format(date);
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  } catch {
    return date.getUTCDay();
  }
}

function adjustForWeekend(date: Date, timezone: string, sendOnWeekends: boolean) {
  if (sendOnWeekends) return date;

  let next = new Date(date);
  while ([0, 6].includes(dayInTimezone(next, timezone))) {
    next = addDays(next, 1);
    next.setUTCHours(9, 0, 0, 0);
  }
  return next;
}

function renderStepBody(step: SequenceStep, contact: any) {
  const template = step.body || step.subject || "Follow-up from your clinic";
  const variables: Record<string, string> = {
    patient_name: contact.name || "",
    first_name: contact.firstName || "",
    last_name: contact.lastName || "",
    email: contact.email || "",
    phone: contact.phone || "",
    lead_source: contact.source || "",
    status: contact.status || "",
  };

  return Object.entries(variables).reduce(
    (body, [key, value]) => body.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), value),
    template,
  );
}

export class SequencesService {
  // List persisted communication sequences for the clinic
  async listSequences(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT cs.id, cs.name, cs.trigger_label as triggerLabel, cs.steps, cs.status,
              enrolled_count as enrolledCount, completed_count as completedCount,
              cs.created_at as createdAt, cs.updated_at as updatedAt,
              SUM(CASE WHEN e.status = 'active' THEN 1 ELSE 0 END) as activeEnrollmentCount
       FROM communication_sequence cs
       LEFT JOIN communication_sequence_enrollment e
         ON e.sequence_id = cs.id
        AND e.clinic_id = cs.clinic_id
       WHERE cs.clinic_id = ? AND cs.deleted_at IS NULL
       GROUP BY cs.id, cs.name, cs.trigger_label, cs.steps, cs.status,
                cs.enrolled_count, cs.completed_count, cs.created_at, cs.updated_at
       ORDER BY cs.updated_at DESC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      ...row,
      steps: parseSteps(row.steps),
      enrolledCount: Number(row.enrolledCount),
      completedCount: Number(row.completedCount),
      activeEnrollmentCount: Number(row.activeEnrollmentCount || 0),
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  }

  // Create a sequence shell; execution will be added by a later workflow engine
  async createSequence(clinicId: string, userId: string, data: CreateSequenceDTO) {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO communication_sequence (id, clinic_id, name, trigger_label, steps, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, clinicId, data.name, data.triggerLabel, JSON.stringify(data.steps || []), data.status || "draft", userId],
    );
    await logAuditEvent({ clinicId, userId, action: "SEQUENCE_CREATED", entityType: "communication_sequence", entityId: id, changes: { name: data.name } });
    return id;
  }

  // Update sequence metadata, steps, status, or display counters
  async updateSequence(clinicId: string, userId: string, sequenceId: string, data: UpdateSequenceDTO) {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.triggerLabel !== undefined) { fields.push("trigger_label = ?"); values.push(data.triggerLabel); }
    if (data.steps !== undefined) { fields.push("steps = ?"); values.push(JSON.stringify(data.steps)); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (data.enrolledCount !== undefined) { fields.push("enrolled_count = ?"); values.push(data.enrolledCount); }
    if (data.completedCount !== undefined) { fields.push("completed_count = ?"); values.push(data.completedCount); }

    if (fields.length === 0) return;
    values.push(sequenceId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE communication_sequence SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Sequence not found");
    await logAuditEvent({ clinicId, userId, action: "SEQUENCE_UPDATED", entityType: "communication_sequence", entityId: sequenceId, changes: { ...data } });
  }

  // Soft delete sequences so future execution history can remain linked
  async deleteSequence(clinicId: string, userId: string, sequenceId: string) {
    const [result]: any = await pool.execute(
      "UPDATE communication_sequence SET status = 'archived', deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
      [sequenceId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Sequence not found");
    await logAuditEvent({ clinicId, userId, action: "SEQUENCE_DELETED", entityType: "communication_sequence", entityId: sequenceId });
  }

  async listEnrollments(clinicId: string, sequenceId: string) {
    await this.getSequence(clinicId, sequenceId);
    const [rows]: any = await pool.execute(
      `SELECT e.id,
              e.sequence_id as sequenceId,
              e.contact_id as contactId,
              TRIM(CONCAT_WS(' ', c.first_name, c.last_name)) as contactName,
              c.email,
              c.phone,
              e.status,
              e.current_step_index as currentStepIndex,
              e.next_step_at as nextStepAt,
              e.send_on_weekends as sendOnWeekends,
              e.timezone,
              e.last_error as lastError,
              e.unenrolled_at as unenrolledAt,
              e.completed_at as completedAt,
              e.created_at as createdAt,
              e.updated_at as updatedAt
       FROM communication_sequence_enrollment e
       JOIN contact c ON c.id = e.contact_id
       WHERE e.clinic_id = ?
         AND e.sequence_id = ?
         AND c.deleted_at IS NULL
       ORDER BY e.updated_at DESC`,
      [clinicId, sequenceId],
    );

    return rows.map((row: any) => this.mapEnrollment(row));
  }

  async enrollContact(
    clinicId: string,
    userId: string,
    sequenceId: string,
    data: EnrollSequenceDTO,
  ) {
    const sequence = await this.getSequence(clinicId, sequenceId);
    if (sequence.status !== "active") {
      throw ApiError.badRequest("Only active sequences can enroll contacts");
    }

    const contact = await this.getContact(clinicId, data.contactId);
    const consent = await this.getMarketingConsent(clinicId, data.contactId);
    if (consent === "inactive") {
      throw ApiError.badRequest("Contact has inactive marketing consent and cannot be enrolled");
    }

    const steps = parseSteps(sequence.steps);
    const sendableSteps = communicationSteps(steps);
    if (sendableSteps.length === 0) {
      throw ApiError.badRequest("Sequence needs at least one email or SMS step before enrollment");
    }

    const settings = getSequenceSettings(steps);
    const timezone = await this.getClinicTimezone(clinicId);
    const firstStep = sendableSteps[0];
    if (!firstStep) {
      throw ApiError.badRequest("Sequence needs at least one email or SMS step before enrollment");
    }
    const firstDueAt = adjustForWeekend(
      addDays(new Date(), Number(firstStep.delay || 0)),
      timezone,
      settings.sendOnWeekends,
    );

    const enrollmentId = uuidv4();
    await pool.execute(
      `INSERT INTO communication_sequence_enrollment
        (id, clinic_id, sequence_id, contact_id, status, current_step_index,
         next_step_at, send_on_weekends, timezone, last_error, enrolled_by,
         unenrolled_by, unenrolled_at, completed_at)
       VALUES (?, ?, ?, ?, 'active', 0, ?, ?, ?, NULL, ?, NULL, NULL, NULL)
       ON DUPLICATE KEY UPDATE
         status = 'active',
         current_step_index = 0,
         next_step_at = VALUES(next_step_at),
         send_on_weekends = VALUES(send_on_weekends),
         timezone = VALUES(timezone),
         last_error = NULL,
         enrolled_by = VALUES(enrolled_by),
         unenrolled_by = NULL,
         unenrolled_at = NULL,
         completed_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [
        enrollmentId,
        clinicId,
        sequenceId,
        data.contactId,
        toMysqlDateTime(firstDueAt),
        settings.sendOnWeekends ? 1 : 0,
        timezone,
        userId,
      ],
    );

    await this.refreshSequenceCounters(clinicId, sequenceId);
    await logTimelineActivity({
      clinicId,
      contactId: contact.id,
      userId,
      type: "Note",
      metadata: buildTimelineMetadata({
        action: "sequence.enrolled",
        source: "contact",
        recordId: sequenceId,
        changes: { sequenceName: sequence.name },
      }),
    });
    await logAuditEvent({
      clinicId,
      userId,
      action: "SEQUENCE_CONTACT_ENROLLED",
      entityType: "communication_sequence",
      entityId: sequenceId,
      changes: { contactId: data.contactId },
    });

    return this.getEnrollmentByContact(clinicId, sequenceId, data.contactId);
  }

  async unenrollContact(
    clinicId: string,
    userId: string,
    sequenceId: string,
    enrollmentId: string,
  ) {
    const [result]: any = await pool.execute(
      `UPDATE communication_sequence_enrollment
       SET status = 'unenrolled',
           next_step_at = NULL,
           unenrolled_by = ?,
           unenrolled_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND sequence_id = ?
         AND clinic_id = ?
         AND status = 'active'`,
      [userId, enrollmentId, sequenceId, clinicId],
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Active enrollment not found");
    await this.refreshSequenceCounters(clinicId, sequenceId);
    await logAuditEvent({
      clinicId,
      userId,
      action: "SEQUENCE_CONTACT_UNENROLLED",
      entityType: "communication_sequence_enrollment",
      entityId: enrollmentId,
      changes: { sequenceId },
    });

    return this.getEnrollment(clinicId, enrollmentId);
  }

  async processDueSequences(options: { limit?: number } = {}) {
    const limit = Math.min(Math.max(Number(options.limit || 50), 1), 200);
    const [rows]: any = await pool.execute(
      `SELECT e.id as enrollmentId,
              e.clinic_id as clinicId,
              e.sequence_id as sequenceId,
              e.contact_id as contactId,
              e.current_step_index as currentStepIndex,
              e.next_step_at as nextStepAt,
              e.send_on_weekends as sendOnWeekends,
              e.timezone,
              cs.name as sequenceName,
              cs.steps,
              c.first_name as firstName,
              c.last_name as lastName,
              TRIM(CONCAT_WS(' ', c.first_name, c.last_name)) as name,
              c.email,
              c.phone,
              c.status,
              c.source
       FROM communication_sequence_enrollment e
       JOIN communication_sequence cs ON cs.id = e.sequence_id
       JOIN contact c ON c.id = e.contact_id
       WHERE e.status = 'active'
         AND e.next_step_at IS NOT NULL
         AND e.next_step_at <= UTC_TIMESTAMP()
         AND cs.status = 'active'
         AND cs.deleted_at IS NULL
         AND c.deleted_at IS NULL
       ORDER BY e.next_step_at ASC
       LIMIT ${limit}`,
    );

    let processed = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      const result = await this.processEnrollmentStep(row);
      processed += 1;
      if (result === "sent") sent += 1;
      if (result === "skipped") skipped += 1;
      if (result === "failed") failed += 1;
    }

    return { processed, sent, skipped, failed };
  }

  private async processEnrollmentStep(row: any): Promise<"sent" | "skipped" | "failed"> {
    const steps = communicationSteps(parseSteps(row.steps));
    const stepIndex = Number(row.currentStepIndex || 0);
    const step = steps[stepIndex];

    if (!step) {
      await this.completeEnrollment(row.clinicId, row.sequenceId, row.enrollmentId);
      return "skipped";
    }

    const channel = String(step.type || "").toLowerCase();
    const runId = uuidv4();
    const scheduledAt = row.nextStepAt ? new Date(row.nextStepAt) : new Date();

    const duplicate = await this.createStepRun({
      runId,
      row,
      step,
      stepIndex,
      channel,
      scheduledAt,
    });
    if (duplicate) {
      await this.advanceEnrollment(row, steps, stepIndex);
      return "skipped";
    }

    try {
      const consent = await this.getMarketingConsent(row.clinicId, row.contactId);
      if (consent === "inactive") {
        await this.failRun(runId, "Contact has inactive marketing consent");
        await this.failEnrollment(row.clinicId, row.enrollmentId, "Contact has inactive marketing consent");
        return "failed";
      }

      if (channel === "email" && !row.email) {
        await this.skipRun(runId, "Contact has no email address");
        await this.advanceEnrollment(row, steps, stepIndex);
        return "skipped";
      }
      if (channel === "sms" && !row.phone) {
        await this.skipRun(runId, "Contact has no phone number");
        await this.advanceEnrollment(row, steps, stepIndex);
        return "skipped";
      }

      const messageId = uuidv4();
      const body = renderStepBody(step, row);
      const subject = step.subject || row.sequenceName;

      if (channel === "sms") {
        await pool.execute(
          `INSERT INTO sms (id, clinic_id, contact_id, user_id, message, direction, status, provider_response)
           VALUES (?, ?, ?, NULL, ?, 'outbound', 'sent', ?)`,
          [
            messageId,
            row.clinicId,
            row.contactId,
            body,
            JSON.stringify({ source: "sequence", sequenceId: row.sequenceId, enrollmentId: row.enrollmentId, stepIndex }),
          ],
        );
      } else {
        await pool.execute(
          `INSERT INTO email (id, clinic_id, contact_id, user_id, subject, body, direction, status)
           VALUES (?, ?, ?, NULL, ?, ?, 'outbound', 'sent')`,
          [messageId, row.clinicId, row.contactId, subject, body],
        );
      }

      await pool.execute(
        `UPDATE communication_sequence_step_run
         SET status = 'sent',
             sent_at = CURRENT_TIMESTAMP,
             message_id = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [messageId, runId],
      );

      await logTimelineActivity({
        clinicId: row.clinicId,
        contactId: row.contactId,
        userId: null as any,
        type: channel === "sms" ? "SMS" : "Email",
        metadata: buildTimelineMetadata({
          action: "sequence.step_sent",
          source: "contact",
          recordId: messageId,
          changes: { sequenceId: row.sequenceId, enrollmentId: row.enrollmentId, stepIndex, channel },
        }),
      });

      await this.advanceEnrollment(row, steps, stepIndex);
      return "sent";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sequence step failed";
      await this.failRun(runId, message);
      await this.failEnrollment(row.clinicId, row.enrollmentId, message);
      return "failed";
    }
  }

  private async createStepRun(input: {
    runId: string;
    row: any;
    step: SequenceStep;
    stepIndex: number;
    channel: string;
    scheduledAt: Date;
  }) {
    const [result]: any = await pool.execute(
      `INSERT IGNORE INTO communication_sequence_step_run
        (id, clinic_id, enrollment_id, sequence_id, contact_id, step_index,
         channel, status, scheduled_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        input.runId,
        input.row.clinicId,
        input.row.enrollmentId,
        input.row.sequenceId,
        input.row.contactId,
        input.stepIndex,
        input.channel,
        toMysqlDateTime(input.scheduledAt),
        JSON.stringify({ step: input.step }),
      ],
    );
    return Number(result.affectedRows || 0) === 0;
  }

  private async advanceEnrollment(row: any, steps: SequenceStep[], stepIndex: number) {
    const nextIndex = stepIndex + 1;
    const nextStep = steps[nextIndex];

    if (!nextStep) {
      await this.completeEnrollment(row.clinicId, row.sequenceId, row.enrollmentId);
      return;
    }

    const nextDueAt = adjustForWeekend(
      addDays(new Date(), Number(nextStep.delay || 0)),
      row.timezone || "UTC",
      Boolean(row.sendOnWeekends),
    );

    await pool.execute(
      `UPDATE communication_sequence_enrollment
       SET current_step_index = ?,
           next_step_at = ?,
           last_error = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?`,
      [nextIndex, toMysqlDateTime(nextDueAt), row.enrollmentId, row.clinicId],
    );
  }

  private async skipRun(runId: string, reason: string) {
    await pool.execute(
      `UPDATE communication_sequence_step_run
       SET status = 'skipped',
           error_message = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reason, runId],
    );
  }

  private async failRun(runId: string, reason: string) {
    await pool.execute(
      `UPDATE communication_sequence_step_run
       SET status = 'failed',
           error_message = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reason, runId],
    );
  }

  private async completeEnrollment(clinicId: string, sequenceId: string, enrollmentId: string) {
    await pool.execute(
      `UPDATE communication_sequence_enrollment
       SET status = 'completed',
           next_step_at = NULL,
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?`,
      [enrollmentId, clinicId],
    );
    await this.refreshSequenceCounters(clinicId, sequenceId);
  }

  private async failEnrollment(clinicId: string, enrollmentId: string, reason: string) {
    await pool.execute(
      `UPDATE communication_sequence_enrollment
       SET status = 'failed',
           next_step_at = NULL,
           last_error = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?`,
      [reason, enrollmentId, clinicId],
    );
  }

  private async getSequence(clinicId: string, sequenceId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, name, trigger_label as triggerLabel, steps, status
       FROM communication_sequence
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [sequenceId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Sequence not found");
    return rows[0];
  }

  private async getContact(clinicId: string, contactId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              first_name as firstName,
              last_name as lastName,
              TRIM(CONCAT_WS(' ', first_name, last_name)) as name,
              email,
              phone,
              status,
              source
       FROM contact
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [contactId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Contact not found");
    return rows[0];
  }

  private async getMarketingConsent(clinicId: string, contactId: string) {
    const [rows]: any = await pool.execute(
      `SELECT status
       FROM consent
       WHERE clinic_id = ?
         AND contact_id = ?
         AND type = 'marketing'
         AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      [clinicId, contactId],
    );
    return rows[0]?.status || null;
  }

  private async getClinicTimezone(clinicId: string) {
    const [rows]: any = await pool.execute(
      "SELECT timezone FROM clinic WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [clinicId],
    );
    return rows[0]?.timezone || "UTC";
  }

  private async refreshSequenceCounters(clinicId: string, sequenceId: string) {
    await pool.execute(
      `UPDATE communication_sequence
       SET enrolled_count = (
             SELECT COUNT(*)
             FROM communication_sequence_enrollment
             WHERE clinic_id = ?
               AND sequence_id = ?
               AND status IN ('active', 'completed')
           ),
           completed_count = (
             SELECT COUNT(*)
             FROM communication_sequence_enrollment
             WHERE clinic_id = ?
               AND sequence_id = ?
               AND status = 'completed'
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?`,
      [clinicId, sequenceId, clinicId, sequenceId, sequenceId, clinicId],
    );
  }

  private async getEnrollmentByContact(clinicId: string, sequenceId: string, contactId: string) {
    const [rows]: any = await pool.execute(
      `SELECT e.id,
              e.sequence_id as sequenceId,
              e.contact_id as contactId,
              TRIM(CONCAT_WS(' ', c.first_name, c.last_name)) as contactName,
              c.email,
              c.phone,
              e.status,
              e.current_step_index as currentStepIndex,
              e.next_step_at as nextStepAt,
              e.send_on_weekends as sendOnWeekends,
              e.timezone,
              e.last_error as lastError,
              e.unenrolled_at as unenrolledAt,
              e.completed_at as completedAt,
              e.created_at as createdAt,
              e.updated_at as updatedAt
       FROM communication_sequence_enrollment e
       JOIN contact c ON c.id = e.contact_id
       WHERE e.clinic_id = ?
         AND e.sequence_id = ?
         AND e.contact_id = ?
       LIMIT 1`,
      [clinicId, sequenceId, contactId],
    );
    if (!rows[0]) throw ApiError.notFound("Enrollment not found");
    return this.mapEnrollment(rows[0]);
  }

  private async getEnrollment(clinicId: string, enrollmentId: string) {
    const [rows]: any = await pool.execute(
      `SELECT e.id,
              e.sequence_id as sequenceId,
              e.contact_id as contactId,
              TRIM(CONCAT_WS(' ', c.first_name, c.last_name)) as contactName,
              c.email,
              c.phone,
              e.status,
              e.current_step_index as currentStepIndex,
              e.next_step_at as nextStepAt,
              e.send_on_weekends as sendOnWeekends,
              e.timezone,
              e.last_error as lastError,
              e.unenrolled_at as unenrolledAt,
              e.completed_at as completedAt,
              e.created_at as createdAt,
              e.updated_at as updatedAt
       FROM communication_sequence_enrollment e
       JOIN contact c ON c.id = e.contact_id
       WHERE e.clinic_id = ?
         AND e.id = ?
       LIMIT 1`,
      [clinicId, enrollmentId],
    );
    if (!rows[0]) throw ApiError.notFound("Enrollment not found");
    return this.mapEnrollment(rows[0]);
  }

  private mapEnrollment(row: any) {
    return {
      id: row.id,
      sequenceId: row.sequenceId,
      contactId: row.contactId,
      contactName: row.contactName || row.email || row.phone || "Unknown contact",
      email: row.email || null,
      phone: row.phone || null,
      status: row.status,
      currentStepIndex: Number(row.currentStepIndex || 0),
      nextStepAt: row.nextStepAt ? new Date(row.nextStepAt).toISOString() : null,
      sendOnWeekends: Boolean(row.sendOnWeekends),
      timezone: row.timezone || "UTC",
      lastError: row.lastError || null,
      unenrolledAt: row.unenrolledAt ? new Date(row.unenrolledAt).toISOString() : null,
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    };
  }
}

export const sequencesService = new SequencesService();
