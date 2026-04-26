import mongoose from "mongoose"

//Function to connect to the mongodb database

export const connectDB = async()=>
{
    try 
    {
        await mongoose.connect(`${process.env.MONGODB_URL}`)
        console.log(`Database is connected`)
    } 
    catch (error) 
    {
        console.log(error.message)
    }
}
