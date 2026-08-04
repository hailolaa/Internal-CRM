import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, authorizeAnyPermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { calendarController } from "./calendar.controller.js";
import {
  listCalendarMeetingsValidator,
  updateCalendarMeetingLinksValidator,
} from "./calendar.validators.js";

const router = Router();

router.use(authenticate);

router.get(
  "/status",
  authorizeAnyPermission("client_accounts:read", "contacts:read", "internal_tasks:read"),
  calendarController.getStatus,
);

router.post(
  "/oauth/start",
  authorize("SUPER_ADMIN", "ADMIN"),
  calendarController.startOAuth,
);

router.post(
  "/oauth/revoke",
  authorize("SUPER_ADMIN", "ADMIN"),
  calendarController.revoke,
);

router.post(
  "/sync",
  authorize("SUPER_ADMIN", "ADMIN"),
  calendarController.syncUpcoming,
);

router.get(
  "/meetings",
  authorizeAnyPermission("client_accounts:read", "contacts:read", "internal_tasks:read"),
  listCalendarMeetingsValidator,
  validate,
  calendarController.listMeetings,
);

router.patch(
  "/meetings/:id/links",
  authorizeAnyPermission("client_accounts:write", "contacts:write", "internal_tasks:write"),
  updateCalendarMeetingLinksValidator,
  validate,
  calendarController.updateMeetingLinks,
);

export default router;
