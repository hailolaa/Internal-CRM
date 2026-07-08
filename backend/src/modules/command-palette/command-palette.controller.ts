import { Request, Response, NextFunction } from "express";
import { commandPaletteService } from "./command-palette.service.js";
import type { CommandPaletteQuery } from "./command-palette.types.js";

export class CommandPaletteController {
  getCommandPalette = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const query: CommandPaletteQuery = {};
      if (req.query.query) query.query = String(req.query.query);
      if (req.query.limit) query.limit = Number(req.query.limit);
      if (req.query.includeDisabled !== undefined) query.includeDisabled = String(req.query.includeDisabled) === "true";

      const data = await commandPaletteService.getCommandPalette(
        user.clinicId,
        user.userId,
        query,
      );

      res.status(200).json({
        status: "success",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const commandPaletteController = new CommandPaletteController();
