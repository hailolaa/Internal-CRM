import type { NextFunction, Request, Response } from "express";
import { config } from "../config/index.js";

type ContainedAction = { methods: string[]; pattern: RegExp; label: string };

const containedActions: ContainedAction[] = [
  { methods: ["POST"], pattern: /^\/api\/proposals\/[^/]+\/(?:send|version-lock)$/, label: "proposal external sends" },
  { methods: ["POST"], pattern: /^\/api\/team\/(?:invite|invitations\/[^/]+\/resend)$/, label: "team invitations" },
  { methods: ["POST"], pattern: /^\/api\/billing\/(?:checkout|cancel)$/, label: "billing changes" },
  { methods: ["POST"], pattern: /^\/api\/deposits\/session$/, label: "payment sessions" },
  { methods: ["POST"], pattern: /^\/api\/sequences\/run-due$/, label: "due sequence execution" },
  { methods: ["POST", "PATCH", "DELETE"], pattern: /^\/api\/pipeline\/stages(?:\/[^/]+)?$/, label: "pipeline stage configuration" },
  { methods: ["POST", "PATCH", "DELETE"], pattern: /^\/api\/automations(?:\/[^/]+)?$/, label: "automation builder" },
  { methods: ["POST"], pattern: /^\/api\/forms$/, label: "form builder" },
  { methods: ["PATCH", "DELETE"], pattern: /^\/api\/forms\/[^/]+$/, label: "form builder" },
  { methods: ["POST"], pattern: /^\/api\/comms\/inbox\/[^/]+\/messages$/, label: "external communications" },
  { methods: ["POST"], pattern: /^\/api\/comms\/whatsapp\/conversations\/[^/]+\/messages$/, label: "WhatsApp sends" },
  { methods: ["POST"], pattern: /^\/api\/comms\/whatsapp\/ai-replies\/[^/]+\/(?:approve|retry)$/, label: "WhatsApp sends" },
  { methods: ["POST"], pattern: /^\/api\/contacts\/[^/]+\/actions\/message-template$/, label: "external communications" },
  { methods: ["POST"], pattern: /^\/api\/message-templates\/[^/]+\/test-send$/, label: "external communications" },
];

export function getContainedProductionAction(method: string, path: string) {
  return containedActions.find((action) => action.methods.includes(method.toUpperCase()) && action.pattern.test(path)) || null;
}

export function productionContainment(req: Request, res: Response, next: NextFunction) {
  if (config.nodeEnv !== "production" || config.productionSafety.unsafeActionsEnabled) {
    next();
    return;
  }
  const action = getContainedProductionAction(req.method, req.path);
  if (!action) {
    next();
    return;
  }
  res.status(503).json({
    status: "error",
    code: "PRODUCTION_ACTION_CONTAINED",
    message: `${action.label} are temporarily disabled pending Gate 2 approval.`,
  });
}
