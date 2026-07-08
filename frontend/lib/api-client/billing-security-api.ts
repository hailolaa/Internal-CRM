import type {
  BillingCheckoutSession,
  BillingCheckoutSessionStatus,
  BillingStatus,
  TwoFactorEnableResult,
  TwoFactorSetup,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

type BillingCheckoutMode = "hosted" | "embedded";

interface BillingCheckoutOptions {
  cancelUrl?: string;
  mode?: BillingCheckoutMode;
  returnUrl?: string;
  successUrl?: string;
  trialDays?: number;
}

export function createBillingSecurityApi(apiRequest: ApiRequest) {
  return {
    billing: {
      async getStatus(token: string) {
        const response = await apiRequest<BillingStatus>(
          "/api/billing/status",
          { token },
        );
        return response.data!;
      },
      async createCheckout(
        token: string,
        planType: "starter" | "professional",
        options: BillingCheckoutOptions = {},
      ) {
        const response = await apiRequest<BillingCheckoutSession>(
          "/api/billing/checkout",
          {
            method: "POST",
            token,
            body: JSON.stringify({ planType, ...options }),
          },
        );
        return response.data!;
      },
      async getCheckoutSessionStatus(token: string, sessionId: string) {
        const response = await apiRequest<BillingCheckoutSessionStatus>(
          `/api/billing/checkout/${sessionId}/status`,
          { token },
        );
        return response.data!;
      },
      async cancelSubscription(token: string) {
        return apiRequest<never>("/api/billing/cancel", {
          method: "POST",
          token,
        });
      },
    },
    security: {
      async setup2fa(token: string) {
        const response = await apiRequest<TwoFactorSetup>(
          "/api/security/2fa/setup",
          {
            method: "POST",
            token,
          },
        );
        return response.data!;
      },
      async enable2fa(token: string, code: string) {
        const response = await apiRequest<TwoFactorEnableResult>(
          "/api/security/2fa/enable",
          {
            method: "POST",
            token,
            body: JSON.stringify({ token: code }),
          },
        );
        return response.data!;
      },
      async disable2fa(token: string, password: string) {
        return apiRequest<never>("/api/security/2fa/disable", {
          method: "POST",
          token,
          body: JSON.stringify({ password }),
        });
      },
      async changePassword(
        token: string,
        currentPassword: string,
        newPassword: string,
      ) {
        return apiRequest<never>("/api/security/password/change", {
          method: "POST",
          token,
          body: JSON.stringify({ currentPassword, newPassword }),
        });
      },
    },
  };
}
