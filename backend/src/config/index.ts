import "dotenv/config";

const hasOpenAIApiKey = Boolean(process.env.OPENAI_API_KEY);

function parseCsv(value: string | undefined) {
    return (value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function parseBoolean(value: string | undefined, fallback: boolean) {
    if (!value) return fallback;

    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseJsonRecord(value: string | undefined): Record<string, string> {
    if (!value) return {};

    try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed)
                .map(([key, item]) => [key.trim(), String(item || "").trim()])
                .filter(([key, item]) => key && item),
        );
    } catch {
        return {};
    }
}

export const config = {
    port: parseInt(process.env.PORT || "3000", 10),
    nodeEnv: process.env.NODE_ENV || "development",

    db: {
        host: process.env.DB_HOST || "127.0.0.1",
        port: parseInt(process.env.DB_PORT || "3306", 10),
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        name: process.env.DB_NAME || "growth_group_internal_crm",
        ssl: parseBoolean(process.env.DB_SSL, false),
        sslRejectUnauthorized: parseBoolean(
            process.env.DB_SSL_REJECT_UNAUTHORIZED,
            process.env.NODE_ENV === "production",
        ),
    },

    jwt: {
        secret: process.env.JWT_SECRET || "fallback-secret-do-not-use",
        expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    },

    otp: {
        expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10)
    },

    frontendUrl: process.env.FRONTEND_URL || "https://clinicgrower.ai",
    apiPublicUrl: process.env.API_PUBLIC_URL || "https://clinicgrower.ai/api",
    oauthCallbackBaseUrl: process.env.OAUTH_CALLBACK_BASE_URL || "https://clinicgrower.ai/api/auth",
    cors: {
        allowedOrigins: parseCsv(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "https://clinicgrower.ai,https://www.clinicgrower.ai"),
    },

    email: {
        from: process.env.EMAIL_FROM || "Clinic Grower <noreply@clinicgrower.ai>",
        provider: process.env.EMAIL_PROVIDER || "log",
        brevoApiKey: process.env.BREVO_API_KEY || "",
        brevoApiUrl: process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email",
    },

    openai: {
        apiKey: process.env.OPENAI_API_KEY || "",
        apiUrl: process.env.OPENAI_API_URL || "https://api.openai.com/v1/responses",
        defaultModel: process.env.OPENAI_DEFAULT_MODEL || process.env.OPENAI_INSIGHTS_MODEL || "gpt-5-mini",
        deepAuditModel: process.env.OPENAI_DEEP_AUDIT_MODEL || process.env.OPENAI_INSIGHTS_MODEL || process.env.OPENAI_DEFAULT_MODEL || "gpt-5-mini",
        callIntelligenceEnabled: parseBoolean(
            process.env.OPENAI_CALL_INTELLIGENCE_ENABLED,
            parseBoolean(process.env.OPENAI_INSIGHTS_ENABLED, hasOpenAIApiKey),
        ),
        callIntelligenceModel: process.env.OPENAI_CALL_INTELLIGENCE_MODEL || process.env.OPENAI_DEFAULT_MODEL || process.env.OPENAI_INSIGHTS_MODEL || "gpt-5-mini",
        callTranscriptionEnabled: parseBoolean(process.env.OPENAI_CALL_TRANSCRIPTION_ENABLED, false),
        callTranscriptionModel: process.env.OPENAI_CALL_TRANSCRIPTION_MODEL || "gpt-4o-transcribe",
        insightsEnabled: parseBoolean(process.env.OPENAI_INSIGHTS_ENABLED, hasOpenAIApiKey),
        insightsModel: process.env.OPENAI_INSIGHTS_MODEL || process.env.OPENAI_DEEP_AUDIT_MODEL || process.env.OPENAI_DEFAULT_MODEL || "gpt-5-mini",
        transcriptionApiUrl: process.env.OPENAI_TRANSCRIPTION_API_URL || "https://api.openai.com/v1/audio/transcriptions",
        timeoutMs: parseInt(process.env.OPENAI_TIMEOUT_MS || "15000", 10),
    },

    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || "",
        authToken: process.env.TWILIO_AUTH_TOKEN || "",
        webhookSecret: process.env.TWILIO_WEBHOOK_SECRET || "",
        whatsappSender: process.env.TWILIO_WHATSAPP_SENDER || "",
        whatsappWebhookUrl: process.env.TWILIO_WHATSAPP_WEBHOOK_URL || "",
    },

    whatsapp: {
        provider: process.env.WHATSAPP_PROVIDER || "log",
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
        apiVersion: process.env.WHATSAPP_API_VERSION || "v20.0",
        webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET || process.env.TWILIO_WEBHOOK_SECRET || "",
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_WEBHOOK_SECRET || "",
        appSecret: process.env.WHATSAPP_APP_SECRET || process.env.FACEBOOK_APP_SECRET || process.env.FACEBOOK_CLIENT_SECRET || "",
        defaultWorkspaceId: process.env.WHATSAPP_WEBHOOK_WORKSPACE_ID || process.env.WHATSAPP_WEBHOOK_CLINIC_ID || "",
        webhookWorkspaceMap: parseJsonRecord(process.env.WHATSAPP_WEBHOOK_WORKSPACE_MAP),
    },

    backups: {
        directory: process.env.BACKUP_DIR || "backups",
        retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || "14", 10),
    },

    taskUploads: {
        directory: process.env.TASK_UPLOAD_DIR || "/var/lib/internal-crm/task-uploads",
        maxFileSizeBytes: parseInt(process.env.TASK_UPLOAD_MAX_BYTES || String(20 * 1024 * 1024), 10),
    },

    backgroundJobs: {
        enabled: parseBoolean(process.env.BACKGROUND_JOBS_ENABLED, process.env.NODE_ENV === "production"),
        pollIntervalMs: parseInt(process.env.BACKGROUND_JOBS_POLL_INTERVAL_MS || "60000", 10),
    },

    oauth: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
            allowedDomains: parseCsv(process.env.GOOGLE_OAUTH_ALLOWED_DOMAINS).map((domain) => domain.toLowerCase()),
            autoProvisionClinicId: process.env.GOOGLE_OAUTH_AUTO_PROVISION_CLINIC_ID || "",
            autoProvisionRole: (process.env.GOOGLE_OAUTH_AUTO_PROVISION_ROLE || "ADMIN").toUpperCase(),
        },
        facebook: {
            clientId: process.env.FACEBOOK_CLIENT_ID || process.env.FACEBOOK_APP_ID || "",
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET || "",
        },
        apple: {
            clientId: process.env.APPLE_CLIENT_ID || "",
            teamId: process.env.APPLE_TEAM_ID || "",
            keyId: process.env.APPLE_KEY_ID || "",
            privateKey: (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        },
    },

    googleAds: {
        developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
        loginCustomerId: (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, ""),
        apiVersion: process.env.GOOGLE_ADS_API_VERSION || "v24",
    },

    googleDrive: {
        databaseOAuthEnabled: parseBoolean(
            process.env.GOOGLE_DRIVE_DATABASE_OAUTH_ENABLED,
            false,
        ),
        refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN || "",
        serviceAccountEmail: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL || "",
        serviceAccountPrivateKey: (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        serviceAccountSubject: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_SUBJECT || "",
        scopes: (process.env.GOOGLE_DRIVE_SCOPES || "https://www.googleapis.com/auth/drive")
            .split(",")
            .map((scope) => scope.trim())
            .filter(Boolean),
        validationEnabled: parseBoolean(
            process.env.GOOGLE_DRIVE_VALIDATION_ENABLED,
            true,
        ),
    },

    stripe: {
        secretKey: (process.env.STRIPE_SECRET_KEY || "").trim(),
        webhookSecret: (process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
        plans: {
            starter: (process.env.STRIPE_PLAN_STARTER_ID || "").trim(),
            professional: (process.env.STRIPE_PLAN_PROFESSIONAL_ID || "").trim(),
        },
    },
} as const;

export function getProductionConfigIssues() {
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!config.jwt.secret || config.jwt.secret === "fallback-secret-do-not-use" || config.jwt.secret.length < 32) {
        issues.push("JWT_SECRET must be set to a strong secret of at least 32 characters.");
    }

    if (!config.frontendUrl.startsWith("https://")) {
        warnings.push("FRONTEND_URL should be an HTTPS URL in production.");
    }

    if (!config.apiPublicUrl.startsWith("https://")) {
        warnings.push("API_PUBLIC_URL should be an HTTPS URL in production.");
    }

    if (!config.oauthCallbackBaseUrl.startsWith("https://")) {
        warnings.push("OAUTH_CALLBACK_BASE_URL should be an HTTPS URL in production.");
    }

    if (config.cors.allowedOrigins.length === 0) {
        issues.push("CORS_ORIGINS or FRONTEND_URL must be configured.");
    }

    if (config.email.provider === "log") {
        warnings.push("EMAIL_PROVIDER is set to log; transactional email is not configured yet.");
    }

    if (config.email.provider === "brevo" && !config.email.brevoApiKey) {
        issues.push("BREVO_API_KEY must be set when EMAIL_PROVIDER=brevo.");
    }

    if (config.oauth.google.clientId && config.oauth.google.allowedDomains.length === 0) {
        issues.push("GOOGLE_OAUTH_ALLOWED_DOMAINS must be set when Google OAuth is enabled.");
    }

    if (config.oauth.google.allowedDomains.length > 0 && !config.oauth.google.autoProvisionClinicId) {
        issues.push("GOOGLE_OAUTH_AUTO_PROVISION_CLINIC_ID must be set when Google Workspace auto-provisioning is enabled.");
    }

    if (!["ADMIN", "SALES", "DELIVERY", "FINANCE", "READ_ONLY"].includes(config.oauth.google.autoProvisionRole)) {
        issues.push("GOOGLE_OAUTH_AUTO_PROVISION_ROLE must be ADMIN, SALES, DELIVERY, FINANCE, or READ_ONLY.");
    }

    if ((config.openai.insightsEnabled || config.openai.callIntelligenceEnabled || config.openai.callTranscriptionEnabled) && !config.openai.apiKey) {
        issues.push("OPENAI_API_KEY must be set when OpenAI features are enabled.");
    }

    if (config.whatsapp.provider === "meta" && (!config.whatsapp.accessToken || !config.whatsapp.phoneNumberId)) {
        issues.push("WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be set when WHATSAPP_PROVIDER=meta.");
    }

    if (!["log", "meta", "twilio"].includes(config.whatsapp.provider)) {
        issues.push("WHATSAPP_PROVIDER must be log, meta, or twilio.");
    }

    if (
        config.whatsapp.provider === "twilio" &&
        (!config.twilio.accountSid || !config.twilio.authToken || !config.twilio.whatsappSender)
    ) {
        issues.push("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_SENDER must be set when WHATSAPP_PROVIDER=twilio.");
    }

    if (config.whatsapp.provider === "twilio" && !config.twilio.whatsappWebhookUrl.startsWith("https://")) {
        issues.push("TWILIO_WHATSAPP_WEBHOOK_URL must be the exact public HTTPS webhook URL when WHATSAPP_PROVIDER=twilio.");
    }

    if (config.whatsapp.provider === "meta" && !config.whatsapp.verifyToken) {
        issues.push("WHATSAPP_VERIFY_TOKEN must be set when WHATSAPP_PROVIDER=meta.");
    }

    if (config.whatsapp.provider === "meta" && !config.whatsapp.appSecret) {
        issues.push("WHATSAPP_APP_SECRET or FACEBOOK_APP_SECRET must be set when WHATSAPP_PROVIDER=meta.");
    }

    if (
        ["meta", "twilio"].includes(config.whatsapp.provider) &&
        !config.whatsapp.defaultWorkspaceId &&
        Object.keys(config.whatsapp.webhookWorkspaceMap).length === 0
    ) {
        issues.push("WHATSAPP_WEBHOOK_WORKSPACE_ID or WHATSAPP_WEBHOOK_WORKSPACE_MAP must be set when WHATSAPP_PROVIDER=meta.");
    }

    if (
        config.googleDrive.validationEnabled &&
        !config.googleDrive.databaseOAuthEnabled &&
        !config.googleDrive.refreshToken &&
        (!config.googleDrive.serviceAccountEmail || !config.googleDrive.serviceAccountPrivateKey)
    ) {
        issues.push("GOOGLE_DRIVE_DATABASE_OAUTH_ENABLED, GOOGLE_DRIVE_REFRESH_TOKEN, or GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY must be set when GOOGLE_DRIVE_VALIDATION_ENABLED=true.");
    }

    return { issues, warnings };
}
