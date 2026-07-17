import "dotenv/config";

function required(name) {
  const value = (process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function publicWebhookUrl() {
  const explicit = (process.env.EMAIL_INBOUND_PUBLIC_URL || "").trim();
  const secret = required("EMAIL_INBOUND_WEBHOOK_SECRET");

  if (explicit) {
    const url = new URL(explicit);
    url.searchParams.set("secret", secret);
    return url.toString();
  }

  const apiPublicUrl = required("API_PUBLIC_URL").replace(/\/+$/, "");
  const baseUrl = apiPublicUrl.endsWith("/api")
    ? apiPublicUrl.slice(0, -"/api".length)
    : apiPublicUrl;
  const url = new URL(`${baseUrl}/api/webhooks/email/inbound`);
  url.searchParams.set("secret", secret);
  return url.toString();
}

async function main() {
  const apiKey = required("BREVO_API_KEY");
  const domain = required("BREVO_INBOUND_DOMAIN");
  const url = publicWebhookUrl();

  const response = await fetch("https://api.brevo.com/v3/webhooks", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "inbound",
      events: ["inboundEmailProcessed"],
      url,
      domain,
      description: "Mission Control inbound email parsing",
    }),
  });

  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep raw body
  }

  if (!response.ok) {
    console.error("Brevo inbound webhook setup failed", {
      status: response.status,
      body,
    });
    process.exit(1);
  }

  const redactedUrl = new URL(url);
  if (redactedUrl.searchParams.has("secret")) {
    redactedUrl.searchParams.set("secret", "[redacted]");
  }

  console.log("Brevo inbound webhook created", {
    domain,
    webhookUrl: redactedUrl.toString(),
    response: body,
  });
  console.log("DNS required for the inbound domain:");
  console.log(`${domain} MX 10 inbound1.sendinblue.com.`);
  console.log(`${domain} MX 20 inbound2.sendinblue.com.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
