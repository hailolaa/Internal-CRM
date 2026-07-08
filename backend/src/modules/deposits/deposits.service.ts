import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { config } from "../../config/index.js";
import { DepositStatus, DepositPaymentSessionResponse, CreateDepositPaymentSessionDTO } from "./deposits.types.js";
import { CreateDepositDTO, UpdateDepositDTO } from "./deposits.types.js";
import { getStripeClient } from "../../utils/stripe.js";

export class DepositsService {
  // List standalone deposit tracking records
  async listDeposits(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, contact_name as contact, treatment, appointment_date as appointmentDate,
              deposit_amount as depositAmount, deposit_paid as depositPaid, paid_date as paidDate,
              method, showed_up as showedUp, practitioner, status,
              reminder_sent as reminderSent, deposit_requested as depositRequested
       FROM deposit_record
       WHERE clinic_id = ? AND deleted_at IS NULL
       ORDER BY appointment_date DESC, created_at DESC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      ...row,
      depositAmount: Number(row.depositAmount),
      depositPaid: !!row.depositPaid,
      showedUp: row.showedUp === null ? null : !!row.showedUp,
      reminderSent: !!row.reminderSent,
      depositRequested: !!row.depositRequested,
      appointmentDate: row.appointmentDate ? new Date(row.appointmentDate).toISOString() : null,
      paidDate: row.paidDate ? new Date(row.paidDate).toISOString() : null,
    }));
  }

  // Create deposit records independently from the future appointment API
  async createDeposit(clinicId: string, userId: string, data: CreateDepositDTO) {
    const id = uuidv4();
    let appointmentDate = toDateOnly(data.appointmentDate) || null;

    if (!appointmentDate && data.appointmentId) {
      const [appointmentRows]: any = await pool.execute(
        `SELECT DATE(date_time) as appointmentDate
         FROM appointment
         WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [data.appointmentId, clinicId],
      );
      appointmentDate = appointmentRows[0]?.appointmentDate || null;
    }

    await pool.execute(
      `INSERT INTO deposit_record
        (id, clinic_id, contact_id, appointment_id, contact_name, treatment, appointment_date,
         deposit_amount, deposit_paid, paid_date, method, showed_up, practitioner, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.contactId || null,
        data.appointmentId || null,
        data.contact,
        data.treatment,
        appointmentDate,
        data.depositAmount || 0,
        data.depositPaid ? 1 : 0,
        toDateOnly(data.paidDate),
        data.method || null,
        data.showedUp === undefined || data.showedUp === null ? null : data.showedUp ? 1 : 0,
        data.practitioner || null,
        data.status || "unpaid",
        userId,
      ],
    );
    await logAuditEvent({ clinicId, userId, action: "DEPOSIT_CREATED", entityType: "deposit_record", entityId: id, changes: { contact: data.contact, treatment: data.treatment } });
    return id;
  }

  // Create a Stripe Checkout Session or Payment Link for a deposit
  async createDepositPaymentSession(clinicId: string, userId: string, data: CreateDepositPaymentSessionDTO): Promise<DepositPaymentSessionResponse> {
    const stripe = getStripeClient();

    // Ensure clinic exists
    const [clinicRows]: any = await pool.execute(`SELECT id, name, email FROM clinic WHERE id = ? LIMIT 1`, [clinicId]);
    if (!clinicRows[0]) throw ApiError.notFound("Clinic not found");

    // Resolve contact name if contactId provided
    let contactName = data.contactName || null;
    if (data.contactId) {
      const [crows]: any = await pool.execute(`SELECT first_name, last_name FROM contact WHERE id = ? AND clinic_id = ? LIMIT 1`, [data.contactId, clinicId]);
      if (crows[0]) contactName = [crows[0].first_name, crows[0].last_name].filter(Boolean).join(" ") || contactName;
    }

    let appointmentDate = null;
    if (data.appointmentId) {
      const [appointmentRows]: any = await pool.execute(
        `SELECT DATE(date_time) as appointmentDate
         FROM appointment
         WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [data.appointmentId, clinicId],
      );
      appointmentDate = appointmentRows[0]?.appointmentDate || null;
    }

    const depositId = uuidv4();

    // Create Stripe Payment Link (or Checkout Session) depending on config
    const stripeClient = stripe;

    const lineItem = {
      price_data: {
        currency: "usd",
        product_data: { name: `Deposit: ${data.treatment}` },
        unit_amount: Math.round((data.depositAmount || 0) * 100),
      },
      quantity: 1,
    };

    // Use Checkout Session for simple flows
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [lineItem],
      mode: "payment",
      metadata: { clinicId, depositId, contactId: data.contactId || null, appointmentId: data.appointmentId || null, consultId: data.consultId || null },
      success_url: data.successUrl || `${config.frontendUrl.replace(/\/$/, "")}/app/deposits?success=true&depositId=${depositId}`,
      cancel_url: data.cancelUrl || `${config.frontendUrl.replace(/\/$/, "")}/app/deposits?canceled=true`,
    });

    // Insert the local deposit only after Stripe has accepted the checkout session.
    await pool.execute(
      `INSERT INTO deposit_record
        (id, clinic_id, contact_name, contact_id, appointment_id, treatment, appointment_date,
         deposit_amount, deposit_paid, status, deposit_requested, stripe_session_id,
         payment_status, payment_attempted_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'requested', 1, ?, 'requested', CURRENT_TIMESTAMP, ?)`,
      [
        depositId,
        clinicId,
        contactName || data.treatment,
        data.contactId || null,
        data.appointmentId || null,
        data.treatment,
        appointmentDate,
        data.depositAmount || 0,
        session.id,
        userId,
      ],
    );

    await logAuditEvent({ clinicId, userId, action: "DEPOSIT_PAYMENT_REQUESTED", entityType: "deposit_record", entityId: depositId, changes: { depositAmount: data.depositAmount } });

    return { depositId, sessionId: session.id, url: session.url || null, status: 'requested' } as DepositPaymentSessionResponse;
  }

  // Update request/reminder flags and deposit status fields
  async updateDeposit(clinicId: string, userId: string, depositId: string, data: UpdateDepositDTO) {
    const fields: string[] = [];
    const values: any[] = [];
    const mapping: Record<string, string> = {
      contact: "contact_name",
      contactId: "contact_id",
      treatment: "treatment",
      appointmentId: "appointment_id",
      appointmentDate: "appointment_date",
      depositAmount: "deposit_amount",
      depositPaid: "deposit_paid",
      paidDate: "paid_date",
      method: "method",
      showedUp: "showed_up",
      practitioner: "practitioner",
      status: "status",
      reminderSent: "reminder_sent",
      depositRequested: "deposit_requested",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (!mapping[key]) return;
      fields.push(`${mapping[key]} = ?`);
      if (typeof value === "boolean") {
        values.push(value ? 1 : 0);
      } else if (key === "appointmentDate" || key === "paidDate") {
        values.push(toDateOnly(value));
      } else {
        values.push(value ?? null);
      }
    });

    if (fields.length === 0) return;
    values.push(depositId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE deposit_record SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Deposit record not found");
    await logAuditEvent({ clinicId, userId, action: "DEPOSIT_UPDATED", entityType: "deposit_record", entityId: depositId, changes: { ...data } });
  }
}

export const depositsService = new DepositsService();

function toDateOnly(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
