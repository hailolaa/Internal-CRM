const recordTypes = [
  "contact",
  "client_account",
  "proposal",
  "task",
  "opportunity",
  "communication",
  "finance",
  "marketing",
  "management",
] as const;

const envelopeResponse = {
  "application/json": {
    schema: { $ref: "#/components/schemas/ApiEnvelope" },
  },
};

const errorResponse = {
  "application/json": {
    schema: { $ref: "#/components/schemas/ApiErrorEnvelope" },
  },
};

const jsonRpcResponse = {
  "application/json": {
    schema: { $ref: "#/components/schemas/JsonRpcResponse" },
  },
};

const jsonRpcErrorResponse = {
  "application/json": {
    schema: { $ref: "#/components/schemas/JsonRpcError" },
  },
};

export const missionControlOpenApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Mission Control Read API",
    version: "v1",
    description: "Read-only Mission Control API and MCP discovery surface.",
  },
  servers: [{ url: "" }],
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/openapi.json": {
      get: {
        summary: "OpenAPI 3.1 document for the Mission Control read API",
        security: [],
        responses: { "200": { description: "OpenAPI document" } },
      },
    },
    "/api/v1/health": {
      get: {
        summary: "Mission Control API health",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Health envelope", content: envelopeResponse },
          "401": { description: "Unauthorized", content: errorResponse },
          "403": { description: "Forbidden", content: errorResponse },
          "429": { description: "Rate limited", content: errorResponse },
        },
      },
    },
    "/api/v1/version": {
      get: {
        summary: "Mission Control API version",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Version envelope", content: envelopeResponse },
          "401": { description: "Unauthorized", content: errorResponse },
          "403": { description: "Forbidden", content: errorResponse },
          "429": { description: "Rate limited", content: errorResponse },
        },
      },
    },
    "/api/v1/capabilities": {
      get: {
        summary: "Read-only capabilities and supported record types",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Capabilities envelope", content: envelopeResponse },
          "401": { description: "Unauthorized", content: errorResponse },
          "403": { description: "Forbidden", content: errorResponse },
          "429": { description: "Rate limited", content: errorResponse },
        },
      },
    },
    "/api/v1/search": {
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
              examples: ["contact,proposal"],
            },
          },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 25 } },
          { name: "cursor", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Search envelope", content: envelopeResponse },
          "400": { description: "Invalid search request", content: errorResponse },
          "401": { description: "Unauthorized", content: errorResponse },
          "403": { description: "Forbidden", content: errorResponse },
          "429": { description: "Rate limited", content: errorResponse },
        },
      },
    },
    "/api/v1/records/{type}/{id}": {
      get: {
        summary: "Fetch one tenant-scoped record",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "type", in: "path", required: true, schema: { $ref: "#/components/schemas/RecordType" } },
          { name: "id", in: "path", required: true, schema: { type: "string", minLength: 1, maxLength: 128 } },
        ],
        responses: {
          "200": { description: "Record envelope", content: envelopeResponse },
          "400": { description: "Unsupported record type", content: errorResponse },
          "401": { description: "Unauthorized", content: errorResponse },
          "403": { description: "Forbidden", content: errorResponse },
          "404": { description: "Record not found or not visible to the tenant", content: errorResponse },
          "429": { description: "Rate limited", content: errorResponse },
        },
      },
    },
    "/mcp": {
      get: {
        summary: "MCP endpoint metadata",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "MCP metadata" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
        },
      },
      post: {
        summary: "MCP JSON-RPC tools/list and tools/call",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "JSON-RPC result", content: jsonRpcResponse },
          "400": { description: "JSON-RPC error for invalid requests or unsupported tools", content: jsonRpcErrorResponse },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "404": { description: "JSON-RPC not-found error", content: jsonRpcErrorResponse },
        },
      },
    },
  },
  components: {
    schemas: {
      RecordType: { type: "string", enum: recordTypes },
      Provenance: {
        type: "object",
        required: ["source", "lastSourceUpdate", "lastSyncAt", "dataState"],
        properties: {
          source: { type: "string", enum: ["mission_control_database", "runtime_config"] },
          recordId: { type: "string" },
          recordUrl: { type: "string" },
          lastSourceUpdate: { type: ["string", "null"], format: "date-time" },
          lastSyncAt: { type: ["string", "null"], format: "date-time" },
          dataState: {
            type: "string",
            enum: ["live", "cached", "manual", "estimated", "calculated", "demo", "preview", "partial", "provider_dependent", "roadmap", "unknown", "not_applicable"],
          },
        },
      },
      SearchResult: {
        type: "object",
        required: ["id", "type", "title", "summary", "url", "sourceId", "provenance", "metadata"],
        properties: {
          id: { type: "string" },
          type: { $ref: "#/components/schemas/RecordType" },
          title: { type: "string" },
          summary: { type: "string" },
          url: { type: "string" },
          sourceId: { type: "string" },
          provenance: { $ref: "#/components/schemas/Provenance" },
          metadata: { type: "object", additionalProperties: true },
        },
      },
      ApiEnvelope: {
        type: "object",
        required: ["success", "data", "error", "request_id", "generated_at"],
        properties: {
          success: { type: "boolean", const: true },
          data: {
            oneOf: [
              { type: "object", additionalProperties: true },
              { $ref: "#/components/schemas/SearchResult" },
            ],
          },
          error: { type: "null" },
          request_id: { type: "string" },
          generated_at: { type: "string", format: "date-time" },
        },
      },
      ApiErrorEnvelope: {
        type: "object",
        required: ["success", "data", "error", "request_id", "generated_at"],
        properties: {
          success: { type: "boolean", const: false },
          data: { type: "null" },
          error: {
            type: "object",
            required: ["code", "message", "status"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              status: { type: "integer" },
              details: {},
            },
          },
          request_id: { type: "string" },
          generated_at: { type: "string", format: "date-time" },
        },
      },
      JsonRpcResponse: {
        type: "object",
        required: ["jsonrpc", "id", "result"],
        properties: {
          jsonrpc: { type: "string", const: "2.0" },
          id: {},
          result: { type: "object", additionalProperties: true },
        },
      },
      JsonRpcError: {
        type: "object",
        required: ["jsonrpc", "id", "error"],
        properties: {
          jsonrpc: { type: "string", const: "2.0" },
          id: {},
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "integer" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
} as const;
