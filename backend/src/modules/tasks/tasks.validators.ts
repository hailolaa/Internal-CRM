import { body, param, query } from "express-validator";

const priorities = ["low", "medium", "high"];
const statuses = ["pending", "completed"];
const serviceTypes = ["ppc", "seo", "gbp", "website", "landing_pages", "cro", "strategy", "other"];
const approvalStatuses = ["not_required", "pending", "approved", "rejected", "needs_changes"];

function isQaChecklist(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;

  const checklist = value as { items?: unknown };
  if (!Array.isArray(checklist.items)) return false;
  if (checklist.items.length > 100) return false;

  return checklist.items.every((item) => {
    if (typeof item === "string") return item.trim().length > 0 && item.length <= 255;
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;

    const entry = item as { label?: unknown; checked?: unknown; status?: unknown; notes?: unknown };
    const hasLabel = typeof entry.label === "string" && entry.label.trim().length > 0 && entry.label.length <= 255;
    const validChecked = entry.checked === undefined || typeof entry.checked === "boolean";
    const validStatus = entry.status === undefined || ["pending", "passed", "failed", "needs_changes"].includes(String(entry.status));
    const validNotes = entry.notes === undefined || (typeof entry.notes === "string" && entry.notes.length <= 1000);
    return hasLabel && validChecked && validStatus && validNotes;
  });
}

export const createTaskValidator = [
  body("title").trim().notEmpty().withMessage("Task title is required").isLength({ max: 255 }),
  body("description").optional({ nullable: true }).trim(),
  body("priority").optional().isIn(priorities),
  body("status").optional().isIn(statuses),
  body("category").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("contactId").optional({ nullable: true }).isUUID(),
  body("contact").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("due").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("dueDate").optional({ nullable: true }).isISO8601().toDate(),
  body("assignedTo").optional({ nullable: true }).trim().isLength({ max: 255 }),
];

export const updateTaskValidator = [
  param("id").isUUID().withMessage("Invalid task ID format"),
  body("title").optional().trim().notEmpty().isLength({ max: 255 }),
  body("description").optional({ nullable: true }).trim(),
  body("priority").optional().isIn(priorities),
  body("status").optional().isIn(statuses),
  body("category").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("contactId").optional({ nullable: true }).isUUID(),
  body("contact").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("due").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("dueDate").optional({ nullable: true }).isISO8601().toDate(),
  body("assignedTo").optional({ nullable: true }).trim().isLength({ max: 255 }),
];

export const taskIdParamValidator = [
  param("id").isUUID().withMessage("Invalid task ID format"),
];

export const listInternalTasksValidator = [
  query("boardKey").optional().trim().isLength({ max: 100 }),
  query("serviceType").optional().isIn(serviceTypes),
  query("clientAccountProfileId").optional().isUUID(),
  query("clientAccountServiceId").optional().isUUID(),
  query("assignedUserId").optional().isUUID(),
  query("status").optional().isIn(statuses),
  query("overdue").optional().isBoolean(),
  query("completed").optional().isBoolean(),
  query("needsQa").optional().isBoolean(),
  query("approvalStatus").optional().isIn(approvalStatuses),
  query("missedTask").optional().isBoolean(),
  query("escalationFlag").optional().isBoolean(),
  query("includeArchived").optional().isBoolean(),
  query("workflowMonth").optional().isISO8601(),
];

export const createInternalTaskValidator = [
  body("title").trim().notEmpty().withMessage("Task title is required").isLength({ max: 255 }),
  body("description").optional({ nullable: true }).trim(),
  body("priority").optional().isIn(priorities),
  body("status").optional().isIn(statuses),
  body("category").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("contactId").optional({ nullable: true }).isUUID(),
  body("contact").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("due").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("dueDate").optional({ nullable: true }).isISO8601().toDate(),
  body("assignedTo").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("boardKey").trim().notEmpty().withMessage("Board key is required").isLength({ max: 100 }),
  body("serviceType").optional({ nullable: true }).isIn(serviceTypes),
  body("clientAccountProfileId").optional({ nullable: true }).isUUID(),
  body("clientAccountServiceId").optional({ nullable: true }).isUUID(),
  body("assignedUserId").optional({ nullable: true }).isUUID(),
  body("proofReference").optional({ nullable: true }).trim().isLength({ max: 500 }),
  body("workflowMonth").optional({ nullable: true }).isISO8601().toDate(),
  body("templateKey").optional({ nullable: true }).trim().isLength({ max: 150 }),
  body("recurrenceRule").optional({ nullable: true }).isObject(),
];

export const updateInternalTaskQaValidator = [
  param("id").isUUID().withMessage("Invalid task ID format"),
  body("needsQa").optional().isBoolean(),
  body("qaChecklist")
    .optional({ nullable: true })
    .custom(isQaChecklist)
    .withMessage("QA checklist must include an items array of strings or checklist item objects"),
  body("approvalStatus").optional().isIn(approvalStatuses),
  body("reviewerUserId").optional({ nullable: true }).isUUID(),
  body("completionProofReference").optional({ nullable: true }).trim().isLength({ max: 500 }),
  body("missedTask").optional().isBoolean(),
  body("escalationFlag").optional().isBoolean(),
  body("freelancerTeamScore").optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
];

export const updateInternalTaskValidator = [
  param("id").isUUID().withMessage("Invalid task ID format"),
  body("title").optional().trim().notEmpty().isLength({ max: 255 }),
  body("description").optional({ nullable: true }).trim(),
  body("priority").optional().isIn(priorities),
  body("status").optional().isIn(statuses),
  body("category").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("contactId").optional({ nullable: true }).isUUID(),
  body("contact").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("due").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("dueDate").optional({ nullable: true }).isISO8601().toDate(),
  body("assignedTo").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("boardKey").optional().trim().notEmpty().isLength({ max: 100 }),
  body("serviceType").optional({ nullable: true }).isIn(serviceTypes),
  body("clientAccountProfileId").optional({ nullable: true }).isUUID(),
  body("clientAccountServiceId").optional({ nullable: true }).isUUID(),
  body("assignedUserId").optional({ nullable: true }).isUUID(),
  body("proofReference").optional({ nullable: true }).trim().isLength({ max: 500 }),
  body("workflowMonth").optional({ nullable: true }).isISO8601().toDate(),
  body("templateKey").optional({ nullable: true }).trim().isLength({ max: 150 }),
  body("recurrenceRule").optional({ nullable: true }).isObject(),
];
