import type { ApiRequest } from "./core";
import { createCatalogApi } from "./catalog-api";
import { createComplianceApi } from "./compliance-api";
import { createDeveloperSettingsApi } from "./developer-settings-api";
import { createLocationsIntegrationsApi } from "./locations-integrations-api";

export function createClinicSetupApi(apiRequest: ApiRequest) {
  return {
    ...createLocationsIntegrationsApi(apiRequest),
    ...createCatalogApi(apiRequest),
    ...createDeveloperSettingsApi(apiRequest),
    ...createComplianceApi(apiRequest),
  };
}
