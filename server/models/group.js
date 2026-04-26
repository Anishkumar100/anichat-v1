/**
 * models/group.js  —  Group Chat Schema & Model
 *
 *  Stores group metadata. Group messages are stored in
 *  a separate groupMessages model.
 *
 *  Fields:
 *  ─────────────────────────────────────────────────────
 *  name      → display name of the group
 *  bio       → description / about
 *  groupPic  → Cloudinary URL of group avatar
 *  members   → array of user ObjectIds who belong to this group
 *  admin     → the user who created the group (can manage it)
 */

import mongoose from "mongoose";

const groupSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    bio: {
      type: String,
      default: "",
    },

    groupPic: {
      type: String,    // Cloudinary URL
      default: "",
    },

    // Array of user references — everyone in the group
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
      },
    ],

    // The user who created the group
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
  },
  { timestamps: true }
);

const groupModel = mongoose.model("Groups", groupSchema);

export default groupModel;
