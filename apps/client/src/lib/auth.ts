import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { client as connectToDatabase } from "./db";
import { env } from "./env";

const mongoose = await connectToDatabase();
const db = mongoose.connection.db;

if (!db) {
  throw new Error("MongoDB connection was established without a database");
}

export const auth = betterAuth({
  baseURL: env.NEXT_PUBLIC_APP_BASE_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(db),

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },

  trustedOrigins: [env.NEXT_PUBLIC_APP_BASE_URL],
});
