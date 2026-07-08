import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { appointmentsController } from "./appointments.controller.js";
import {
  appointmentAvailabilityValidator,
  createAppointmentValidator,
  listAppointmentsValidator,
  updateAppointmentValidator,
} from "./appointments.validators.js";
import { createClinicianAvailabilityValidator, deleteClinicianAvailabilityValidator } from "./appointments.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/appointments
// @desc    List clinic appointments in a date range
// @access  Private
router.get(
  "/",
  authorizePermission("appointments:read"),
  listAppointmentsValidator,
  validate,
  appointmentsController.listAppointments,
);

// @route   GET /api/appointments/clinicians
// @desc    List clinic users who can own appointment slots
// @access  Private
router.get(
  "/clinicians",
  authorizePermission("appointments:read"),
  appointmentsController.listClinicians,
);

// @route   GET /api/appointments/availability
// @desc    List bookable slots for a clinician and date
// @access  Private
router.get(
  "/availability",
  authorizePermission("appointments:read"),
  appointmentAvailabilityValidator,
  validate,
  appointmentsController.getAvailability,
);

// Manage clinician availability
router.post(
  "/availability",
  authorizePermission("appointments:write"),
  createClinicianAvailabilityValidator,
  validate,
  appointmentsController.createAvailability,
);

router.delete(
  "/availability/:id",
  authorizePermission("appointments:write"),
  deleteClinicianAvailabilityValidator,
  validate,
  appointmentsController.deleteAvailability,
);

// @route   POST /api/appointments
// @desc    Create a consult appointment
// @access  Private
router.post(
  "/",
  authorizePermission("appointments:write"),
  createAppointmentValidator,
  validate,
  appointmentsController.createAppointment,
);

// @route   PATCH /api/appointments/:id
// @desc    Update a consult appointment
// @access  Private
router.patch(
  "/:id",
  authorizePermission("appointments:write"),
  updateAppointmentValidator,
  validate,
  appointmentsController.updateAppointment,
);

export default router;
