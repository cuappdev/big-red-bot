import mongoose from "mongoose";

export const dbConnect = async () => {
  const uri =
    process.env.NODE_ENV === "test"
      ? process.env.TEST_DATABASE_URI
      : process.env.DATABASE_URI;
  await mongoose.connect(uri!);
};
