import mongoose from "mongoose";
import { env } from "./env.js";

let mongoConnected = false;

export const connectDatabase = async () => {
  if (!env.mongoUri) {
    mongoConnected = false;
    return false;
  }

  try {
    await mongoose.connect(env.mongoUri, {
      dbName: env.mongoDbName
    });
    mongoConnected = true;
    console.log(`MongoDB connected (${env.mongoDbName})`);
    return true;
  } catch (error) {
    mongoConnected = false;
    console.error("MongoDB connection failed. Falling back to JSON store:", error.message);
    return false;
  }
};

export const isMongoConnected = () =>
  mongoConnected && mongoose.connection.readyState === 1;


