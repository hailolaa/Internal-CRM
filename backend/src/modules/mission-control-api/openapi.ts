export const missionControlOpenApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Mission Control Read API",
    version: "v1",
    description: "Read-only Mission Control API and MCP discovery surface.",
  },
  servers: [{ url: "/api" }],
  security: [{ bearerAuth: [] }],
  paths: {
    "/v1/health": {
      get: {
        summary: "Mission Control API health",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Health envelope" }, "401": { description: "Unauthorized" } },
      },
    },
    "/v1/version": {
      get: {
        summary: "Mission Control API version",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Version envelope" }, "401": { description: "Unauthorized" } },
      },
    },
    "/v1/capabilities": {
      get: {
        summary: "Read-only capabilities and supported record types",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Capabilities envelope" }, "403": { description: "Forbidden" } },
      },
    },
    "/v1/search": {
      get: {
        summary: "Tenant-scoped universal search",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "query", in: "query", required: false, schema: { type: "string", maxLength: 120 } },
          {
            name: "types",
            in: "query",
            required: false,
            schema: {
              type: "string",
              description: "Comma-separated record types.",
            },
          },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 25 } },
          { name: "cursor", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Search envelope" },
          "400": { description: "Invalid search request" },
          "429": { description: "Rate limited" },
        },
      },
    },
    "/v1/records/{type}/{id}": {
      get: {
        summary: "Fetch one tenant-scoped record",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "type", in: "path", required: true, schema: { type: "string" } },
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Record envelope" },
          "400": { description: "Unsupported record type" },
          "404": { description: "Record not found or not visible to the tenant" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
} as const;
