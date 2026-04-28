import mongoose from "mongoose"

const userSchema = mongoose.Schema({
    email:      { type: String, required: true, unique: true },
    fullName:   { type: String, required: true },
    password:   { type: String, required: true, minlength: 6 },
    profilePic: { type: String, default: "" }, 
    bio:        { type: String, required: true },
    // Heartbeat-based online presence (works on Vercel — stored in DB not memory)
    // Updated every ~30s while the user is active. Used when Socket.io is unavailable.
    lastSeen:   { type: Date, default: null },
}, { timestamps: true })

const userModel = mongoose.model("Users", userSchema)
export default userModel
