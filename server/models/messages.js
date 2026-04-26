import mongoose from "mongoose";

const messageSchema = mongoose.Schema(
  {
    senderId:   { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    recieverId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    text:       { type: String, default: "" },
    image:      { type: String, default: "" },
    seen:       { type: Boolean, default: false },
    // Soft-delete: keeps the document so "deleted" bubble can be shown
    deleted:    { type: Boolean, default: false },
    // Emoji reactions: [{ emoji:"❤️", users:["userId",...] }]
    reactions:  [{ emoji: { type: String }, users: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }] }],
  },
  { timestamps: true }
);

export default mongoose.model("Messages", messageSchema);
