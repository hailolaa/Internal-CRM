import { Request, Response, NextFunction } from "express";
import { securityService } from "./security.service.js";

export class SecurityController {
  // POST /api/security/2fa/setup - Generate QR code
  setup2FA = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = (req as any).user;
      const clinicName = req.body.clinicName || "The Growth Group";
      const result = await securityService.setup2FA(userId, clinicName);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/security/2fa/enable - Verify code and activate
  enable2FA = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = (req as any).user;
      const { token } = req.body;
      const result = await securityService.enable2FA(userId, token);
      res.status(200).json({
        status: "success",
        message: "2FA enabled successfully. Save your backup codes!",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/security/2fa/disable - Turn off 2FA
  disable2FA = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = (req as any).user;
      const { password } = req.body;
      await securityService.disable2FA(userId, password);
      res.status(200).json({
        status: "success",
        message: "2FA has been disabled",
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/security/password/change - Change password
  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = (req as any).user;
      const { currentPassword, newPassword } = req.body;
      await securityService.changePassword(userId, currentPassword, newPassword);
      res.status(200).json({
        status: "success",
        message: "Password changed successfully",
      });
    } catch (error) {
      next(error);
    }
  };
}

export const securityController = new SecurityController();
