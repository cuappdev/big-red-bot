import mongoose from "mongoose";

export const dbConnect = async () => {
  const uri = process.env.DATABASE_URI;
  await mongoose.connect(uri!);
};
