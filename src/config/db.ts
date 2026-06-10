import dns from "dns";
import mongoose from "mongoose";

dns.setDefaultResultOrder("ipv4first");

export async function connectToDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log("Mongo Connection is Completed!");
  } catch (err) {
    console.error("MongoDB connection error1", err);
    process.exit(1);
  }
}