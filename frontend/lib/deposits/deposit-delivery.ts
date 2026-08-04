import type {
  DepositDeliveryCapability,
  DepositDeliveryResult,
} from "@/lib/api-types";

export type DepositDeliveryFeedback = {
  tone: "success" | "info" | "error";
  title: string;
  detail: string | null;
};

export function isExpiredDepositCheckoutError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { message?: unknown; status?: unknown };
  return (
    candidate.status === 409 &&
    typeof candidate.message === "string" &&
    /expired/i.test(candidate.message)
  );
}

function providerName(provider: DepositDeliveryResult["provider"]) {
  if (provider === "brevo") return "Brevo";
  if (provider === "twilio") return "Twilio";
  return "the messaging provider";
}

export function canDeliverDepositMessage(
  capability: DepositDeliveryCapability | null | undefined,
) {
  if (!capability?.preferredChannel) return false;
  return capability[capability.preferredChannel].available;
}

export function getDepositDeliveryUnavailableReason(
  capability: DepositDeliveryCapability | null | undefined,
) {
  if (!capability) {
    return "Delivery availability could not be confirmed. Refresh before trying again.";
  }

  if (capability.preferredChannel) {
    return (
      capability[capability.preferredChannel].reason ||
      "The preferred delivery channel is unavailable."
    );
  }

  return (
    capability.email.reason ||
    capability.sms.reason ||
    "Add a patient email address or mobile number to send this message."
  );
}

export function getDepositRequestActionLabel(
  capability: DepositDeliveryCapability | null | undefined,
) {
  return canDeliverDepositMessage(capability)
    ? "Send deposit request"
    : "Create payment link";
}

export function describeDepositDelivery(
  delivery: DepositDeliveryResult | null | undefined,
  options: { hasPaymentLink?: boolean; kind?: "request" | "reminder" } = {},
): DepositDeliveryFeedback {
  const kind = options.kind || "request";
  const noun = kind === "reminder" ? "Reminder" : "Deposit request";

  if (!delivery) {
    return options.hasPaymentLink
      ? {
          tone: "info",
          title: "Payment link ready",
          detail: "No delivery result was returned. Copy the link to share it manually.",
        }
      : {
          tone: "error",
          title: `${noun} outcome unavailable`,
          detail: "The server did not confirm whether a message was accepted.",
        };
  }

  if (delivery.status === "accepted" && delivery.channel === "email") {
    return {
      tone: "success",
      title: "Email accepted",
      detail: `Accepted by ${providerName(delivery.provider)}${
        delivery.providerMessageId ? ` · reference ${delivery.providerMessageId}` : ""
      }.`,
    };
  }

  if (delivery.status === "accepted" && delivery.channel === "sms") {
    const providerStatus = delivery.providerStatus?.toLowerCase();
    if (providerStatus === "delivered") {
      return {
        tone: "success",
        title: "SMS delivered",
        detail: `Confirmed by ${providerName(delivery.provider)}${
          delivery.providerMessageId
            ? ` · reference ${delivery.providerMessageId}`
            : ""
        }.`,
      };
    }
    if (providerStatus === "failed" || providerStatus === "undelivered") {
      return {
        tone: "error",
        title: "SMS delivery failed",
        detail:
          delivery.reason ||
          `${providerName(delivery.provider)} reported ${providerStatus}.`,
      };
    }
    const queued = providerStatus === "queued";
    return {
      tone: queued ? "info" : "success",
      title: queued ? "SMS queued" : "SMS accepted",
      detail: `${queued ? "Queued with" : "Accepted by"} ${providerName(
        delivery.provider,
      )}${delivery.providerMessageId ? ` · reference ${delivery.providerMessageId}` : ""}.`,
    };
  }

  if (delivery.status === "pending") {
    return {
      tone: "info",
      title: `${noun} pending`,
      detail:
        delivery.reason ||
        (delivery.channel
          ? `Waiting for ${providerName(delivery.provider)} to accept the ${delivery.channel}.`
          : "Delivery is still being processed."),
    };
  }

  if (delivery.status === "unavailable") {
    return options.hasPaymentLink
      ? {
          tone: "info",
          title: "Payment link ready",
          detail:
            delivery.reason ||
            "No message was sent. Copy the payment link to share it manually.",
        }
      : {
          tone: "error",
          title: `${noun} not sent`,
          detail:
            delivery.reason ||
            "No configured email or SMS channel is available for this patient.",
        };
  }

  return {
    tone: "error",
    title: `${noun} failed`,
    detail:
      delivery.reason ||
      (options.hasPaymentLink
        ? "The message was not accepted, but the payment link is ready to copy."
        : "The messaging provider did not accept this delivery."),
  };
}

export function getDepositDeliveryEvidenceLabel(
  delivery: DepositDeliveryResult | null | undefined,
  kind: "request" | "reminder" = "request",
) {
  if (!delivery) return "No delivery recorded";
  return describeDepositDelivery(delivery, { kind }).title;
}
