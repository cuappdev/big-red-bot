import mongoose, { ConnectOptions } from "mongoose";
import { logWithTime } from "./utils";

export const dbConnect = async () => {
  const uri =
    process.env.NODE_ENV == "dev" || process.env.NODE_ENV == "test"
      ? process.env.DEV_URI
      : process.env.PROD_URI;
  await mongoose.connect(uri!, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  } as ConnectOptions);
  logWithTime("✅ Connected to MongoDB");
};

export const dbDisconnect = async () => {
  await mongoose.disconnect();
  logWithTime("✅ Disconnected from MongoDB");
};
