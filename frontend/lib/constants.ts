// ============================================================
// Application-wide constants
// ============================================================

export const LOGO_URL =
  "https://eu.chat-img.sintra.ai/57e4b3da-c2ee-48f8-956d-828adc30d734/0588879f-1cbe-4b7a-8b40-812b6a74b739/Copy_20of_20Copy_20of_20Clinic-Grower-Logo-Trademark-Light-Centralised-NO-slogan-withBG.png";

export const APP_NAME = "Clinic Grower Internal CRM";
export const APP_TAGLINE = "Internal sales and delivery operations";

// Route paths
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  VERIFY_EMAIL: "/verify-email",
  FORGOT_PASSWORD: "/forgot-password",
  ONBOARDING: "/onboarding",
  APP: "/app",
  REVENUE: "/app/crm/pipeline",
  LEADS: "/app/leads",
  CONSULTS: "/app/consults",
  SLA: "/app/sla",
  ATTRIBUTION: "/app/marketing/attribution",
  AUTOMATIONS: "/app/ops/automations",
  AI_GROWTH_BRIEF: "/app/ai/growth-brief",
  SETTINGS: "/app/settings",
  BILLING: "/app/settings/billing",
  CALLS: "/app/comms/calls",
  DEPOSITS: "/app/deposits",
} as const;

// Page title map for TopBar - ordered longest-first for accurate prefix matching
export const PAGE_TITLES: Record<string, string> = {
  // Sales
  "/app/revenue": "Operations Dashboard",
  "/app/leads": "Prospect List",
  "/app/consults": "Sales Call Tracking",
  "/app/sla": "Response Time Monitoring",
  "/app/retention": "Client Retention",
  "/app/benchmarking": "Legacy Benchmarking",
  "/app/competitor-analysis": "Market Intelligence",
  "/app/deposits": "Legacy Billing Module",

  // CRM
  "/app/crm/contacts": "Contacts",
  "/app/crm/pipeline": "Sales Pipeline",
  "/app/crm/calendar": "Legacy Calendar",
  "/app/crm/tasks": "Internal Tasks",
  "/app/crm/forms": "Forms",
  "/app/treatment-plans": "Legacy Proposals",

  // Marketing
  "/app/marketing/attribution": "Attribution Reporting",
  "/app/marketing/campaigns": "Campaign Visibility",
  "/app/marketing/offers": "Offers",
  "/app/marketing/reviews": "Legacy Marketing Tools",

  // Communications
  "/app/comms/inbox": "Communication Centre",
  "/app/comms/calls/analysis": "Legacy Communications Analysis",
  "/app/comms/calls/analytics": "Legacy Communications Analytics",
  "/app/comms/calls/compliance": "Legacy Communications Compliance",
  "/app/comms/calls": "Call Log",
  "/app/comms/templates": "Templates",
  "/app/comms/sequences": "Follow-Up Sequences",

  // Operations
  "/app/ops/automations": "Automation Engine",
  "/app/ops/team": "Team Members",
  "/app/ops/client-accounts": "Client Accounts",
  "/app/ops/roles": "Roles & Permissions",
  "/app/ops/sops": "SOPs",

  // AI Growth Insights
  "/app/ai/growth-brief": "Weekly Growth Brief",
  "/app/ai/campaign-analyst": "Campaign Analysis",
  "/app/ai/sales-assistant": "Conversion Tracking",
  "/app/ai/show-rate": "Missed Opportunity Tracking",
  "/app/ai/ltv-optimiser": "ROI Reporting",
  "/app/ai/agents": "AI Growth Insights",
  "/app/ai": "AI Growth Insights",

  // Reports
  "/app/reports/overview": "Legacy Reports",
  "/app/reports/leads": "Sales Pipeline Report",
  "/app/reports/ads": "Marketing Spend Report",
  "/app/reports/noshows": "Client Retention Report",

  // Legacy modules
  "/app/patients": "Legacy Contact Module",
  "/app/financials": "Financials",

  // Integrations
  "/app/integrations": "Integrations",

  // Settings
  "/app/settings/clinic": "Account Profile",
  "/app/settings/team": "Team Settings",
  "/app/settings/locations": "Office Locations",
  "/app/settings/treatments": "Legacy Service Catalogue",
  "/app/settings/billing": "Billing & Plans",
  "/app/settings/security": "Security",
  "/app/settings/compliance": "Compliance",
  "/app/settings/api": "API Keys",
  "/app/settings/roles": "Roles",
  "/app/settings": "Settings",

  // Admin
  "/app/admin": "Platform Admin",

  // Phase Three
  "/app/multi-location": "Multi-Location",
  "/app/ai-forecasting": "AI Forecasting",
};

// Breakpoints (for reference, Tailwind handles actual CSS)
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
} as const;
