import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { appointmentsService } from "../modules/appointments/appointments.service.js";
import { callsService } from "../modules/calls/calls.service.js";
import { contactsService } from "../modules/contacts/contacts.service.js";
import { consultsService } from "../modules/consults/consults.service.js";
import { opsLogsService } from "../modules/ops-logs/ops-logs.service.js";
import { pipelineDealsService } from "../modules/pipeline/pipeline.deals.service.js";
import { pipelineService } from "../modules/pipeline/pipeline.service.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toMysqlDatetime(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function nextWeekdayDate(daysAhead = 1) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);

  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }

  return date;
}

async function createClinicAndAdmin(prefix: string) {
  const result = await authService.registerClinic({
    clinicName: `${prefix} Clinic`,
    adminEmail: uniqueEmail(`${prefix}_admin`),
    adminPassword: "password123",
    firstName: prefix,
    lastName: "Admin",
    phone: "555-0100",
  });

  return {
    clinicId: result.user.clinicId,
    userId: result.user.id,
    token: result.tokens.token,
  };
}

async function ensureClinicianAvailability(clinicId: string, clinicianId: string, date: Date) {
  const availabilityId = uuidv4();
  await pool.execute(
    `INSERT INTO clinician_availability
      (id, clinic_id, clinician_id, day_of_week, start_time, end_time, slot_interval_minutes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [availabilityId, clinicId, clinicianId, date.getDay(), "09:00:00", "17:00:00", 30],
  );
  return availabilityId;
}

async function fetchJson(baseUrl: string, path: string, token: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const body: any = await response.json();
  assert.equal(response.ok, true, `Expected ${path} to return 200, got ${response.status}`);
  assert.equal(body.status, "success");
  return body.data;
}

async function sendJson(baseUrl: string, path: string, token: string, method: "POST" | "PATCH", body?: unknown) {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const response = await fetch(`${baseUrl}${path}`, init);

  const payload: any = await response.json();
  assert.equal(response.ok, true, `Expected ${method} ${path} to return success, got ${response.status}`);
  assert.equal(payload.status, "success");
  return payload.data;
}

async function fetchPublicJson(baseUrl: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: "application/json",
    },
  });

  const payload: any = await response.json();
  assert.equal(response.ok, true, `Expected public ${path} to return success, got ${response.status}`);
  assert.equal(payload.status, "success");
  return payload.data;
}

test("reports dashboard returns live revenue, funnel, channel, treatment, and leak metrics", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("ReportsDashboardPrimary");
  const secondary = await createClinicAndAdmin("ReportsDashboardSecondary");

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start dashboard test server");
  }

  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  const dateRangeStart = toDateOnly(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));
  const dateRangeEnd = toDateOnly(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));

  const primarySpendId = uuidv4();
  const campaignId = uuidv4();
  const attributionId = uuidv4();
  const treatmentCatalogId = uuidv4();
  const treatmentPlanId = uuidv4();
  const trackingNumber = "+1 (555) 901-0001";
  const normalizedTrackingNumber = trackingNumber.replace(/\D/g, "");

  const leadOne = await contactsService.createContact(primary.clinicId, primary.userId, {
    firstName: "Dashboard",
    lastName: "LeadOne",
    email: uniqueEmail("dashboard_lead_one"),
    phone: "+1 (555) 210-0001",
    source: "meta_ads",
    value: 7500,
    treatmentInterests: ["Dashboard Injectables"],
  });

  const leadTwo = await contactsService.createContact(primary.clinicId, primary.userId, {
    firstName: "Dashboard",
    lastName: "LeadTwo",
    email: uniqueEmail("dashboard_lead_two"),
    phone: "+1 (555) 210-0002",
    source: "referral",
    value: 9200,
    treatmentInterests: ["Dashboard Injectables"],
  });

  const contactedAt = new Date();
  await pool.execute(
    `UPDATE contact
     SET first_response_at = ?,
         first_response_by = ?,
         sla_deadline_at = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE clinic_id = ?
       AND id = ?`,
    [contactedAt, primary.userId, new Date(Date.now() + 2 * 60 * 60 * 1000), primary.clinicId, leadOne.contact.id],
  );

  const breachedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await pool.execute(
    `UPDATE contact
     SET sla_deadline_at = ?,
         sla_breached_at = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE clinic_id = ?
       AND id = ?`,
    [breachedAt, breachedAt, primary.clinicId, leadTwo.contact.id],
  );

  const trackingId = uuidv4();
  await pool.execute(
    `INSERT INTO call_tracking_number
      (id, clinic_id, phone_number, normalized_number, label, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [trackingId, primary.clinicId, trackingNumber, normalizedTrackingNumber, "Dashboard inbound line"],
  );

  const missedCallSid = `CA${uuidv4().replace(/-/g, "").slice(0, 32)}`;
  await callsService.handleTwilioCallWebhook({
    CallSid: missedCallSid,
    AccountSid: "AC99999999999999999999999999999999",
    CallStatus: "no-answer",
    Direction: "inbound",
    From: leadTwo.contact.phone || "+1 (555) 210-0002",
    To: trackingNumber,
    CallDuration: "0",
    Duration: "0",
    StartTime: "2026-05-28T11:00:00Z",
    EndTime: "2026-05-28T11:00:30Z",
  });

  const completedDate = nextWeekdayDate(1);
  completedDate.setHours(10, 0, 0, 0);
  const noShowDate = nextWeekdayDate(3);
  noShowDate.setHours(11, 0, 0, 0);

  const completedAvailabilityId = await ensureClinicianAvailability(primary.clinicId, primary.userId, completedDate);
  const noShowAvailabilityId = await ensureClinicianAvailability(primary.clinicId, primary.userId, noShowDate);

  const appointment = await appointmentsService.createAppointment(primary.clinicId, primary.userId, {
    contactId: leadOne.contact.id,
    clinicianId: primary.userId,
    dateTime: completedDate.toISOString(),
    status: "completed",
    treatment: "Dashboard Injectables",
    valueCents: 650000,
    durationMinutes: 45,
    consultNotes: "Completed from dashboard integration test",
  });

  const noShowAppointment = await appointmentsService.createAppointment(primary.clinicId, primary.userId, {
    contactId: leadTwo.contact.id,
    clinicianId: primary.userId,
    dateTime: noShowDate.toISOString(),
    status: "no_show",
    treatment: "Dashboard Injectables",
    valueCents: 250000,
    durationMinutes: 45,
    consultNotes: "No-show from dashboard integration test",
    noShowReason: "Patient did not attend",
  });

  const consult = await consultsService.createConsult(primary.clinicId, primary.userId, {
    contactId: leadOne.contact.id,
    appointmentId: appointment.id,
    patientName: `${leadOne.contact.firstName} ${leadOne.contact.lastName}`,
    treatment: "Dashboard Injectables",
    practitioner: "ReportsDashboardPrimary Admin",
    practitionerId: primary.userId,
    outcome: "Treatment Booked",
    revenue: 6500,
    date: appointment.dateTime,
    notes: "Booked from dashboard integration test",
    depositStatus: "paid",
  });

  const spendId = await opsLogsService.createSpend(primary.clinicId, primary.userId, {
    source: "meta_ads",
    channel: "Paid Social",
    campaign: "Dashboard Launch",
    amount: 1500,
    period: "Dashboard Period",
    startDate: dateRangeStart,
    endDate: dateRangeEnd,
    attributionLabel: "manual_reviewed",
    notes: "Primary dashboard spend",
  });

  const campaignRecordId = uuidv4();
  await pool.execute(
    `INSERT INTO campaign
      (id, clinic_id, name, description, type, status, start_date, end_date, budget, channel)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [campaignRecordId, primary.clinicId, "Dashboard Launch Campaign", "Campaign used by dashboard integration test", "social_media", "active", dateRangeStart, dateRangeEnd, 3000, "social"],
  );

  await pool.execute(
    `INSERT INTO attribution
      (id, clinic_id, contact_id, campaign_id, channel, touchpoint_date, conversion_date, value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [attributionId, primary.clinicId, leadOne.contact.id, campaignRecordId, "paid_social", toMysqlDatetime(contactedAt), toMysqlDatetime(new Date(appointment.dateTime)), 6500],
  );

  await pool.execute(
    `INSERT INTO treatment_catalog
      (id, clinic_id, name, description, category, duration_minutes, price_cents, average_value_cents, margin_percent, priority, is_high_ticket, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [treatmentCatalogId, primary.clinicId, "Dashboard Injectables", "Treatments for dashboard metrics", "Injectables", 45, 650000, 650000, 72.5, 10, 1, "active", primary.userId],
  );

  await pool.execute(
    `INSERT INTO deposit_record
      (id, clinic_id, contact_name, treatment, appointment_date, deposit_amount, deposit_paid, paid_date, method, showed_up, practitioner, status, deposit_requested, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), primary.clinicId, `${leadOne.contact.firstName} ${leadOne.contact.lastName}`, "Dashboard Injectables", toDateOnly(completedDate), 250.0, 1, dateRangeEnd, "card", 1, "ReportsDashboardPrimary Admin", "paid", 1, primary.userId],
  );

  await pool.execute(
    `INSERT INTO treatment_plan
      (id, clinic_id, contact_name, treatment, total_value, paid, outstanding, status, sessions, sessions_completed, next_session, practitioner, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [treatmentPlanId, primary.clinicId, `${leadOne.contact.firstName} ${leadOne.contact.lastName}`, "Dashboard Injectables", 6500, 250, 6250, "active", 4, 1, toDateOnly(noShowDate), "ReportsDashboardPrimary Admin", primary.userId],
  );

  const pipelineStages = await pipelineService.listStages(primary.clinicId, primary.userId);
  const stageId = pipelineStages[0]?.id;
  assert.ok(stageId, "Expected a default pipeline stage to exist");

  const deal = await pipelineDealsService.createDeal(primary.clinicId, primary.userId, {
    contactId: leadTwo.contact.id,
    stageId,
    valueCents: 1200000,
    source: "referral",
    treatment: "Dashboard Injectables",
    probability: 65,
  });

  try {
    const summary = await fetchJson(baseUrl, `/api/reports/dashboard/summary?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, primary.token);
    assert.equal(summary.cards.leads, 2);
    assert.equal(summary.cards.activities >= 2, true);
    assert.equal(summary.cards.totalCalls, 1);
    assert.equal(summary.cards.missedCalls, 1);
    assert.equal(summary.cards.appointments, 2);
    assert.equal(summary.cards.noShows, 1);
    assert.equal(summary.cards.consults, 1);
    assert.equal(summary.cards.bookedConsults, 1);
    assert.equal(summary.cards.attendedConsults, 1);
    assert.equal(summary.cards.soldTreatments, 1);
    assert.equal(summary.cards.activeTreatmentPlans, 1);
    assert.equal(summary.cards.openDeals, 1);
    assert.ok(Number(summary.cards.depositsPaid) >= 0);
    assert.equal(summary.financials.spend, 1500);
    assert.equal(summary.financials.consultRevenue, 6500);
    assert.ok(Number(summary.financials.depositRevenue) >= 0);
    assert.equal(summary.financials.totalRevenue, 6750);
    assert.equal(summary.financials.openDealValue, Number(deal.valueCents) / 100);
    assert.equal(summary.financials.roas > 0, true);
    assert.equal(summary.emptyState, false);

    const funnel = await fetchJson(baseUrl, `/api/reports/dashboard/funnel?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, primary.token);
    assert.equal(funnel.funnel[0].count, 2);
    assert.equal(funnel.funnel[1].count, 1);
    assert.equal(funnel.funnel[2].count, 2);
    assert.equal(funnel.funnel[3].count, 1);
    assert.equal(funnel.funnel[4].count, 1);
    assert.equal(funnel.conversionRates.leadToContactRate, 50);
    assert.equal(funnel.conversionRates.attendedToSoldRate, 100);

    const revenueByChannel = await fetchJson(baseUrl, `/api/reports/dashboard/revenue-by-channel?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, primary.token);
    assert.equal(revenueByChannel.totals.spend, 1500);
    assert.equal(revenueByChannel.totals.revenue, 6500);
    assert.equal(revenueByChannel.byCampaign.length, 1);
    assert.equal(revenueByChannel.bySource.length, 1);
    assert.equal(revenueByChannel.bySource[0].source, "meta_ads");
    assert.equal(revenueByChannel.bySource[0].revenue, 6500);
    assert.equal(revenueByChannel.emptyState, false);

    const revenueByTreatment = await fetchJson(baseUrl, `/api/reports/dashboard/revenue-by-treatment?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, primary.token);
    assert.equal(revenueByTreatment.byTreatment.length, 1);
    assert.equal(revenueByTreatment.byTreatment[0].treatment, "Dashboard Injectables");
    assert.equal(revenueByTreatment.byTreatment[0].category, "Injectables");
    assert.equal(revenueByTreatment.byTreatment[0].revenue, 6500);
    assert.equal(revenueByTreatment.emptyState, false);

    const treatmentDetail = await fetchJson(
      baseUrl,
      `/api/reports/treatments/${encodeURIComponent("Dashboard Injectables")}/detail?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`,
      primary.token,
    );
    assert.equal(treatmentDetail.treatment.name, "Dashboard Injectables");
    assert.equal(treatmentDetail.treatment.category, "Injectables");
    assert.equal(treatmentDetail.kpis.leads, 2);
    assert.equal(treatmentDetail.kpis.consults, 1);
    assert.equal(treatmentDetail.kpis.bookedConsults, 2);
    assert.equal(treatmentDetail.kpis.attendedConsults, 1);
    assert.equal(treatmentDetail.kpis.soldTreatments, 1);
    assert.equal(treatmentDetail.kpis.treatmentPlans, 1);
    assert.equal(treatmentDetail.kpis.bookedRevenue, 6500);
    assert.equal(treatmentDetail.kpis.completedRevenue, 500);
    assert.equal(treatmentDetail.kpis.treatmentPlanValue, 6500);
    assert.equal(treatmentDetail.kpis.openDealValue, Number(deal.valueCents) / 100);
    assert.equal(treatmentDetail.kpis.totalRevenue, 7000);
    assert.equal(treatmentDetail.kpis.roi, 4.67);
    assert.equal(treatmentDetail.kpis.provenance.bookedRevenue, "manual");
    assert.equal(treatmentDetail.kpis.provenance.completedRevenue, "exact");
    assert.equal(treatmentDetail.kpis.provenance.treatmentPlanValue, "estimated");
    assert.equal(treatmentDetail.sections.sourceMix.some((item: any) => item.source === "meta_ads" && item.leads === 1), true);
    assert.equal(treatmentDetail.sections.campaigns.some((item: any) => item.campaign === "Dashboard Launch"), true);
    assert.equal(treatmentDetail.sections.monthlyTrend.some((item: any) => item.bookedRevenue === 6500), true);
    assert.equal(treatmentDetail.records.leads.some((item: any) => item.contactId === leadOne.contact.id && item.href === `/app/leads?contactId=${leadOne.contact.id}`), true);
    assert.equal(treatmentDetail.records.appointments.some((item: any) => item.id === appointment.id && item.href === `/app/appointments?id=${appointment.id}`), true);
    assert.equal(treatmentDetail.records.consults.some((item: any) => item.id === consult.id && item.leadHref === `/app/leads?contactId=${leadOne.contact.id}`), true);
    assert.equal(treatmentDetail.records.treatmentPlans.some((item: any) => item.id === treatmentPlanId && item.href === `/app/treatment-plans?id=${treatmentPlanId}`), true);
    assert.equal(treatmentDetail.records.deals.some((item: any) => item.id === deal.id && item.href === `/app/pipeline?dealId=${deal.id}`), true);
    assert.equal(treatmentDetail.emptyState, false);

    const revenueLeaks = await fetchJson(baseUrl, `/api/reports/dashboard/revenue-leaks?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, primary.token);
    const leakByKey = Object.fromEntries(revenueLeaks.items.map((item: { key: string; count: number }) => [item.key, item.count]));
    assert.equal(leakByKey.missedCalls, 1);
    assert.equal(leakByKey.slaBreaches, 1);
    assert.equal(leakByKey.noShows, 1);
    assert.equal(leakByKey.lowConsultConversion, 1);
    assert.equal(revenueLeaks.totalEstimatedRisk > 0, true);
    assert.equal(revenueLeaks.emptyState, false);

    const leakDetails = await fetchJson(baseUrl, `/api/reports/dashboard/revenue-leak-details?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, primary.token);
    assert.equal(leakDetails.items.missedCalls.length, 1);
    assert.equal(leakDetails.items.slaBreaches.length, 1);
    assert.equal(leakDetails.items.noShows.length, 1);
    assert.equal(leakDetails.items.lowConsultConversion.length, 1);
    assert.equal(leakDetails.items.missedCalls[0].sourceType, "call");
    assert.equal(leakDetails.items.slaBreaches[0].sourceType, "contact");
    assert.equal(leakDetails.items.noShows[0].sourceType, "appointment");
    assert.equal(leakDetails.items.lowConsultConversion[0].contactId, leadTwo.contact.id);
    assert.equal(leakDetails.items.noShows[0].sourceId, noShowAppointment.id);
    assert.equal(leakDetails.items.missedCalls[0].context.linkedCallCount >= 1, true);
    assert.equal(leakDetails.items.noShows[0].context.linkedAppointmentCount >= 1, true);
    assert.equal(leakDetails.items.lowConsultConversion[0].context.leadHref, `/app/leads?contactId=${leadTwo.contact.id}`);
    assert.equal(leakDetails.emptyState, false);

    const generatedInsights = await sendJson(baseUrl, "/api/insights/generate", primary.token, "POST");
    assert.equal(generatedInsights.generatedCount, 3);
    assert.equal(generatedInsights.existingCount, 0);
    assert.equal(generatedInsights.insights.length, 3);
    assert.equal(generatedInsights.insights.every((insight: any) => insight.generatedFrom === "revenue_leakage"), true);
    assert.equal(generatedInsights.insights.every((insight: any) => insight.metadata?.generation?.provider === "deterministic"), true);
    assert.equal(generatedInsights.insights.every((insight: any) => insight.metadata?.generation?.fallbackReason === "disabled"), true);

    const dedupedInsights = await sendJson(baseUrl, "/api/insights/generate", primary.token, "POST");
    assert.equal(dedupedInsights.generatedCount, 0);
    assert.equal(dedupedInsights.existingCount, 3);

    const listedInsights = await fetchJson(baseUrl, "/api/insights", primary.token);
    assert.equal(listedInsights.length, 3);
    const leakDetailsWithInsights = await fetchJson(baseUrl, `/api/reports/dashboard/revenue-leak-details?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, primary.token);
    const contextLinkedInsightId = Object.values(leakDetailsWithInsights.items)
      .flat()
      .map((record: any) => record.context?.insightId)
      .find(Boolean);
    assert.ok(contextLinkedInsightId, "Expected leakage detail context to expose linked insight");
    const firstInsight = listedInsights.find((insight: any) => insight.id === contextLinkedInsightId) || listedInsights[0];
    const taskResult = await sendJson(baseUrl, `/api/insights/${firstInsight.id}/task`, primary.token, "POST");
    assert.equal(taskResult.existing, false);
    assert.ok(taskResult.taskId);
    assert.equal(taskResult.insight.actionTaskId, taskResult.taskId);
    assert.equal(taskResult.insight.status, "in_progress");

    const leakDetailsWithActions = await fetchJson(baseUrl, `/api/reports/dashboard/revenue-leak-details?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, primary.token);
    const actionLinkedLeak = Object.values(leakDetailsWithActions.items)
      .flat()
      .find((record: any) => record.context?.actionTaskId === taskResult.taskId);
    assert.ok(actionLinkedLeak, "Expected leakage detail context to expose linked insight action task");
    assert.equal((actionLinkedLeak as any).context.insightStatus, "in_progress");

    const duplicateTaskResult = await sendJson(baseUrl, `/api/insights/${firstInsight.id}/task`, primary.token, "POST");
    assert.equal(duplicateTaskResult.existing, true);
    assert.equal(duplicateTaskResult.taskId, taskResult.taskId);

    const actionTasks = await fetchJson(baseUrl, "/api/tasks", primary.token);
    assert.equal(actionTasks.some((task: any) => task.id === taskResult.taskId && task.category === "Revenue insight"), true);

    await sendJson(baseUrl, `/api/insights/${firstInsight.id}/status`, primary.token, "PATCH", { status: "resolved" });
    const openInsightsAfterResolve = await fetchJson(baseUrl, "/api/insights", primary.token);
    assert.equal(openInsightsAfterResolve.length, 2);

    const topOpportunities = await fetchJson(baseUrl, `/api/reports/dashboard/top-opportunities?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, primary.token);
    assert.equal(topOpportunities.deals.length, 1);
    assert.equal(topOpportunities.deals[0].id, deal.id);
    assert.equal(topOpportunities.deals[0].priorityScore > 0, true);
    assert.equal(topOpportunities.emptyState, false);

    const monthlyTrend = await fetchJson(baseUrl, `/api/reports/dashboard/monthly-trend?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, primary.token);
    assert.equal(monthlyTrend.items.length >= 1, true);
    const currentTrendMonth = monthlyTrend.items.find((item: any) => item.totalRevenue > 0);
    assert.ok(currentTrendMonth, "Expected monthly trend to include the active dashboard month");
    assert.equal(currentTrendMonth.leads, 2);
    assert.equal(currentTrendMonth.bookedConsults, 1);
    assert.equal(currentTrendMonth.treatmentRevenue, 6500);
    assert.equal(currentTrendMonth.totalRevenue, 6750);
    assert.equal(currentTrendMonth.spend, 1500);
    assert.equal(currentTrendMonth.provenance.treatmentRevenue, "manual");
    assert.equal(monthlyTrend.emptyState, false);

    const riskOpportunitySections = await fetchJson(baseUrl, `/api/reports/dashboard/risk-opportunity-sections?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, primary.token);
    assert.equal(riskOpportunitySections.risks.length >= 1, true);
    assert.equal(riskOpportunitySections.opportunities.length, 1);
    assert.equal(riskOpportunitySections.opportunities[0].id, deal.id);
    assert.equal(riskOpportunitySections.emptyState, false);

    const reportMonth = toDateOnly(new Date()).slice(0, 7);
    const monthlyReport = await sendJson(baseUrl, "/api/reports/monthly", primary.token, "POST", { month: reportMonth });
    assert.equal(monthlyReport.type, "monthly_performance");
    assert.equal(monthlyReport.filters.month, reportMonth);
    assert.equal(monthlyReport.data.month, reportMonth);
    assert.equal(monthlyReport.data.metrics.summary.cards.leads, 2);
    assert.equal(Array.isArray(monthlyReport.data.sections.recommendations), true);

    const regeneratedReport = await sendJson(baseUrl, "/api/reports/monthly", primary.token, "POST", { month: reportMonth });
    assert.equal(regeneratedReport.id, monthlyReport.id);

    const reportDetail = await fetchJson(baseUrl, `/api/reports/${monthlyReport.id}`, primary.token);
    assert.equal(reportDetail.id, monthlyReport.id);
    assert.equal(reportDetail.data.sections.executiveSummary, monthlyReport.data.sections.executiveSummary);

    const reportShare = await sendJson(baseUrl, `/api/reports/${monthlyReport.id}/share`, primary.token, "POST");
    assert.equal(reportShare.reportId, monthlyReport.id);
    assert.equal(typeof reportShare.token, "string");
    assert.equal(reportShare.token.length > 20, true);

    const sharedReport = await fetchPublicJson(baseUrl, `/api/reports/shared/${reportShare.token}`);
    assert.equal(sharedReport.id, monthlyReport.id);
    assert.equal(sharedReport.data.month, reportMonth);

    const savedReports = await fetchJson(baseUrl, "/api/reports", primary.token);
    assert.equal(savedReports.some((report: any) => report.id === monthlyReport.id), true);

    const secondaryReports = await fetchJson(baseUrl, "/api/reports", secondary.token);
    assert.equal(secondaryReports.some((report: any) => report.id === monthlyReport.id), false);

    const foreignDetail = await fetch(`${baseUrl}/api/reports/${monthlyReport.id}`, {
      headers: { Authorization: `Bearer ${secondary.token}` },
    });
    assert.equal(foreignDetail.status, 404);

    const emptySummary = await fetchJson(baseUrl, `/api/reports/dashboard/summary?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, secondary.token);
    assert.equal(emptySummary.cards.leads, 0);
    assert.equal(emptySummary.cards.openDeals, 0);
    assert.equal(emptySummary.emptyState, true);

    const emptyFunnel = await fetchJson(baseUrl, `/api/reports/dashboard/funnel?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, secondary.token);
    assert.equal(emptyFunnel.funnel[0].count, 0);
    assert.equal(emptyFunnel.emptyState, true);

    const emptyChannels = await fetchJson(baseUrl, `/api/reports/dashboard/revenue-by-channel?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, secondary.token);
    assert.equal(emptyChannels.bySource.length, 0);
    assert.equal(emptyChannels.emptyState, true);

    const emptyTreatments = await fetchJson(baseUrl, `/api/reports/dashboard/revenue-by-treatment?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, secondary.token);
    assert.equal(emptyTreatments.byTreatment.length, 0);
    assert.equal(emptyTreatments.emptyState, true);

    const emptyTreatmentDetail = await fetchJson(
      baseUrl,
      `/api/reports/treatments/${encodeURIComponent("Dashboard Injectables")}/detail?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`,
      secondary.token,
    );
    assert.equal(emptyTreatmentDetail.kpis.leads, 0);
    assert.equal(emptyTreatmentDetail.records.leads.length, 0);
    assert.equal(emptyTreatmentDetail.sections.sourceMix.length, 0);
    assert.equal(emptyTreatmentDetail.emptyState, true);

    const emptyLeaks = await fetchJson(baseUrl, `/api/reports/dashboard/revenue-leaks?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, secondary.token);
    assert.equal(emptyLeaks.items.every((item: { count: number }) => item.count === 0), true);
    assert.equal(emptyLeaks.emptyState, true);

    const emptyLeakDetails = await fetchJson(baseUrl, `/api/reports/dashboard/revenue-leak-details?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, secondary.token);
    assert.equal(Object.values(emptyLeakDetails.items).every((records: any) => records.length === 0), true);
    assert.equal(emptyLeakDetails.emptyState, true);

    const emptyInsights = await fetchJson(baseUrl, "/api/insights", secondary.token);
    assert.equal(emptyInsights.length, 0);

    const emptyOpportunities = await fetchJson(baseUrl, `/api/reports/dashboard/top-opportunities?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, secondary.token);
    assert.equal(emptyOpportunities.deals.length, 0);
    assert.equal(emptyOpportunities.emptyState, true);

    const emptyMonthlyTrend = await fetchJson(baseUrl, `/api/reports/dashboard/monthly-trend?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, secondary.token);
    assert.equal(emptyMonthlyTrend.items.length >= 1, true);
    assert.equal(emptyMonthlyTrend.items.every((item: any) => item.totalRevenue === 0 && item.leads === 0), true);
    assert.equal(emptyMonthlyTrend.emptyState, true);

    const emptyRiskOpportunitySections = await fetchJson(baseUrl, `/api/reports/dashboard/risk-opportunity-sections?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`, secondary.token);
    assert.equal(emptyRiskOpportunitySections.risks.length, 0);
    assert.equal(emptyRiskOpportunitySections.opportunities.length, 0);
    assert.equal(emptyRiskOpportunitySections.emptyState, true);

    console.log("[reports-dashboard] live dashboard metrics test passed");
  } finally {
    await pool.execute(
      `UPDATE report
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id IN (?, ?)
         AND type = 'monthly_performance'
         AND deleted_at IS NULL`,
      [primary.clinicId, secondary.clinicId],
    );

    await pool.execute(
      `UPDATE insight
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id IN (?, ?)
         AND deleted_at IS NULL`,
      [primary.clinicId, secondary.clinicId],
    );

    await pool.execute(
      `UPDATE task
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id IN (?, ?)
         AND category = 'Revenue insight'
         AND deleted_at IS NULL`,
      [primary.clinicId, secondary.clinicId],
    );

    await pool.execute(
      `UPDATE treatment_plan
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, treatmentPlanId],
    );

    await pool.execute(
      `UPDATE deposit_record
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND contact_name = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, `${leadOne.contact.firstName} ${leadOne.contact.lastName}`],
    );

    await pool.execute(
      `UPDATE manual_spend_entry
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, primarySpendId],
    );

    await pool.execute(
      `UPDATE manual_consult_entry
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, consult.id],
    );

    await pool.execute(
      `UPDATE appointment
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id IN (?, ?)
         AND deleted_at IS NULL`,
      [primary.clinicId, appointment.id, noShowAppointment.id],
    );

    await pool.execute(
      `UPDATE deal
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, deal.id],
    );

    await pool.execute(
      `UPDATE treatment_catalog
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, treatmentCatalogId],
    );

    await pool.execute(
      `UPDATE attribution
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, attributionId],
    );

    await pool.execute(
      `UPDATE campaign
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, campaignRecordId],
    );

    await pool.execute(
      `DELETE FROM clinician_availability
       WHERE clinic_id = ?
         AND id IN (?, ?)`,
      [primary.clinicId, completedAvailabilityId, noShowAvailabilityId],
    );

    await pool.execute(
      `DELETE FROM call_tracking_number
       WHERE clinic_id = ?
         AND id = ?`,
      [primary.clinicId, trackingId],
    );

    await pool.execute(
      `UPDATE contact
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id IN (?, ?)
         AND deleted_at IS NULL`,
      [primary.clinicId, leadOne.contact.id, leadTwo.contact.id],
    );

    await pool.execute(
      `DELETE FROM activity
       WHERE clinic_id = ?
         AND contact_id IN (?, ?)`,
      [primary.clinicId, leadOne.contact.id, leadTwo.contact.id],
    );

    await pool.execute(
      `UPDATE contact
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id IN (?, ?)
         AND deleted_at IS NULL`,
      [secondary.clinicId, leadOne.contact.id, leadTwo.contact.id],
    );

    await server.close();
    await pool.end();
  }
});
