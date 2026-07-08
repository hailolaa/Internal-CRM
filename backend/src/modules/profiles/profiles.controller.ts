import { Request, Response, NextFunction } from "express";
import { profilesService } from "./profiles.service.js";

export class ProfilesController {
    // GET /api/profiles/clinic/me
    getClinicProfile = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const clinicId = (req as any).user.clinicId;
            const profile = await profilesService.getClinicProfile(clinicId);
            res.status(200).json({
                status: "success",
                data: profile,
            });
        } catch (error) {
            next(error);
        }
    };

    // PUT /api/profiles/clinic
    updateClinicProfile = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const clinicId = (req as any).user.clinicId;
            await profilesService.updateClinicProfile(clinicId, req.body);
            res.status(200).json({
                status: "success",
                message: "Clinic profile updated successfully"
            });
        } catch (error) {
            next(error);
        }
    };


    // GET /api/profiles/patient/:contactId
    getPatientProfile = async (req: Request,res: Response,next:NextFunction) => {
        try {
            const { contactId } = (req as any).params;
            const clinicId = (req as any).user.clinicId;
            const profile = await profilesService.getPatientProfile(contactId!, clinicId);
            res.status(200).json({
                status: "success",
                data: profile,
            });
        } catch (error) {
            next(error);
        }
    };


    // PUT /api/profiles/patient/:contactId
    updatePatientProfile = async (req: Request,res: Response,next:NextFunction) => {
        try {
            const { contactId } = (req as any).params;
            const clinicId = (req as any).user.clinicId;
            await profilesService.updatePatientProfile(contactId!, clinicId, req.body);
            res.status(200).json({
                status: "success",
                message: "Patient profile updated successfully"
            });
        } catch (error) {
            next(error);
        }
    };    
}

export const profilesController = new ProfilesController();
