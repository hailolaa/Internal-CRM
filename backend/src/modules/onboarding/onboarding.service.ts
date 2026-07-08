import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { pipelineService } from "../pipeline/pipeline.service.js";
import { slaService } from "../sla/sla.service.js";
import { defaultCallOutcomeOptions } from "../calls/calls.constants.js";
import { defaultConsultOutcomeOptions } from "../consults/consults.constants.js";
import type { OnboardingState, OnboardingStatus, OnboardingStepKey } from "./onboarding.types.js";

const STEPS: OnboardingStepKey[] = [
  "clinic-basics",
  "team",
  "treatments",
  "lead-sources",
  "call-tracking",
  "marketing",
  "competitors",
  "reviews",
];

export class OnboardingService {
  private async ensureRow(clinicId: string, userId?: string | null) {
    const [rows]: any = await pool.execute(
      `SELECT id, data, completed_at as completedAt
       FROM onboarding_state
       WHERE clinic_id = ?
       LIMIT 1`,
      [clinicId],
    );

    if (rows[0]) return rows[0];

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO onboarding_state (id, clinic_id, data, created_by) VALUES (?, ?, ?, ?)`,
      [id, clinicId, JSON.stringify({}), userId || null],
    );

    const [newRows]: any = await pool.execute(
      `SELECT id, data, completed_at as completedAt FROM onboarding_state WHERE clinic_id = ? LIMIT 1`,
      [clinicId],
    );

    return newRows[0];
  }

  async getStatus(clinicId: string): Promise<OnboardingStatus> {
    const row = await this.ensureRow(clinicId);
    const data: OnboardingState = row.data ? JSON.parse(row.data) : {};

    const checks = await this.runChecks(clinicId);
    const fieldChecks = this.runFieldChecks(data);

    const steps: OnboardingStatus["steps"] = {} as any;
    let completedCount = 0;
    for (const step of STEPS) {
      const fieldMissing = fieldChecks[step]?.missing || [];
      const ok = fieldMissing.length === 0 || checks[step] === true || Boolean(data[step]?.completed);
      const missing = ok ? [] : [
        ...(checks[step] === true ? [] : (checks[step] || [])),
        ...fieldMissing,
      ];
      steps[step] = { completed: ok, missing };
      if (ok) completedCount++;
    }

    const completionPercentage = Math.round((completedCount / STEPS.length) * 100);

    return {
      clinicId,
      data,
      steps,
      completionPercentage,
      requiredFields: fieldChecks,
      defaults: {
        callOutcomes: defaultCallOutcomeOptions,
        consultOutcomes: defaultConsultOutcomeOptions,
      },
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    };
  }

  async patchStep(clinicId: string, userId: string, step: OnboardingStepKey, payload: any) {
    const row = await this.ensureRow(clinicId, userId);
    const data: OnboardingState = row.data ? JSON.parse(row.data) : {};
    data[step] = { ...(data[step] || {}), ...payload };

    await pool.execute(
      `UPDATE onboarding_state SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE clinic_id = ?`,
      [JSON.stringify(data), clinicId],
    );
    return this.getStatus(clinicId);
  }

  async completeOnboarding(clinicId: string, userId: string) {
    const status = await this.getStatus(clinicId);
    const missing = Object.entries(status.steps).filter(([, v]) => !v.completed).map(([k]) => k);
    if (missing.length > 0) {
      throw new Error(`Missing required steps: ${missing.join(", ")}`);
    }

    // Ensure defaults
    await pipelineService.ensureDefaultPipeline(clinicId, userId);
    await slaService.getClinicTargetMinutes(clinicId);

    await pool.execute(
      `UPDATE onboarding_state SET completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE clinic_id = ?`,
      [clinicId],
    );

    return this.getStatus(clinicId);
  }

  private async runChecks(clinicId: string) {
    // Each check returns true if satisfied, or an array of missing items
    const results: Record<string, true | string[]> = {};

    // clinic-basics: require clinic row exists (always true), but check for phone/address optionally
    const [clinicRows]: any = await pool.execute(
      `SELECT id, name, email, phone FROM clinic WHERE id = ? LIMIT 1`,
      [clinicId],
    );
    results["clinic-basics"] = clinicRows.length ? true : ["clinic record missing"];

    // team: require at least 1 active non-patient user (clinician or admin)
    const [userRows]: any = await pool.execute(
      `SELECT COUNT(*) as total FROM user WHERE clinic_id = ? AND deleted_at IS NULL AND status = 'active' AND is_active = 1`,
      [clinicId],
    );
    results["team"] = Number(userRows[0]?.total || 0) > 0 ? true : ["no users created"];

    // treatments: require at least one treatment_catalog
    const [treatmentRows]: any = await pool.execute(
      `SELECT COUNT(*) as total FROM treatment_catalog WHERE clinic_id = ? AND deleted_at IS NULL`,
      [clinicId],
    );
    results["treatments"] = Number(treatmentRows[0]?.total || 0) > 0 ? true : ["no treatments configured"];

    // lead-sources: campaigns or contacts with sources
    const [campaignRows]: any = await pool.execute(
      `SELECT COUNT(*) as total FROM campaign WHERE clinic_id = ? AND deleted_at IS NULL`,
      [clinicId],
    );
    const [contactSourceRows]: any = await pool.execute(
      `SELECT COUNT(DISTINCT(source)) as total FROM contact WHERE clinic_id = ? AND deleted_at IS NULL AND source IS NOT NULL`,
      [clinicId],
    );
    results["lead-sources"] = (Number(campaignRows[0]?.total || 0) > 0 || Number(contactSourceRows[0]?.total || 0) > 0)
      ? true
      : ["no campaigns or lead sources configured"];

    // call-tracking
    const [callTrackingRows]: any = await pool.execute(
      `SELECT COUNT(*) as total FROM call_tracking_number WHERE clinic_id = ?`,
      [clinicId],
    );
    results["call-tracking"] = Number(callTrackingRows[0]?.total || 0) > 0 ? true : ["no call tracking numbers configured"];

    // marketing: manual spend entries or campaigns
    const [spendRows]: any = await pool.execute(
      `SELECT COUNT(*) as total FROM manual_spend_entry WHERE clinic_id = ? AND deleted_at IS NULL`,
      [clinicId],
    );
    results["marketing"] = (Number(spendRows[0]?.total || 0) > 0 || Number(campaignRows[0]?.total || 0) > 0)
      ? true
      : ["no marketing/campaign or spend data"];

    // competitors
    const [competitorRows]: any = await pool.execute(
      `SELECT COUNT(*) as total FROM competitor WHERE clinic_id = ? AND deleted_at IS NULL`,
      [clinicId],
    );
    results["competitors"] = Number(competitorRows[0]?.total || 0) > 0 ? true : ["no competitor research entered"];

    // reviews
    const [reviewRows]: any = await pool.execute(
      `SELECT COUNT(*) as total FROM review WHERE clinic_id = ? AND deleted_at IS NULL`,
      [clinicId],
    );
    results["reviews"] = Number(reviewRows[0]?.total || 0) > 0 ? true : ["no reviews imported or connected"];

    return results;
  }

  private runFieldChecks(data: OnboardingState): Record<string, { completed: boolean; missing: string[] }> {
    const has = (step: string, key: string) => {
      const value = data[step]?.[key] ?? data[key];
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && String(value).trim() !== "";
    };
    const requireStep = (step: string, fields: string[]) => {
      const missing = fields.filter((field) => !has(step, field));
      return { completed: missing.length === 0, missing };
    };

    return {
      "clinic-basics": requireStep("clinic-basics", [
        "clinicName",
        "location",
        "mainContact",
        "websiteUrl",
        "mainPhoneNumber",
        "whatsAppNumber",
        "defaultSlaTarget",
        "goLiveChecklist",
      ]),
      team: requireStep("team", ["staff", "practitioners"]),
      treatments: requireStep("treatments", ["treatmentCategories", "treatmentValues"]),
      "lead-sources": requireStep("lead-sources", ["adChannelsUsed"]),
      "call-tracking": requireStep("call-tracking", ["mainPhoneNumber"]),
      marketing: requireStep("marketing", ["adChannelsUsed"]),
      competitors: requireStep("competitors", ["competitors"]),
      reviews: requireStep("reviews", ["googleReviewLink"]),
    };
  }
}

export const onboardingService = new OnboardingService();
