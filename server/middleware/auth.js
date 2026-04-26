/**
 * ============================================================
 *  middleware/auth.js  —  JWT Authentication Middleware
 * ============================================================
 *
 *  🛡️ WHAT IS MIDDLEWARE?
 *
 *  Middleware sits between the incoming request and your route handler.
 *  It can inspect/modify req & res, then either:
 *    - Call next() → pass control to the next middleware / route
 *    - Send a response → stop the chain (e.g. on auth failure)
 *
 *  This middleware protects private routes so only logged-in users
 *  can access them.
 *
 *  🧠 HOW JWT AUTH WORKS:
 *
 *  1. On login/signup → server creates a JWT (signed with JWT_SECRET_KEY).
 *  2. Client stores that token and sends it in every request header:
 *       Authorization: <token>
 *  3. This middleware verifies the token signature.
 *  4. If valid → decode the userId → fetch user from DB → attach to req.user.
 *  5. The route handler then uses req.user freely (no extra DB lookups needed).
 *
 *  ⚠️ BUG FIXED: Third parameter was named `auth` but the code called
 *     `next()`. This caused a ReferenceError crash on every protected
 *     route. Renamed to `next`.
 */

import userModel from "../models/user.js";
import jwt from "jsonwebtoken";

/**
 * Express middleware — verifies the JWT and populates req.user.
 *
 * @param {import("express").Request}  req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next   ← ⚠️ was named "auth" (BUG)
 */
export const auth = async (req, res, next) => {
  try {
    // The client sends: Authorization: <token>
    const token = req.headers.authorization;

    if (!token) {
      return res.json({ success: false, message: "No token provided. Please login." });
    }

    /*
     *  jwt.verify() checks:
     *    1. The signature matches (nobody tampered with the token).
     *    2. The token hasn't expired.
     *  If both pass, it returns the decoded payload (e.g. { userId: "..." }).
     */
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    /*
     *  Use the decoded userId to fetch the actual user document.
     *  .select("-password") strips the hashed password from the result
     *  so it never accidentally leaks into req.user.
     */
    const user = await userModel.findById(decoded.userId).select("-password");

    if (!user) {
      return res.json({
        success: false,
        message: "User not found. Token may be invalid.",
      });
    }

    /*
     *  Attach the user object to the request.
     *  Every route handler downstream can now access req.user._id,
     *  req.user.fullName, etc. without doing another DB query.
     */
    req.user = user;

    next(); // ✅ Hand off to the actual route handler
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    res.json({ success: false, message: "Invalid or expired token. Please login again." });
  }
};
