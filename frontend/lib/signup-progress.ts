import { api } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";

export async function getPostVerificationRoute(token: string) {
  try {
    const billingStatus = await api.billing.getStatus(token);
    const hasActiveSubscription = billingStatus.hasStripeSubscription;

    return hasActiveSubscription ? ROUTES.APP : ROUTES.ONBOARDING;
  } catch {
    return ROUTES.ONBOARDING;
  }
}
