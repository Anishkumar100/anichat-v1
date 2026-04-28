/**
 * controller/userController.js  —  User Auth & Profile Controllers
 *
 *  Functions exported:
 *  ─────────────────────────────────────────────────────
 *  signUp         → create a new account
 *  login          → authenticate and return token
 *  checkAuth      → verify a token is still valid (used on page reload)
 *  updateProfile  → change name, bio, or profile picture
 */

import userModel from "../models/user.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../middleware/tokenGenration.js";
import cloudinary from "../config/cloudinary.js"; // ⚠️ FIXED: was missing, causing ReferenceError in updateProfile

// ─────────────────────────────────────────────────────────────────────────────
// SIGN UP
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/auth/signup
 * Body: { fullName, email, password, bio }
 *
 * Creates a new user. Passwords are hashed with bcrypt before storage —
 * NEVER store plain-text passwords.
 */
export const signUp = async (req, res) => {
  const { fullName, email, password, bio } = req.body;

  try {
    // Validate all required fields are present
    if (!fullName || !email || !password || !bio) {
      return res.json({ success: false, message: "All fields are required." });
    }

    // Check if an account with this email already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, message: "Account already exists. Please login." });
    }

    /*
     *  bcrypt.genSalt(10) → creates a "salt" (random string added to password
     *  before hashing to prevent rainbow-table attacks).
     *  The "10" is the cost factor — how many hashing rounds to run.
     *  Higher = slower but more secure.
     */
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create and save the new user document
    const newUser = await userModel.create({
      fullName,
      email,
      bio,
      password: hashedPassword,
    });

    // Generate a JWT so the user is immediately logged in after signup
    const token = generateToken(newUser._id);

    // Return user data (without password) + token
    res.json({
      success: true,
      userData: {
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        bio: newUser.bio,
        profilePic: newUser.profilePic,
      },
      token,
      message: "Account created successfully!",
    });
  } catch (error) {
    console.error("signUp error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Verifies credentials and returns a JWT if valid.
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Look up user by email
    const userData = await userModel.findOne({ email });
    if (!userData) {
      return res.json({ success: false, message: "Account doesn't exist. Please sign up." });
    }

    /*
     *  bcrypt.compare() hashes the incoming plain-text password
     *  with the same salt that was used originally, then checks
     *  if the result matches the stored hash.
     */
    const isPasswordCorrect = await bcrypt.compare(password, userData.password);
    if (!isPasswordCorrect) {
      return res.json({ success: false, message: "Invalid password." });
    }

    const token = generateToken(userData._id);

    res.json({
      success: true,
      userData: {
        _id: userData._id,
        fullName: userData.fullName,
        email: userData.email,
        bio: userData.bio,
        profilePic: userData.profilePic,
      },
      token,
      message: `Welcome back, ${userData.fullName}!`,
    });
  } catch (error) {
    console.error("login error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK AUTH  (called on every page refresh to restore session)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/auth/check
 * Headers: { Authorization: <token> }
 *
 * The auth middleware already verified the token and populated req.user.
 * This controller just sends that user object back to the client.
 *
 * 💡 Why separate from middleware?
 *    Middleware should only validate / enrich the request.
 *    Sending a response is the controller's job.
 */
export const checkAuth = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PROFILE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PUT /api/auth/update-profile
 * Headers: { Authorization: <token> }
 * Body: { fullName, bio, profilePic? }
 *
 * profilePic is a base64-encoded image string.
 * We upload it to Cloudinary and store the returned secure_url.
 */
export const updateProfile = async (req, res) => {
  try {
    const { profilePic, bio, fullName } = req.body;
    const userId = req.user._id; // provided by auth middleware

    let updatedUser;

    if (profilePic) {
      /*
       *  cloudinary.uploader.upload() accepts a base64 data URI
       *  (e.g. "data:image/png;base64,iVBOR...") and uploads it.
       *  It returns an object where secure_url is the hosted image URL.
       */
      const uploadResult = await cloudinary.uploader.upload(profilePic);

      updatedUser = await userModel
        .findByIdAndUpdate(
          userId,
          { profilePic: uploadResult.secure_url, bio, fullName },
          { new: true } // return the updated document, not the old one
        )
        .select("-password");
    } else {
      // No image change — just update text fields
      updatedUser = await userModel
        .findByIdAndUpdate(userId, { bio, fullName }, { new: true })
        .select("-password");
    }

    res.json({ success: true, user: updatedUser, message: "Profile updated successfully." });
  } catch (error) {
    console.error("updateProfile error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// ── Heartbeat — updates lastSeen so other clients can detect this user is online ──
export const heartbeat = async (req, res) => {
  try {
    await userModel.findByIdAndUpdate(req.user._id, { lastSeen: new Date() });
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// ── Get online users — anyone with lastSeen in the last 90 seconds ────────────
export const getOnlineUsers = async (req, res) => {
  try {
    const threshold = new Date(Date.now() - 90_000);
    const online = await userModel.find(
      { lastSeen: { $gte: threshold }, _id: { $ne: req.user._id } },
      { _id: 1 }
    );
    res.json({ success: true, onlineIds: online.map(u => u._id.toString()) });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
