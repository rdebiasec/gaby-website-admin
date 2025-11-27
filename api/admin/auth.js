// Authentication middleware for admin endpoints

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

/**
 * Verify JWT token from Authorization header
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object|null} Decoded token or null if invalid
 */
function verifyToken(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return null;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      res.status(401).json({ error: "Token expired" });
    } else if (error.name === "JsonWebTokenError") {
      res.status(401).json({ error: "Invalid token" });
    } else {
      res.status(401).json({ error: "Authentication failed" });
    }
    return null;
  }
}

module.exports = {
  verifyToken,
};

