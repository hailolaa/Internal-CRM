import { Request, Response, NextFunction } from "express";
import { settingsService } from "./settings.service.js";

export class SettingsController { 

    //GET /api/settings/preferences
    //Fetch current user's UI and notification preferences   
  getPreferences = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.userId;
      const preferences = await settingsService.getUserPreferences(userId);
      res.status(200).json({
        status: "success",
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  };

  
    // PUT /api/settings/preferences
    // Update current user's UI and notification preferences
   
  updatePreferences = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.userId;
      await settingsService.updatePreferences(userId, req.body);
      res.status(200).json({
        status: "success",
        message: "Preferences updated successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  
  // GET /api/settings/security
  // Fetch current user's security status (e.g., 2FA enabled?)
   
  getSecuritySettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.userId;
      const security = await settingsService.getSecuritySettings(userId);
      res.status(200).json({
        status: "success",
        data: security,
      });
    } catch (error) {
      next(error);
    }
  };


  // PUT /api/settings/security/2fa
  // Enable or disable Two-Factor Authentication
  
  toggle2FA = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.userId;
      const { twoFactorEnabled } = req.body;
      await settingsService.toggle2FA(userId, twoFactorEnabled);
      res.status(200).json({
        status: "success",
        message: `Two-factor authentication ${twoFactorEnabled ? "enabled" : "disabled"} successfully`,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const settingsController = new SettingsController();
