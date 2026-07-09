import { ROUTES } from "@/lib/constants";

export async function getPostVerificationRoute(_token: string) {
  return ROUTES.APP;
}
