import { Request, Response, NextFunction } from "express";
import { appointmentsService } from "./appointments.service.js";

export class AppointmentsController {
  // GET /api/appointments
  // Read clinic appointments in a requested calendar range
  listAppointments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const appointments = await appointmentsService.listAppointments(clinicId, req.query as any);
      res.status(200).json({ status: "success", data: appointments });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/appointments/clinicians
  // List active clinic users who can own appointment slots
  listClinicians = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const clinicians = await appointmentsService.listClinicians(clinicId);
      res.status(200).json({ status: "success", data: clinicians });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/appointments/availability
  // Return bookable slots for one clinician on one calendar date
  getAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const availability = await appointmentsService.getAvailability(clinicId, req.query as any);
      res.status(200).json({ status: "success", data: availability });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/appointments/availability
  // Create a clinician availability window (weekly recurring)
  createAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await appointmentsService.createClinicianAvailability(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/appointments/availability/:id
  // Soft-delete a clinician availability row
  deleteAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await appointmentsService.deleteClinicianAvailability(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Availability removed" });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/appointments
  // Book a consult appointment for an existing clinic contact
  createAppointment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const appointment = await appointmentsService.createAppointment(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: appointment });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/appointments/:id
  // Reschedule or update status/practitioner on a clinic appointment
  updateAppointment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const appointment = await appointmentsService.updateAppointment(
        clinicId,
        userId,
        req.params.id as string,
        req.body,
      );
      res.status(200).json({ status: "success", data: appointment });
    } catch (error) {
      next(error);
    }
  };
}

export const appointmentsController = new AppointmentsController();
