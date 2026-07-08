import { body, param, query } from "express-validator";
import { appointmentStatuses } from "./appointments.constants.js";

const appointmentMutationValidator = [
  body("contactId").optional({ nullable: true }).isString().trim().isLength({ min: 1, max: 100 }),
  body("dateTime").optional().isISO8601(),
  body("clinicianId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("status").optional().isIn(appointmentStatuses),
  body("treatment").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("valueCents").optional({ nullable: true }).isInt({ min: 0, max: 1000000000 }).toInt(),
  body("durationMinutes").optional({ nullable: true }).isInt({ min: 5, max: 480 }).toInt(),
  body("noShowReason").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("consultNotes").optional({ nullable: true }).isString().trim().isLength({ max: 5000 }),
  body("recurrenceRule").optional({ nullable: true }).isObject(),
  body("recurrenceRule.frequency").optional().isIn(["weekly", "monthly"]),
  body("recurrenceRule.interval").optional().isInt({ min: 1, max: 12 }).toInt(),
  body("recurrenceRule.count").optional({ nullable: true }).isInt({ min: 2, max: 52 }).toInt(),
  body("recurrenceRule.until").optional({ nullable: true }).isISO8601(),
];

export const listAppointmentsValidator = [
  query("start").optional({ checkFalsy: true }).isISO8601(),
  query("end").optional({ checkFalsy: true }).isISO8601(),
  query("status").optional().isIn(appointmentStatuses),
];

export const appointmentAvailabilityValidator = [
  query("appointmentId").optional({ checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  query("clinicianId").isString().trim().notEmpty().isLength({ max: 100 }),
  query("date").isISO8601(),
  query("durationMinutes").optional({ checkFalsy: true }).isInt({ min: 5, max: 480 }).toInt(),
  query("intervalMinutes").optional({ checkFalsy: true }).isInt({ min: 5, max: 240 }).toInt(),
];

export const createClinicianAvailabilityValidator = [
  body("clinicianId").isString().trim().notEmpty().isLength({ max: 100 }),
  body("dayOfWeek").isInt({ min: 0, max: 6 }).toInt(),
  body("startTime").matches(/^\d{2}:\d{2}$/),
  body("endTime").matches(/^\d{2}:\d{2}$/),
  body("slotIntervalMinutes").optional({ nullable: true }).isInt({ min: 5, max: 240 }).toInt(),
  body("isActive").optional().isBoolean().toBoolean(),
];

export const deleteClinicianAvailabilityValidator = [
  param("id").isString().trim().isLength({ min: 1, max: 100 }),
];

export const createAppointmentValidator = [
  body("contactId").isString().trim().notEmpty().isLength({ max: 100 }),
  body("dateTime").isISO8601(),
  ...appointmentMutationValidator,
];

export const updateAppointmentValidator = [
  param("id").isString().trim().isLength({ min: 1, max: 100 }),
  ...appointmentMutationValidator,
];
