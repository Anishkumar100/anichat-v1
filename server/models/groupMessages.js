import mongoose from "mongoose";

const groupMessageSchema = mongoose.Schema(
  {
    groupId:  { type: mongoose.Schema.Types.ObjectId, ref: "Groups", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    text:     { type: String, default: "" },
    image:    { type: String, default: "" },
    seenBy:   [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    deleted:  { type: Boolean, default: false },
    reactions:[{ emoji: { type: String }, users: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }] }],
  },
  { timestamps: true }
);

export default mongoose.model("GroupMessages", groupMessageSchema);
