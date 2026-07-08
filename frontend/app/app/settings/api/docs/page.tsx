import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const examples = [
  {
    title: "List Contacts",
    code: `curl -X GET "https://api.clinicgrower.ai/api/contacts" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
  },
  {
    title: "Submit Public Form",
    code: `curl -X POST "https://api.clinicgrower.ai/api/public/forms/FORM_ID/submit" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"firstName":"Sarah","email":"sarah@example.com"}'`,
  },
];

export default function ApiDocsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/settings/api"
          className="rounded-lg p-2 hover:bg-[rgba(0,0,0,0.04)]"
        >
          <ArrowLeft className="h-5 w-5 text-[#6B7280]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">API Documentation</h1>
          <p className="text-sm text-[#6B7280]">
            Use workspace-scoped API keys from Settings to authenticate server requests.
          </p>
        </div>
      </div>

      <div className="rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] p-6">
        <h2 className="font-semibold text-[#111111]">Authentication</h2>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">
          Send your API key as a bearer token. Keys are scoped to the workspace that
          created them and should only be stored on secure servers.
        </p>
      </div>

      <div className="grid gap-4">
        {examples.map((example) => (
          <div
            key={example.title}
            className="rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] p-6"
          >
            <h2 className="font-semibold text-[#111111]">{example.title}</h2>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-[#111111] p-4 text-sm text-gray-300">
              {example.code}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
