// Shared utilities for admin API

const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS || "*");
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateLimitBuckets = new Map();

function parseAllowedOrigins(raw) {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowlist = allowedOrigins.length > 0 ? allowedOrigins : ["*"];
  const allowedOrigin =
    origin && (allowlist.includes("*") || allowlist.includes(origin))
      ? origin
      : allowlist.includes("*")
      ? "*"
      : allowlist[0];

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
}

function enforceRateLimit(meta, res) {
  const ip = meta.ip || "unknown";
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);

  if (!bucket || now > bucket.expiresAt) {
    rateLimitBuckets.set(ip, {
      count: 1,
      expiresAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    logInfo("Rate limit hit", { ip });
    res.status(429).json({ error: "Too many requests" });
    return false;
  }

  bucket.count += 1;
  rateLimitBuckets.set(ip, bucket);
  return true;
}

function getRequestContext(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string"
    ? forwardedFor.split(",")[0].trim()
    : req.socket?.remoteAddress || "unknown";

  return {
    ip,
    method: req.method,
    path: req.url,
    userAgent: req.headers["user-agent"],
    requestId: req.headers["x-request-id"],
  };
}

function extractQuery(req) {
  if (req.query && typeof req.query === "object") {
    return req.query;
  }

  if (!req.url) return {};

  try {
    const parsed = new URL(req.url, "http://localhost");
    return Object.fromEntries(parsed.searchParams.entries());
  } catch {
    return {};
  }
}

function logInfo(message, meta = {}) {
  log("info", message, meta);
}

function logError(message, err, meta = {}) {
  const errorPayload = err instanceof Error ? err : new Error(String(err));
  log("error", message, {
    ...meta,
    errorMessage: errorPayload.message,
    stack: errorPayload.stack,
  });
}

function log(level, message, meta = {}) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  const serialized = JSON.stringify(payload);
  if (level === "error") {
    console.error(serialized);
  } else {
    console.log(serialized);
  }
}

module.exports = {
  applyCors,
  enforceRateLimit,
  getRequestContext,
  extractQuery,
  logInfo,
  logError,
};

