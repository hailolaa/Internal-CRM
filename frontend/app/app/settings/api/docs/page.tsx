import Link from "next/link";
import { ArrowLeft, KeyRound, Server } from "lucide-react";

const endpoint = "POST /api/public/landing-page-leads";

const payload = `{
  "idempotencyKey": "lp_2026_08_04_0001",
  "accountName": "BristolDent Harbourside",
  "fullName": "Sarah Thompson",
  "email": "sarah@example.com",
  "phone": "+447700900123",
  "website": "https://exampleclinic.co.uk",
  "message": "I want help with SEO and paid ads.",
  "packageInterest": "Growth Engine",
  "landingPage": "https://clinicgrower.co.uk/growth-engine",
  "referrer": "https://google.com",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "growth_engine_august",
  "gclid": "test-click-id",
  "consent": {
    "email": true,
    "phone": true,
    "whatsapp": true,
    "permissionSource": "Landing page form checkbox"
  }
}`;

const serverExample = `const response = await fetch(
  process.env.MISSION_CONTROL_API_URL + "/api/public/landing-page-leads",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.MISSION_CONTROL_LEAD_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      idempotencyKey: submission.id,
      accountName: submission.company,
      fullName: submission.name,
      email: submission.email,
      phone: submission.phone,
      landingPage: submission.pageUrl,
      referrer: submission.referrer,
      utmSource: submission.utm_source,
      utmMedium: submission.utm_medium,
      utmCampaign: submission.utm_campaign,
      gclid: submission.gclid,
      consent: {
        email: submission.emailConsent === true,
        phone: submission.phoneConsent === true,
        whatsapp: submission.whatsappConsent === true,
        permissionSource: "Landing page form checkbox"
      }
    })
  }
);

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message || "Mission Control lead capture failed");
}`;

function CodeBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#E5DED6] bg-white">
      <div className="border-b border-[#EEE8E1] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7A746A]">
          {title}
        </p>
      </div>
      <pre className="overflow-auto p-4 text-xs leading-5 text-[#252421]">
        <code>{value}</code>
      </pre>
    </div>
  );
}

export default function ApiKeyDocsPage() {
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link
          href="/app/settings/api"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B625A] hover:text-[#252421]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to API Keys
        </Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#7A746A]">
          Integration Docs
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#252421]">
          Landing-Page Lead Capture
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6B625A]">
          Use this endpoint from a landing-page backend or serverless function. Do not call it from
          browser JavaScript, because the API key must stay private.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#E5DED6] bg-[#FFFCF9] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EFEAE4] text-[#6B625A]">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#252421]">Authentication</h2>
              <p className="mt-1 text-sm leading-6 text-[#6B625A]">
                Create a key with the Landing-page lead capture purpose. The raw key is only shown
                when it is created or rotated.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#E5DED6] bg-[#FFFCF9] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EFEAE4] text-[#6B625A]">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#252421]">Lead workflow</h2>
              <p className="mt-1 text-sm leading-6 text-[#6B625A]">
                Valid submissions reuse the existing prospect, attribution, pipeline and follow-up
                task flow. Retries should send the same idempotency key.
              </p>
            </div>
          </div>
        </div>
      </section>

      <CodeBlock
        title="Request"
        value={`${endpoint}
Authorization: Bearer <landing-page-api-key>
Content-Type: application/json`}
      />
      <CodeBlock title="Example payload" value={payload} />
      <CodeBlock title="Server-side example" value={serverExample} />
    </div>
  );
}
