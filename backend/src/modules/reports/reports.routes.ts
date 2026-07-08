import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { reportsController } from "./reports.controller.js";
import { exportReportValidator, updateReportWorkflowValidator } from "./reports.validators.js";

const router = Router();

// @route   GET /api/reports/shared/:token
// @desc    Read a report snapshot from a secure share token
// @access  Public
router.get("/shared/:token", reportsController.getSharedReport);

router.use(authenticate);

// @route   GET /api/reports
// @desc    List saved report snapshots
// @access  Private
router.get("/", authorizePermission("reports:read"), reportsController.listReports);

// @route   POST /api/reports/monthly
// @desc    Generate or refresh a monthly report snapshot
// @access  Private
router.post("/monthly", authorizePermission("reports:write"), reportsController.generateMonthlyReport);

// @route   GET /api/reports/dashboards
// @desc    List dashboard definitions
// @access  Private
router.get("/dashboards", authorizePermission("reports:read"), reportsController.listDashboards);

// @route   GET /api/reports/exports/:type
// @desc    Export Phase 1 report data as CSV for revenue, attribution, pipeline or operational reports
// @access  Private
router.get(
  "/exports/:type",
  authorizePermission("reports:read"),
  exportReportValidator,
  validate,
  reportsController.exportPhase1Report,
);

// @route   GET /api/reports/dashboard/summary
// @desc    Live dashboard summary metrics
// @access  Private
router.get("/dashboard/summary", authorizePermission("reports:read"), reportsController.getDashboardSummary);

// @route   GET /api/reports/dashboard/funnel
// @desc    Live dashboard funnel metrics
// @access  Private
router.get("/dashboard/funnel", authorizePermission("reports:read"), reportsController.getDashboardFunnel);

// @route   GET /api/reports/dashboard/revenue-by-channel
// @desc    Live dashboard revenue by channel
// @access  Private
router.get("/dashboard/revenue-by-channel", authorizePermission("reports:read"), reportsController.getRevenueByChannel);

// @route   GET /api/reports/dashboard/revenue-by-treatment
// @desc    Live dashboard revenue by treatment
// @access  Private
router.get("/dashboard/revenue-by-treatment", authorizePermission("reports:read"), reportsController.getRevenueByTreatment);

// @route   GET /api/reports/treatments/:treatment/detail
// @desc    Treatment-level performance drill-down with linked records
// @access  Private
router.get("/treatments/:treatment/detail", authorizePermission("reports:read"), reportsController.getTreatmentPerformanceDetail);

// @route   GET /api/reports/dashboard/revenue-leaks
// @desc    Live dashboard leakage metrics
// @access  Private
router.get("/dashboard/revenue-leaks", authorizePermission("reports:read"), reportsController.getRevenueLeaks);

// @route   GET /api/reports/dashboard/revenue-leak-details
// @desc    Live dashboard leakage source records
// @access  Private
router.get("/dashboard/revenue-leak-details", authorizePermission("reports:read"), reportsController.getRevenueLeakDetails);

// @route   GET /api/reports/dashboard/top-opportunities
// @desc    Live dashboard top opportunities
// @access  Private
router.get("/dashboard/top-opportunities", authorizePermission("reports:read"), reportsController.getTopOpportunities);

// @route   GET /api/reports/dashboard/monthly-trend
// @desc    Live dashboard monthly trend metrics
// @access  Private
router.get("/dashboard/monthly-trend", authorizePermission("reports:read"), reportsController.getMonthlyTrend);

// @route   GET /api/reports/dashboard/risk-opportunity-sections
// @desc    Live dashboard top risks and opportunities sections
// @access  Private
router.get("/dashboard/risk-opportunity-sections", authorizePermission("reports:read"), reportsController.getRiskOpportunitySections);

// @route   GET /api/reports/:id
// @desc    Get one saved report snapshot
// @access  Private
router.get("/:id", authorizePermission("reports:read"), reportsController.getReport);

// @route   POST /api/reports/:id/share
// @desc    Create a secure share token for a saved report
// @access  Private
router.post("/:id/share", authorizePermission("reports:write"), reportsController.createReportShare);

// @route   PATCH /api/reports/:id/workflow
// @desc    Update report annotations and approval workflow
// @access  Private
router.patch(
  "/:id/workflow",
  authorizePermission("reports:write"),
  updateReportWorkflowValidator,
  validate,
  reportsController.updateReportWorkflow,
);

export default router;
