// Admin login endpoint

const jwt = require("jsonwebtoken");
const { z } = require("zod");
const {
  applyCors,
  enforceRateLimit,
  getRequestContext,
  logInfo,
  logError,
} = require("../utils");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES_IN = "24h";

if (!ADMIN_PASSWORD) {
  console.warn("ADMIN_PASSWORD not set. Login will fail.");
}

const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

async function handlePost(req, res) {
  try {
    const validation = loginSchema.safeParse(req.body ?? {});
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { password } = validation.data;

    if (!ADMIN_PASSWORD) {
      logError("ADMIN_PASSWORD not configured", new Error("Missing env var"));
      return res.status(500).json({ error: "Server configuration error" });
    }

    if (password !== ADMIN_PASSWORD) {
      logInfo("Failed login attempt", { ip: getRequestContext(req).ip });
      return res.status(401).json({ error: "Invalid password" });
    }

    // Generate JWT token
    const token = jwt.sign({ admin: true }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    const decoded = jwt.decode(token);
    const expiresAt = decoded.exp * 1000; // Convert to milliseconds

    logInfo("Successful login", { ip: getRequestContext(req).ip });

    return res.status(200).json({
      token,
      expiresAt,
    });
  } catch (err) {
    logError("POST /admin/login error", err, getRequestContext(req));
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const requestMeta = getRequestContext(req);

  if (!enforceRateLimit(requestMeta, res)) return;

  if (req.method === "POST") {
    return handlePost(req, res);
  } else {
    res.setHeader("Allow", ["POST", "OPTIONS"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }
}

