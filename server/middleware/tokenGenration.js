/**
 * middleware/tokenGenration.js  —  JWT Token Generator
 *
 *  🔑 WHAT IS A JWT?
 *
 *  JSON Web Token is a compact, URL-safe string with 3 parts:
 *    Header.Payload.Signature
 *
 *  The Payload holds data we sign (e.g. { userId: "abc123", iat: ... }).
 *  The Signature proves the payload wasn't tampered with.
 *  Anyone can READ the payload (it's base64), but can't FAKE the signature
 *  without knowing the secret key.
 *
 *  ⚠️ FIX: Original code had no expiry → tokens were valid forever.
 *           Added "7d" expiry as a security best practice.
 */

import jwt from "jsonwebtoken";

/**
 * Generate a signed JWT for the given user.
 *
 * @param {string} userId  MongoDB ObjectId as string
 * @returns {string}       Signed JWT
 */
export const generateToken = (userId) => {
  const token = jwt.sign(
    { userId },                         // Payload — what we embed in the token
    process.env.JWT_SECRET_KEY,         // Secret — used to sign + verify
    { expiresIn: "7d" }                 // ⚠️ ADDED: token expires in 7 days
  );
  return token;
};
