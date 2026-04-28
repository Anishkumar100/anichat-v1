import mongoose from "mongoose"
// this file is for creating user model


//this user will be created when he signs up. by filling these details
const userSchema = mongoose.Schema({
    email:{type:String, required:true, unique:true},
    fullName:{type:String,required:true},
    password:{type:String,required:true,minlength:6},
    profilePic:{type:String,default:""}, 
    bio:{type:String,required:true},
    lastSeen: { type: Date, default: null }
},{timestamps:true})

const userModel = mongoose.model("Users",userSchema)

export default userModel


/*
In this project we don’t use multer because:
- We only store `profilePic` as a string in the schema.
- Frontend uploads the image directly to Cloudinary and sends the URL to backend.
So the backend never handles raw files — it just saves the URL.

Multer is normally used to handle raw file uploads (multipart/form-data)
before uploading them to Cloudinary or another servic
*/
