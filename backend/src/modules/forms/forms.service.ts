import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { CreateFormDTO, UpdateFormDTO } from "./forms.types.js";
import { contactsService } from "../contacts/contacts.service.js";
import { cleanString, normalizePhone } from "../contacts/contacts.normalizers.js";
import { pipelineDealsService } from "../pipeline/pipeline.deals.service.js";

function parseJson(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return [];
  }
}

function parseSubmissionData(value: unknown): Record<string, any> {
  const parsed = parseJson(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, any> : {};
}

function getSubmissionName(data: Record<string, any>) {
  return cleanString(data.name)
    || cleanString(data.fullName)
    || [cleanString(data.firstName), cleanString(data.lastName)].filter(Boolean).join(" ")
    || "";
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: cleanString(parts.shift()) || null,
    lastName: cleanString(parts.join(" ")) || null,
  };
}

function pickSubmissionField(data: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    const value = cleanString(data[key]);
    if (value) return value;
  }
  return null;
}

function buildSubmissionAttribution(
  data: Record<string, any>,
  formName: string,
  headers: Record<string, any>,
) {
  const source =
    pickSubmissionField(data, "source", "first_source", "firstSource", "utm_source", "utmSource", "campaign")
    || "Website";
  const referrer =
    pickSubmissionField(data, "referrer", "referer")
    || cleanString(headers["referer"])
    || cleanString(headers["referrer"]);
  const landingPage = pickSubmissionField(data, "landing_page", "landingPage", "page_url", "pageUrl", "url");

  return {
    source,
    firstSource: pickSubmissionField(data, "first_source", "firstSource") || source,
    latestSource: pickSubmissionField(data, "latest_source", "latestSource") || source,
    convertingSource: pickSubmissionField(data, "converting_source", "convertingSource") || source,
    utmSource: pickSubmissionField(data, "utm_source", "utmSource"),
    utmMedium: pickSubmissionField(data, "utm_medium", "utmMedium"),
    utmCampaign: pickSubmissionField(data, "utm_campaign", "utmCampaign", "campaign"),
    utmContent: pickSubmissionField(data, "utm_content", "utmContent"),
    utmTerm: pickSubmissionField(data, "utm_term", "utmTerm"),
    landingPage,
    referrer,
    formSubmitted: pickSubmissionField(data, "form_submitted", "formSubmitted", "form_name", "formName") || formName,
    pageSubmitted: pickSubmissionField(data, "page_submitted", "pageSubmitted") || landingPage,
    ctaClicked: pickSubmissionField(data, "cta_clicked", "ctaClicked", "cta"),
    gclid: pickSubmissionField(data, "gclid"),
    fbclid: pickSubmissionField(data, "fbclid"),
    msclkid: pickSubmissionField(data, "msclkid"),
    ttclid: pickSubmissionField(data, "ttclid"),
    gbraid: pickSubmissionField(data, "gbraid"),
    wbraid: pickSubmissionField(data, "wbraid"),
  };
}

function getSubmissionTreatment(data: Record<string, any>) {
  return cleanString(data.treatment) || cleanString(data.treatmentInterest) || "";
}

function getSubmissionValueCents(data: Record<string, any>) {
  const rawValue = data.valueCents ?? data.value;
  const numericValue = Number(rawValue || 0);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return data.valueCents !== undefined ? Math.round(numericValue) : Math.round(numericValue * 100);
}

export class FormsService {
  // List persisted form definitions with lightweight submission metrics
  async listForms(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT fd.id, fd.name, fd.type, fd.status, fd.fields, fd.views,
              fd.updated_at as updatedAt,
              COUNT(fs.id) as submissions,
              MAX(fs.submitted_at) as lastSubmission
       FROM form_definition fd
       LEFT JOIN form_submission fs ON fs.form_id = fd.id AND fs.deleted_at IS NULL
       WHERE fd.clinic_id = ? AND fd.deleted_at IS NULL
       GROUP BY fd.id
       ORDER BY fd.updated_at DESC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      ...row,
      fields: parseJson(row.fields),
      views: Number(row.views),
      submissions: Number(row.submissions),
      lastSubmission: row.lastSubmission ? new Date(row.lastSubmission).toISOString() : null,
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  }

  // List form submissions with common lead fields extracted from JSON
  async listSubmissions(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT fs.id, fd.name as formName, fs.submitted_data as submittedData,
              fs.contact_id as contactId,
              fs.pipeline_deal_id as pipelineDealId,
              fs.submitted_at as submittedAt,
              fs.archived_at as archivedAt
       FROM form_submission fs
       JOIN form_definition fd ON fd.id = fs.form_id
       WHERE fs.clinic_id = ? AND fs.deleted_at IS NULL
       ORDER BY fs.submitted_at DESC
       LIMIT 200`,
      [clinicId],
    );

    return rows.map((row: any) => {
      const data = parseSubmissionData(row.submittedData);
      return {
        id: row.id,
        formName: row.formName,
        contactId: row.contactId || null,
        pipelineDealId: row.pipelineDealId || null,
        name: getSubmissionName(data) || "Unknown",
        email: cleanString(data.email) || "",
        phone: cleanString(data.phone) || "",
        treatment: getSubmissionTreatment(data),
        status: data.status || "new",
        submittedAt: new Date(row.submittedAt).toISOString(),
        source: data.source || "Website",
        archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
      };
    });
  }

  async linkSubmissionToPipeline(clinicId: string, userId: string, submissionId: string, data: any) {
    const submission = await this.getSubmissionForMutation(clinicId, submissionId);
    if (submission.pipelineDealId) {
      throw ApiError.badRequest("This form submission is already linked to a pipeline deal");
    }

    const submittedData = parseSubmissionData(submission.submittedData);
    const contactId = submission.contactId || await this.findOrCreateSubmissionContact(clinicId, userId, submissionId, submittedData);
    const treatment = cleanString(data.treatment) || getSubmissionTreatment(submittedData) || null;
    const source = cleanString(data.source) || cleanString(submittedData.source) || cleanString(submittedData.utm_source) || "Website";
    const name = getSubmissionName(submittedData) || "Form submission";
    const deal = await pipelineDealsService.createDeal(clinicId, userId, {
      contactId,
      stageId: data.stageId || null,
      title: cleanString(data.title) || `${name} - ${treatment || submission.formName}`,
      valueCents: data.valueCents ?? getSubmissionValueCents(submittedData),
      source,
      treatment,
      probability: data.probability ?? 0,
      expectedCloseDate: data.expectedCloseDate || null,
    });

    const nextData = {
      ...submittedData,
      status: submittedData.status && submittedData.status !== "new" ? submittedData.status : "contacted",
      pipelineDealId: deal.id,
      contactId,
    };

    await pool.execute(
      `UPDATE form_submission
       SET contact_id = ?,
           pipeline_deal_id = ?,
           submitted_data = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [contactId, deal.id, JSON.stringify(nextData), submissionId, clinicId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "FORM_SUBMISSION_LINKED_TO_PIPELINE",
      entityType: "form_submission",
      entityId: submissionId,
      changes: { contactId, pipelineDealId: deal.id, formId: submission.formId },
    });

    return {
      submissionId,
      contactId,
      pipelineDealId: deal.id,
      deal,
    };
  }

  async archiveSubmission(clinicId: string, userId: string, submissionId: string) {
    const [result]: any = await pool.execute(
      `UPDATE form_submission
       SET archived_at = CURRENT_TIMESTAMP,
           deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [submissionId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Form submission not found");

    await logAuditEvent({
      clinicId,
      userId,
      action: "FORM_SUBMISSION_ARCHIVED",
      entityType: "form_submission",
      entityId: submissionId,
      changes: {
        destructive: true,
        mode: "soft_delete",
        complianceNote: "Submission archived with deleted_at; raw row is retained for audit/compliance recovery.",
      },
    });
  }

  // Create a reusable form definition without binding it to contacts yet
  async createForm(clinicId: string, userId: string, data: CreateFormDTO) {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO form_definition (id, clinic_id, name, type, status, fields, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, clinicId, data.name, data.type || "Lead", data.status || "draft", JSON.stringify(data.fields || []), userId],
    );
    await logAuditEvent({ clinicId, userId, action: "FORM_CREATED", entityType: "form_definition", entityId: id, changes: { name: data.name, type: data.type || "Lead" } });
    return id;
  }

  // Update definition metadata and builder fields
  async updateForm(clinicId: string, userId: string, formId: string, data: UpdateFormDTO) {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.type !== undefined) { fields.push("type = ?"); values.push(data.type); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (data.fields !== undefined) { fields.push("fields = ?"); values.push(JSON.stringify(data.fields)); }

    if (fields.length === 0) return;
    values.push(formId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE form_definition SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Form not found");
    await logAuditEvent({ clinicId, userId, action: "FORM_UPDATED", entityType: "form_definition", entityId: formId, changes: { ...data } });
  }

  // Soft delete a form definition while preserving submissions
  async deleteForm(clinicId: string, userId: string, formId: string) {
    const [result]: any = await pool.execute(
      "UPDATE form_definition SET status = 'archived', deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
      [formId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Form not found");
    await logAuditEvent({ clinicId, userId, action: "FORM_DELETED", entityType: "form_definition", entityId: formId });
  }

  // Public read for hosted forms. Draft/archived forms are returned without
  // pretending they are submittable so the frontend can show a precise state.
  async getPublicForm(formId: string) {
    const [forms]: any = await pool.execute(
      `SELECT id, name, type, status, fields, views, updated_at as updatedAt
       FROM form_definition
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [formId],
    );
    if (!forms[0]) throw ApiError.notFound("Form not found");

    const form = forms[0];
    if (form.status === "active") {
      await pool.execute(
        `UPDATE form_definition SET views = views + 1 WHERE id = ? AND deleted_at IS NULL`,
        [formId],
      );
    }

    return {
      id: form.id,
      name: form.name,
      type: form.type,
      status: form.status,
      fields: parseJson(form.fields),
      views: Number(form.views || 0) + (form.status === "active" ? 1 : 0),
      submissions: 0,
      lastSubmission: null,
      updatedAt: new Date(form.updatedAt).toISOString(),
    };
  }

  async submitHostedPublicForm(formId: string, payload: Record<string, any>, headers: Record<string, any>) {
    const [forms]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, status
       FROM form_definition
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [formId],
    );
    if (!forms[0]) throw ApiError.notFound("Form not found");
    if (forms[0].status !== "active") {
      throw ApiError.badRequest("This form is not currently accepting submissions.");
    }

    return this.submitFormPublic(forms[0].clinicId, formId, payload, headers);
  }

  // Public form submission accepted via clinic API key
  async submitFormPublic(clinicId: string, formId: string, payload: Record<string, any>, headers: Record<string, any>) {
    // Validate form exists and belongs to clinic
    const [forms]: any = await pool.execute(
      `SELECT id, name, status FROM form_definition WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL LIMIT 1`,
      [formId, clinicId],
    );
    if (!forms[0]) throw new ApiError(404, "Form not found");
    if (forms[0].status !== "active") {
      throw ApiError.badRequest("This form is not currently accepting submissions.");
    }

    const submissionId = uuidv4();
    const submittedData = { ...payload, _headers: { userAgent: headers['user-agent'] || null, referrer: headers['referer'] || headers['referrer'] || null } };

    await pool.execute(
      `INSERT INTO form_submission (id, clinic_id, form_id, submitted_data) VALUES (?, ?, ?, ?)`,
      [submissionId, clinicId, formId, JSON.stringify(submittedData)],
    );

    // Extract contact fields
    const name = payload.name || payload.fullName || `${payload.firstName || ''} ${payload.lastName || ''}`.trim();
    const email = payload.email || null;
    const phone = payload.phone || null;
    const treatment = payload.treatment || payload.treatmentInterest || payload.treatmentInterest || null;
    const attribution = buildSubmissionAttribution(payload, forms[0].name, headers);
    const campaign = attribution.utmCampaign || null;
    const utm = {
      utm_source: attribution.utmSource,
      utm_medium: attribution.utmMedium,
      utm_campaign: attribution.utmCampaign,
      utm_content: attribution.utmContent,
      utm_term: attribution.utmTerm,
    };

    // Build contact DTO consistent with contacts.createContact
    const contactDto: any = {
      firstName: null,
      lastName: null,
      email,
      phone,
      ...attribution,
      value: payload.value || 0,
      treatmentInterests: treatment ? [treatment] : [],
      notes: payload.message || payload.notes || null,
      externalId: submissionId,
    };
    if (name) {
      const parts = String(name).split(" ");
      contactDto.firstName = parts.shift() || null;
      contactDto.lastName = parts.join(" ") || null;
    }

    // Create contact using same duplicate logic; pass null userId for public
    try {
      const result = await contactsService.createContact(clinicId, null as any, contactDto, { ipAddress: null, userAgent: headers['user-agent'] });
      const contactId = result.contact.id;
      await pool.execute(
        `UPDATE form_submission SET contact_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ?`,
        [contactId, submissionId, clinicId],
      );
      await logAuditEvent({ clinicId, userId: null, action: "FORM_SUBMITTED", entityType: "form_submission", entityId: submissionId, changes: { formId, contactId, campaign, utm } });
      return { id: submissionId, contactId };
    } catch (err) {
      // Still log submission but return error about contact creation
      await logAuditEvent({ clinicId, userId: null, action: "FORM_SUBMISSION_ERROR", entityType: "form_submission", entityId: submissionId, changes: { error: String(err) } });
      throw err;
    }
  }

  private async getSubmissionForMutation(clinicId: string, submissionId: string) {
    const [rows]: any = await pool.execute(
      `SELECT fs.id,
              fs.form_id as formId,
              fd.name as formName,
              fs.submitted_data as submittedData,
              fs.contact_id as contactId,
              fs.pipeline_deal_id as pipelineDealId
       FROM form_submission fs
       JOIN form_definition fd ON fd.id = fs.form_id
       WHERE fs.id = ? AND fs.clinic_id = ? AND fs.deleted_at IS NULL
       LIMIT 1`,
      [submissionId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Form submission not found");
    return rows[0];
  }

  private async findOrCreateSubmissionContact(clinicId: string, userId: string, submissionId: string, data: Record<string, any>) {
    const email = cleanString(data.email)?.toLowerCase() || null;
    const phone = normalizePhone(data.phone);
    const clauses = ["external_id = ?"];
    const values: any[] = [submissionId];
    if (email) {
      clauses.push("email = ?");
      values.push(email);
    }
    if (phone) {
      clauses.push("phone = ?");
      values.push(phone);
    }

    const [existingRows]: any = await pool.execute(
      `SELECT id
       FROM contact
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND (${clauses.join(" OR ")})
       ORDER BY CASE WHEN external_id = ? THEN 0 ELSE 1 END, created_at ASC
       LIMIT 1`,
      [clinicId, ...values, submissionId],
    );
    if (existingRows[0]?.id) return existingRows[0].id as string;

    const name = getSubmissionName(data);
    const { firstName, lastName } = splitName(name);
    const treatment = getSubmissionTreatment(data);
    const attribution = buildSubmissionAttribution(data, "Form submission", {});
    const contact = await contactsService.createContact(clinicId, userId, {
      firstName,
      lastName,
      email,
      phone,
      ...attribution,
      value: Number(data.value || 0) || 0,
      treatmentInterests: treatment ? [treatment] : [],
      notes: cleanString(data.message) || cleanString(data.notes) || null,
      externalId: submissionId,
    } as any);

    return contact.contact.id;
  }
}

export const formsService = new FormsService();
