import Stripe from "stripe";
import { config } from "../config/index.js";
import { ApiError } from "./ApiError.js";

function isConfiguredSecret(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.startsWith("sk_") &&
    trimmed.length > 20 &&
    !trimmed.includes("...") &&
    !trimmed.toLowerCase().includes("placeholder")
  );
}

export function getStripeClient() {
  const secretKey = config.stripe.secretKey.trim();

  if (!isConfiguredSecret(secretKey)) {
    throw ApiError.badRequest("Stripe is not configured yet.");
  }

  return new Stripe(secretKey);
}

export function assertStripePriceId(priceId: string | undefined) {
  const trimmed = priceId?.trim() || "";
  if (!trimmed || trimmed.includes("...")) {
    throw ApiError.badRequest("Stripe price ID is not configured for this plan.");
  }

  return trimmed;
}
