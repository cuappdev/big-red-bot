import mongoose from "mongoose";
import { logWithTime } from "./utils/timeUtils";

export const dbConnect = async () => {
  const uri = process.env.DATABASE_URI;
  await mongoose.connect(uri!);
  logWithTime("✅ Connected to MongoDB");
};
