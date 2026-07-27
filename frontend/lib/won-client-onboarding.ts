export const WON_CLIENT_ONBOARDING_TASK_KEYS = [
  "owner-assignment",
  "invoice",
  "gocardless",
  "onboarding-form",
  "drive-folder",
  "website-access",
  "ga4",
  "gsc",
  "gtm",
  "google-ads",
  "gbp",
  "meta",
  "brand-assets",
  "treatment-pricing-info",
  "reporting-setup",
  "first-review",
] as const;

const canonicalTaskKeys = new Set<string>(WON_CLIENT_ONBOARDING_TASK_KEYS);

export function isCanonicalWonClientOnboardingTask(task: {
  category?: string | null;
  templateKey?: string | null;
}) {
  if (task.category !== "client_onboarding" || !task.templateKey) return false;

  const [namespace, dealId, taskKey, ...extraSegments] = task.templateKey.split(":");
  return (
    namespace === "won_client_onboarding" &&
    Boolean(dealId) &&
    Boolean(taskKey) &&
    extraSegments.length === 0 &&
    canonicalTaskKeys.has(taskKey)
  );
}
