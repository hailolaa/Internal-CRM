import { ApiError } from "../../utils/ApiError.js";
import type { ServiceAgreementRegistry } from "./service-agreements.types.js";

const HEX_SHA256 = /^[a-f0-9]{64}$/i;

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function splitPrefixes(value: string | undefined) {
  return (value || "/brand/agreements/clinicgrower/")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadServiceAgreementRegistry(): ServiceAgreementRegistry {
  return {
    legalTermsVersion: clean(process.env.SERVICE_AGREEMENT_LEGAL_TERMS_VERSION) || "",
    legalContentSha256: clean(process.env.SERVICE_AGREEMENT_LEGAL_CONTENT_SHA256) || "",
    templateVersion: clean(process.env.SERVICE_AGREEMENT_TEMPLATE_VERSION) || "clinicgrower-service-agreement-v1",
    templateSha256: clean(process.env.SERVICE_AGREEMENT_TEMPLATE_SHA256) || "",
    cssSha256: clean(process.env.SERVICE_AGREEMENT_CSS_SHA256) || "",
    assetManifestSha256: clean(process.env.SERVICE_AGREEMENT_ASSET_MANIFEST_SHA256) || "",
    allowedAssetPrefixes: splitPrefixes(process.env.SERVICE_AGREEMENT_ALLOWED_ASSET_PREFIXES),
    productionSendEnabled: process.env.SERVICE_AGREEMENT_PRODUCTION_SEND_ENABLED === "true",
  };
}

export function assertRegistryReady(registry: ServiceAgreementRegistry) {
  const missing = [
    ["legalTermsVersion", registry.legalTermsVersion],
    ["legalContentSha256", registry.legalContentSha256],
    ["templateVersion", registry.templateVersion],
    ["templateSha256", registry.templateSha256],
    ["cssSha256", registry.cssSha256],
    ["assetManifestSha256", registry.assetManifestSha256],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw ApiError.serviceUnavailable("Service agreement registry is not fully configured.", {
      missing: missing.map(([field]) => field),
    });
  }

  const hashFields: Array<[string, string]> = [
    ["legalContentSha256", registry.legalContentSha256],
    ["templateSha256", registry.templateSha256],
    ["cssSha256", registry.cssSha256],
    ["assetManifestSha256", registry.assetManifestSha256],
  ];
  for (const [field, value] of hashFields) {
    if (!HEX_SHA256.test(value)) {
      throw ApiError.serviceUnavailable("Service agreement registry contains an invalid hash.", { field });
    }
  }
}
