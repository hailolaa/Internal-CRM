import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createClinicAndAdmin(prefix: string) {
  const result = await authService.registerClinic({
    clinicName: `${prefix} Clinic`,
    adminEmail: uniqueEmail(`${prefix}_admin`),
    adminPassword: "password123",
    firstName: prefix,
    lastName: "Admin",
    phone: "555-0100",
  });

  return {
    clinicId: result.user.clinicId,
    userId: result.user.id,
    token: result.tokens.token,
  };
}

async function fetchJson(baseUrl: string, path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const body: any = await response.json();
  return { response, body };
}

test("marketing connector workflows expose health, sync metrics, preserve fallback, and stay tenant scoped", async () => {
  await testConnection();
  console.log("[marketing-connectors] database connection OK");

  const primary = await createClinicAndAdmin("MarketingConnectorPrimary");
  const secondary = await createClinicAndAdmin("MarketingConnectorSecondary");

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start marketing connector test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const initialStatus = await fetchJson(baseUrl, "/api/integrations/connectors/status", primary.token);
    assert.equal(initialStatus.response.status, 200);
    assert.equal(initialStatus.body.data.some((item: any) => item.type === "google_ads" && item.manualFallbackAvailable), true);
    assert.equal(initialStatus.body.data.some((item: any) => item.type === "ga4"), true);
    console.log("[marketing-connectors] connector status list passed");

    const definitions = await fetchJson(baseUrl, "/api/integrations/connectors/definitions", primary.token);
    assert.equal(definitions.response.status, 200);
    const googleAdsDefinition = definitions.body.data.find((item: any) => item.type === "google_ads");
    const seoDefinition = definitions.body.data.find((item: any) => item.type === "seo");
    assert.equal(googleAdsDefinition.oauthSupported, true);
    assert.equal(googleAdsDefinition.configFields.some((field: any) => field.key === "customerId" && field.required), true);
    assert.equal(seoDefinition.oauthSupported, true);
    assert.equal(seoDefinition.requiredScopes.includes("https://www.googleapis.com/auth/webmasters.readonly"), true);
    assert.equal(seoDefinition.configFields.some((field: any) => field.key === "siteUrl" && field.required), true);
    console.log("[marketing-connectors] connector definitions passed");

    const oauthWithoutPreselectedProperty = await fetchJson(baseUrl, "/api/integrations/connectors/ga4/oauth/start", primary.token, {
      method: "POST",
      body: JSON.stringify({ config: {} }),
    });
    assert.equal(oauthWithoutPreselectedProperty.response.status, 200);
    assert.match(oauthWithoutPreselectedProperty.body.data.authorizeUrl, /accounts\.google\.com/);
    console.log("[marketing-connectors] oauth starts without preselected account passed");

    const seoOauth = await fetchJson(baseUrl, "/api/integrations/connectors/seo/oauth/start", primary.token, {
      method: "POST",
      body: JSON.stringify({ config: { siteUrl: "https://exampleclinic.test" } }),
    });
    assert.equal(seoOauth.response.status, 200);
    assert.match(seoOauth.body.data.authorizeUrl, /accounts\.google\.com/);
    assert.match(seoOauth.body.data.authorizeUrl, /webmasters\.readonly/);
    console.log("[marketing-connectors] SEO oauth start passed");

    const missingPermissions = await fetchJson(baseUrl, "/api/integrations/connectors/google_ads/setup", primary.token, {
      method: "POST",
      body: JSON.stringify({
        config: { customerId: "123-456-7890" },
        missingPermissions: ["ads.readonly"],
      }),
    });
    assert.equal(missingPermissions.response.status, 200);
    assert.equal(missingPermissions.body.data.setupStatus, "missing_permissions");
    assert.equal(missingPermissions.body.data.healthStatus, "warning");
    assert.deepEqual(missingPermissions.body.data.missingPermissions, ["ads.readonly"]);
    console.log("[marketing-connectors] missing permission state passed");

    const setup = await fetchJson(baseUrl, "/api/integrations/connectors/google_ads/setup", primary.token, {
      method: "POST",
      body: JSON.stringify({
        config: {
          customerId: "123-456-7890",
          oauthConnected: true,
          accessToken: "raw-access-token-should-not-leak",
          refreshToken: "raw-refresh-token-should-not-leak",
        },
        missingPermissions: [],
      }),
    });
    assert.equal(setup.response.status, 200);
    assert.equal(setup.body.data.setupStatus, "ready");
    assert.equal(setup.body.data.configured, true);
    console.log("[marketing-connectors] ready setup state passed");

    const integrationList = await fetchJson(baseUrl, "/api/integrations", primary.token);
    assert.equal(integrationList.response.status, 200);
    const googleAdsIntegration = integrationList.body.data.find((item: any) => item.type === "google_ads");
    assert.equal(googleAdsIntegration.config.accessToken, undefined);
    assert.equal(googleAdsIntegration.config.refreshToken, undefined);
    console.log("[marketing-connectors] token config redaction passed");

    const oauthStart = await fetchJson(baseUrl, "/api/integrations/connectors/google_ads/oauth/start", primary.token, {
      method: "POST",
      body: JSON.stringify({
        config: { customerId: "123-456-7890" },
      }),
    });
    assert.equal(oauthStart.response.status, 200);
    assert.equal(oauthStart.body.data.type, "google_ads");
    assert.match(oauthStart.body.data.authorizeUrl, /accounts\.google\.com/);
    assert.ok(oauthStart.body.data.state);
    console.log("[marketing-connectors] oauth start passed");

    const providerCallbackError = await fetch(
      `${baseUrl}/api/integrations/connectors/google_ads/oauth/callback?code=test-auth-code&state=invalid-state`,
      { redirect: "manual" },
    );
    assert.equal(providerCallbackError.status, 302);
    assert.match(providerCallbackError.headers.get("location") || "", /\/app\/integrations\?connector=google_ads&oauth=error/);
    console.log("[marketing-connectors] provider callback state guard passed");

    const oauthComplete = await fetchJson(baseUrl, "/api/integrations/connectors/google_ads/oauth/callback", primary.token, {
      method: "POST",
      body: JSON.stringify({
        code: "test-auth-code",
        state: oauthStart.body.data.state,
      }),
    });
    assert.equal(oauthComplete.response.status, 200);
    assert.equal(oauthComplete.body.data.setupStatus, "ready");
    assert.equal(oauthComplete.body.data.configured, true);
    console.log("[marketing-connectors] oauth callback passed");

    const ga4ConnectedNoSelection = await fetchJson(baseUrl, "/api/integrations/connectors/ga4/setup", primary.token, {
      method: "POST",
      body: JSON.stringify({
        config: { oauthConnected: true, accessToken: "test-ga4-token" },
        missingPermissions: [],
      }),
    });
    assert.equal(ga4ConnectedNoSelection.response.status, 200);
    assert.equal(ga4ConnectedNoSelection.body.data.oauthConnected, true);
    assert.equal(ga4ConnectedNoSelection.body.data.selectionRequired, true);
    assert.equal(ga4ConnectedNoSelection.body.data.configured, false);

    const originalFetch = globalThis.fetch;
    let customerClientCalls = 0;
    let directLookupWithoutManagerHeader = false;
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.startsWith(baseUrl)) return originalFetch(input, init);
      assert.equal(init?.headers?.Authorization, "Bearer raw-access-token-should-not-leak");
      assert.equal(typeof init?.headers?.["developer-token"], "string");
      if (url.endsWith("/customers:listAccessibleCustomers")) {
        return new Response(JSON.stringify({
          resourceNames: ["customers/1234567890", "customers/8681098956", "customers/2767791572"],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const body = JSON.parse(String(init?.body || "{}"));
      if (String(body.query || "").includes("customer_client.client_customer")) {
        customerClientCalls += 1;
        if (!url.endsWith("/customers/1234567890/googleAds:search")) {
          return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        assert.equal(body.pageSize, 10000);
        if (!body.pageToken) {
          return new Response(JSON.stringify({ results: [], nextPageToken: "next-client-page" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        assert.equal(body.pageToken, "next-client-page");
        return new Response(JSON.stringify({
          results: [
            {
              customerClient: {
                clientCustomer: "customers/1234567890",
                descriptiveName: "Clinic Grower Ads",
              },
            },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      assert.equal(
        url.endsWith("/customers/8681098956/googleAds:search") ||
          url.endsWith("/customers/2767791572/googleAds:search"),
        true,
      );
      if (init?.headers?.["login-customer-id"]) {
        return new Response(JSON.stringify({
          error: { message: "Customer is not under the provided login customer." },
        }), { status: 403, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/customers/2767791572/googleAds:search")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      directLookupWithoutManagerHeader = true;
      return new Response(JSON.stringify({
        results: [{ customer: { id: "8681098956", descriptiveName: "Phase One Aesthetics Ads" } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    try {
      const googleAdsChoices = await fetchJson(baseUrl, "/api/integrations/connectors/google_ads/accounts", primary.token);
      assert.equal(googleAdsChoices.response.status, 200);
      assert.equal(customerClientCalls >= 2, true);
      assert.equal(directLookupWithoutManagerHeader, true);
      assert.equal(googleAdsChoices.body.data.length, 3);
      assert.equal(googleAdsChoices.body.data[0].id, "1234567890");
      assert.equal(googleAdsChoices.body.data[0].label, "Clinic Grower Ads");
      assert.equal(googleAdsChoices.body.data[0].description, "Google Ads 1234567890");
      assert.equal(googleAdsChoices.body.data[1].label, "Phase One Aesthetics Ads");
      assert.equal(googleAdsChoices.body.data[2].label, "Google Ads 2767791572");
      assert.equal(
        googleAdsChoices.body.data[2].metadata.nameLookupStatus,
        "direct_with_manager_http_403;direct_without_manager_empty_results",
      );
      const aliasSetup = await fetchJson(baseUrl, "/api/integrations/connectors/google_ads/setup", primary.token, {
        method: "POST",
        body: JSON.stringify({
          config: {
            googleAdsAccountAliases: {
              "2767791572": "Manually Named Ads Account",
            },
          },
          missingPermissions: [],
        }),
      });
      assert.equal(aliasSetup.response.status, 200);

      const aliasedGoogleAdsChoices = await fetchJson(baseUrl, "/api/integrations/connectors/google_ads/accounts", primary.token);
      assert.equal(aliasedGoogleAdsChoices.response.status, 200);
      assert.equal(aliasedGoogleAdsChoices.body.data[2].label, "Manually Named Ads Account");
      assert.equal(aliasedGoogleAdsChoices.body.data[2].description, "Google Ads 2767791572");
      assert.equal(aliasedGoogleAdsChoices.body.data[2].metadata.localAlias, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
    console.log("[marketing-connectors] Google Ads account names passed");

    let ga4AccountSummaryCalls = 0;
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.startsWith(baseUrl)) return originalFetch(input, init);
      const parsedUrl = new URL(url);
      assert.equal(`${parsedUrl.origin}${parsedUrl.pathname}`, "https://analyticsadmin.googleapis.com/v1beta/accountSummaries");
      assert.equal(parsedUrl.searchParams.get("pageSize"), "200");
      assert.equal(init?.headers?.Authorization, "Bearer test-ga4-token");
      ga4AccountSummaryCalls += 1;
      if (!parsedUrl.searchParams.get("pageToken")) {
        return new Response(JSON.stringify({
          nextPageToken: "next-ga4-page",
          accountSummaries: [
            {
              account: "accounts/100",
              displayName: "Clinic Analytics",
              propertySummaries: [
                { property: "properties/200", displayName: "Main Website" },
                { property: "properties/201", displayName: "Landing Pages" },
              ],
            },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      assert.equal(parsedUrl.searchParams.get("pageToken"), "next-ga4-page");
      return new Response(JSON.stringify({
        accountSummaries: [
          {
            account: "accounts/101",
            displayName: "Clinic Grower",
            propertySummaries: [
              { property: "properties/202", displayName: "Clinic Grower Website" },
            ],
          },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    try {
      const ga4Choices = await fetchJson(baseUrl, "/api/integrations/connectors/ga4/accounts", primary.token);
      assert.equal(ga4Choices.response.status, 200);
      assert.equal(ga4AccountSummaryCalls, 2);
      assert.equal(ga4Choices.body.data.length, 3);
      assert.equal(ga4Choices.body.data[0].id, "200");
      assert.equal(ga4Choices.body.data[0].label, "Main Website");
      assert.equal(ga4Choices.body.data[2].id, "202");
      assert.equal(ga4Choices.body.data[2].label, "Clinic Grower Website");

      const selectedGa4 = await fetchJson(baseUrl, "/api/integrations/connectors/ga4/accounts/select", primary.token, {
        method: "POST",
        body: JSON.stringify({ selectionId: "200" }),
      });
      assert.equal(selectedGa4.response.status, 200);
      assert.equal(selectedGa4.body.data.configured, true);
      assert.equal(selectedGa4.body.data.selectionRequired, false);
      assert.equal(selectedGa4.body.data.selectedAccountLabel, "Main Website");
    } finally {
      globalThis.fetch = originalFetch;
    }
    console.log("[marketing-connectors] post-oauth account selection passed");

    const vendorSyncSetup = await fetchJson(baseUrl, "/api/integrations/connectors/google_ads/setup", primary.token, {
      method: "POST",
      body: JSON.stringify({
        config: {
          customerId: "1234567890",
          oauthConnected: true,
          accessToken: "test-google-ads-token",
        },
        missingPermissions: [],
      }),
    });
    assert.equal(vendorSyncSetup.response.status, 200);

    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.startsWith(baseUrl)) return originalFetch(input, init);
      if (url.match(/googleads\.googleapis\.com\/v\d+\/customers\/1234567890\/googleAds:search$/)) {
        return new Response(JSON.stringify({
          results: [{ customer: { id: "1234567890", manager: false } }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      assert.match(url, /googleads\.googleapis\.com\/v\d+\/customers\/1234567890\/googleAds:searchStream/);
      assert.equal(init?.headers?.Authorization, "Bearer test-google-ads-token");
      if (init?.headers?.["login-customer-id"]) {
        return new Response(JSON.stringify([
          { error: { message: "Customer is not under the supplied manager." } },
        ]), { status: 403, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify([
        {
          results: [
            {
              segments: { date: "2026-06-03" },
              campaign: { name: "Vendor Search" },
              metrics: {
                costMicros: "123000000",
                impressions: "1000",
                clicks: "50",
                conversions: "5",
              },
            },
          ],
        },
      ]), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    try {
      const vendorSync = await fetchJson(baseUrl, "/api/integrations/connectors/google_ads/sync", primary.token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      assert.equal(vendorSync.response.status, 200);
      assert.equal(vendorSync.body.data.importedRows, 4);
      assert.equal(vendorSync.body.data.spendRowsCreated, 1);
      assert.equal(vendorSync.body.data.status.lastSyncStatus, "success");
    } finally {
      globalThis.fetch = originalFetch;
    }
    console.log("[marketing-connectors] Google Ads vendor sync passed");

    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.startsWith(baseUrl)) return originalFetch(input, init);
      if (url.match(/googleads\.googleapis\.com\/v\d+\/customers\/1234567890\/googleAds:search$/)) {
        return new Response(JSON.stringify({
          results: [{ customer: { id: "1234567890", manager: false } }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      assert.match(url, /googleads\.googleapis\.com\/v\d+\/customers\/1234567890\/googleAds:searchStream/);
      return new Response(JSON.stringify([
        { error: { message: "The customer account can't be accessed." } },
      ]), { status: 403, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    try {
      const failedGoogleAdsSync = await fetchJson(baseUrl, "/api/integrations/connectors/google_ads/sync", primary.token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      assert.equal(failedGoogleAdsSync.response.status, 200);
      assert.equal(failedGoogleAdsSync.body.data.status.lastSyncStatus, "failed");
      assert.equal(failedGoogleAdsSync.body.data.status.lastSyncError, "The customer account can't be accessed.");
    } finally {
      globalThis.fetch = originalFetch;
    }
    console.log("[marketing-connectors] Google Ads sync error detail passed");

    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.startsWith(baseUrl)) return originalFetch(input, init);
      assert.match(url, /googleads\.googleapis\.com\/v\d+\/customers\/1234567890\/googleAds:search$/);
      return new Response(JSON.stringify({
        results: [{ customer: { id: "1234567890", manager: true } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    try {
      const managerGoogleAdsSync = await fetchJson(baseUrl, "/api/integrations/connectors/google_ads/sync", primary.token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      assert.equal(managerGoogleAdsSync.response.status, 200);
      assert.equal(managerGoogleAdsSync.body.data.status.lastSyncStatus, "failed");
      assert.equal(
        managerGoogleAdsSync.body.data.status.lastSyncError,
        "Selected Google Ads account is a manager account. Choose a client account before syncing campaign metrics.",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
    console.log("[marketing-connectors] Google Ads manager sync guard passed");

    const vendorGa4Setup = await fetchJson(baseUrl, "/api/integrations/connectors/ga4/setup", primary.token, {
      method: "POST",
      body: JSON.stringify({
        config: {
          propertyId: "200",
          oauthConnected: true,
          accessToken: "test-ga4-token",
        },
        missingPermissions: [],
      }),
    });
    assert.equal(vendorGa4Setup.response.status, 200);
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.startsWith(baseUrl)) return originalFetch(input, init);
      assert.equal(url, "https://analyticsdata.googleapis.com/v1beta/properties/200:runReport");
      assert.equal(init?.headers?.Authorization, "Bearer test-ga4-token");
      return new Response(JSON.stringify({
        metricHeaders: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "conversions" },
          { name: "engagementRate" },
        ],
        rows: [
          {
            dimensionValues: [{ value: "20260603" }, { value: "google / organic" }],
            metricValues: [{ value: "80" }, { value: "60" }, { value: "4" }, { value: "0.72" }],
          },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    try {
      const ga4VendorSync = await fetchJson(baseUrl, "/api/integrations/connectors/ga4/sync", primary.token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      assert.equal(ga4VendorSync.response.status, 200);
      assert.equal(ga4VendorSync.body.data.importedRows, 4);
      assert.equal(ga4VendorSync.body.data.status.lastSyncStatus, "success");
    } finally {
      globalThis.fetch = originalFetch;
    }
    console.log("[marketing-connectors] GA4 vendor sync passed");

    const vendorGbpSetup = await fetchJson(baseUrl, "/api/integrations/connectors/google_business_profile/setup", primary.token, {
      method: "POST",
      body: JSON.stringify({
        config: {
          locationId: "locations/987",
          selectedAccountLabel: "Clinic GBP",
          oauthConnected: true,
          accessToken: "test-gbp-token",
        },
        missingPermissions: [],
      }),
    });
    assert.equal(vendorGbpSetup.response.status, 200);
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.startsWith(baseUrl)) return originalFetch(input, init);
      assert.match(url, /businessprofileperformance\.googleapis\.com\/v1\/locations\/987:fetchMultiDailyMetricsTimeSeries/);
      assert.equal(init?.headers?.Authorization, "Bearer test-gbp-token");
      return new Response(JSON.stringify({
        multiDailyMetricTimeSeries: [
          {
            dailyMetric: "CALL_CLICKS",
            timeSeries: {
              datedValues: [
                { date: { year: 2026, month: 6, day: 3 }, value: "7" },
              ],
            },
          },
          {
            dailyMetric: "WEBSITE_CLICKS",
            timeSeries: {
              datedValues: [
                { date: { year: 2026, month: 6, day: 3 }, value: "11" },
              ],
            },
          },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    try {
      const gbpVendorSync = await fetchJson(baseUrl, "/api/integrations/connectors/google_business_profile/sync", primary.token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      assert.equal(gbpVendorSync.response.status, 200);
      assert.equal(gbpVendorSync.body.data.importedRows, 2);
      assert.equal(gbpVendorSync.body.data.status.lastSyncStatus, "success");
    } finally {
      globalThis.fetch = originalFetch;
    }
    console.log("[marketing-connectors] GBP vendor sync passed");

    const seoSetup = await fetchJson(baseUrl, "/api/integrations/connectors/seo/setup", primary.token, {
      method: "POST",
      body: JSON.stringify({
        config: {
          siteUrl: "https://exampleclinic.test",
          oauthConnected: true,
          accessToken: "test-seo-token",
        },
        missingPermissions: [],
      }),
    });
    assert.equal(seoSetup.response.status, 200);
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.startsWith(baseUrl)) return originalFetch(input, init);
      assert.equal(
        url,
        "https://searchconsole.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fexampleclinic.test/searchAnalytics/query",
      );
      assert.equal(init?.method, "POST");
      assert.equal(init?.headers?.Authorization, "Bearer test-seo-token");
      const body = JSON.parse(String(init?.body || "{}"));
      assert.deepEqual(body.dimensions, ["date"]);
      return new Response(JSON.stringify({
        rows: [
          {
            keys: ["2026-06-01"],
            clicks: 34,
            impressions: 1200,
            position: 8.4,
          },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    try {
      const seoSync = await fetchJson(baseUrl, "/api/integrations/connectors/seo/sync", primary.token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      assert.equal(seoSync.response.status, 200);
      assert.equal(seoSync.body.data.importedRows, 3);
      assert.equal(seoSync.body.data.status.lastSyncStatus, "success");
    } finally {
      globalThis.fetch = originalFetch;
    }
    const seoConnectorMetrics = await fetchJson(baseUrl, "/api/integration-inputs/manual-metrics?platform=seo", primary.token);
    assert.equal(seoConnectorMetrics.response.status, 200);
    assert.equal(
      seoConnectorMetrics.body.data.some(
        (item: any) => item.metricName === "organic_clicks" && item.dataSource === "connector:seo",
      ),
      true,
    );
    console.log("[marketing-connectors] SEO vendor sync passed");

    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.startsWith(baseUrl)) return originalFetch(input, init);
      if (url === "https://mybusinessaccountmanagement.googleapis.com/v1/accounts") {
        assert.equal(init?.headers?.Authorization, "Bearer test-gbp-token");
        return new Response(JSON.stringify({
          accounts: [{ name: "accounts/123", accountName: "Clinic GBP Account" }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      assert.equal(
        url,
        "https://mybusinessbusinessinformation.googleapis.com/v1/accounts/123/locations?readMask=name,title,storefrontAddress",
      );
      return new Response(JSON.stringify({
        locations: [{ name: "locations/987", title: "Clinic GBP" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    try {
      const gbpChoices = await fetchJson(baseUrl, "/api/integrations/connectors/google_business_profile/accounts", primary.token);
      assert.equal(gbpChoices.response.status, 200);
      assert.equal(gbpChoices.body.data.length, 1);
      assert.equal(gbpChoices.body.data[0].label, "Clinic GBP");
    } finally {
      globalThis.fetch = originalFetch;
    }

    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.startsWith(baseUrl)) return originalFetch(input, init);
      assert.equal(url, "https://mybusinessaccountmanagement.googleapis.com/v1/accounts");
      return new Response(JSON.stringify({
        error: {
          message:
            "Quota exceeded for quota metric 'Requests' and limit 'Requests per minute' of service 'mybusinessaccountmanagement.googleapis.com'",
        },
      }), { status: 429, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    try {
      const cachedGbpChoices = await fetchJson(baseUrl, "/api/integrations/connectors/google_business_profile/accounts", primary.token);
      assert.equal(cachedGbpChoices.response.status, 200);
      assert.equal(cachedGbpChoices.body.data.length, 1);
      assert.equal(cachedGbpChoices.body.data[0].label, "Clinic GBP");
    } finally {
      globalThis.fetch = originalFetch;
    }
    console.log("[marketing-connectors] GBP account choice cache passed");

    const sync = await fetchJson(baseUrl, "/api/integrations/connectors/google_ads/sync", primary.token, {
      method: "POST",
      body: JSON.stringify({
        rows: [
          {
            metricDate: "2026-06-01",
            metricName: "spend",
            metricValue: 250,
            campaign: "Implants Search",
            unit: "usd",
            rawPayload: { campaignId: "ga-001" },
          },
          {
            metricDate: "2026-06-01",
            metricName: "clicks",
            metricValue: 45,
            campaign: "Implants Search",
            unit: "count",
          },
        ],
      }),
    });
    assert.equal(sync.response.status, 200);
    assert.equal(sync.body.data.importedRows, 2);
    assert.equal(sync.body.data.spendRowsCreated, 1);
    assert.equal(sync.body.data.status.lastSyncStatus, "success");
    assert.equal(sync.body.data.status.healthStatus, "healthy");
    console.log("[marketing-connectors] metric sync passed");

    const connectorMetrics = await fetchJson(
      baseUrl,
      "/api/integration-inputs/manual-metrics?platform=google_ads&campaign=Implants%20Search",
      primary.token,
    );
    assert.equal(connectorMetrics.response.status, 200);
    assert.equal(connectorMetrics.body.data.length >= 2, true);
    assert.equal(connectorMetrics.body.data.some((item: any) => item.dataSource === "connector:google_ads"), true);
    console.log("[marketing-connectors] connector metric provenance passed");

    const spend = await fetchJson(baseUrl, "/api/ops-logs/spend", primary.token);
    assert.equal(spend.response.status, 200);
    assert.equal(spend.body.data.some((item: any) => item.campaign === "Implants Search" && item.dataSource === "connector:google_ads"), true);
    console.log("[marketing-connectors] reporting spend provenance passed");

    const manualFallback = await fetchJson(baseUrl, "/api/integration-inputs/manual-metrics", primary.token, {
      method: "POST",
      body: JSON.stringify({
        platform: "seo",
        metricDate: "2026-06-02",
        metricName: "organic_clicks",
        metricValue: 88,
        attributionLabel: "manual_import",
      }),
    });
    assert.equal(manualFallback.response.status, 201);
    const manualMetrics = await fetchJson(baseUrl, "/api/integration-inputs/manual-metrics?platform=seo", primary.token);
    assert.equal(manualMetrics.response.status, 200);
    assert.equal(manualMetrics.body.data.some((item: any) => item.dataSource === "manual"), true);
    console.log("[marketing-connectors] manual fallback still works passed");

    const failedSync = await fetchJson(baseUrl, "/api/integrations/connectors/google_ads/sync", primary.token, {
      method: "POST",
      body: JSON.stringify({
        errorMessage: "Google Ads token expired. Reconnect OAuth.",
      }),
    });
    assert.equal(failedSync.response.status, 200);
    assert.equal(failedSync.body.data.status.lastSyncStatus, "failed");
    assert.equal(failedSync.body.data.status.healthStatus, "error");
    assert.match(failedSync.body.data.status.lastSyncError, /Reconnect OAuth/);
    console.log("[marketing-connectors] sync failure state passed");

    const secondaryStatus = await fetchJson(baseUrl, "/api/integrations/connectors/status", secondary.token);
    assert.equal(secondaryStatus.response.status, 200);
    const secondaryGoogleAds = secondaryStatus.body.data.find((item: any) => item.type === "google_ads");
    assert.equal(secondaryGoogleAds.integrationId, null);
    assert.equal(secondaryGoogleAds.setupStatus, "not_configured");
    console.log("[marketing-connectors] tenant isolation passed");
  } finally {
    await pool.execute(
      `UPDATE manual_platform_metric
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND (attribution_label IN ('connector:google_ads', 'manual_import') OR campaign = 'Implants Search')`,
      [primary.clinicId],
    );
    await pool.execute(
      `UPDATE manual_platform_metric
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND attribution_label IN ('connector:ga4', 'connector:google_business_profile')`,
      [primary.clinicId],
    );
    await pool.execute(
      `UPDATE manual_spend_entry
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND attribution_label = 'connector:google_ads'`,
      [primary.clinicId],
    );
    await pool.execute(
      `DELETE FROM integration_raw_payload
       WHERE clinic_id = ?
         AND source LIKE 'connector:google_ads%'`,
      [primary.clinicId],
    );
    await pool.execute(
      `UPDATE integration
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND type IN ('google_ads', 'ga4')
         AND deleted_at IS NULL`,
      [primary.clinicId],
    );
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
    await pool.end();
  }

  console.log("[marketing-connectors] integration test completed successfully");
});
