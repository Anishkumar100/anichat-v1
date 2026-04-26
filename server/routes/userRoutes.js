/**
 * routes/userRoutes.js  —  Auth & Profile Routes
 */

import express from "express";
import {
  checkAuth,
  login,
  signUp,
  updateProfile,
} from "../controller/userController.js";
import { auth } from "../middleware/auth.js";

const userRouter = express.Router();

// POST /api/auth/signup          → create new account
userRouter.post("/signup", signUp);

// POST /api/auth/login           → login with email + password
userRouter.post("/login", login);

// PUT  /api/auth/update-profile  → update name, bio, profile pic (auth required)
userRouter.put("/update-profile", auth, updateProfile);

// GET  /api/auth/check           → verify token is still valid (used on page refresh)
userRouter.get("/check", auth, checkAuth);

export default userRouter;
