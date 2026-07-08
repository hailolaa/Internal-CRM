import type { AuthApiDeps } from "./types";

export function createAuthRecoveryApi({ apiRequest }: AuthApiDeps) {
  return {
    async forgotPassword(email: string) {
      return apiRequest<never>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },
    async resetPassword(email: string, token: string, newPassword: string) {
      return apiRequest<never>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, token, newPassword }),
      });
    },
    async verifyEmail(email: string, token: string) {
      return apiRequest<never>("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, token }),
      });
    },
    async resendVerificationEmail(email: string) {
      return apiRequest<never>("/api/auth/resend-verification-email", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },
  };
}
