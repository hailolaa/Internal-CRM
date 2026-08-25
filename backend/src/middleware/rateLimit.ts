import rateLimit from "express-rate-limit";

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many authentication attempts. Please try again shortly.",
  },
});

export const refreshTokenRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many session refresh attempts. Please try again shortly.",
  },
});

export const sensitiveAuthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many attempts. Please try again shortly.",
  },
});

export const oauthRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many OAuth attempts. Please try again shortly.",
  },
});

export const landingPageLeadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many lead submissions. Please try again shortly.",
  },
});

export const missionControlApiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.MISSION_CONTROL_API_RATE_LIMIT_MAX || (process.env.NODE_ENV === "production" ? 600 : 120)),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      data: null,
      error: {
        code: "rate_limit_exceeded",
        message: "Too many Mission Control API requests. Please try again shortly.",
        status: 429,
      },
      request_id: (req as any).requestId,
      generated_at: new Date().toISOString(),
    });
  },
});
