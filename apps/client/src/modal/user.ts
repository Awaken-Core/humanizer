import mongoose, { Schema, models, model } from "mongoose";

const userSchema = new Schema(
  {
    id: { type: String },
    name: { type: String, required: true },
    email: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  {
    collection: "user",
    strict: false,
  }
);

const sessionSchema = new Schema(
  {
    id: { type: String },
    userId: { type: String, required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  {
    collection: "session",
    strict: false,
  }
);

const accountSchema = new Schema(
  {
    id: { type: String },
    userId: { type: String, required: true },
    accountId: { type: String, required: true },
    providerId: { type: String, required: true },

    accessToken: { type: String },
    refreshToken: { type: String },
    idToken: { type: String },
    accessTokenExpiresAt: { type: Date },
    refreshTokenExpiresAt: { type: Date },
    scope: { type: String },
    password: { type: String },

    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  {
    collection: "account",
    strict: false,
  }
);

const verificationSchema = new Schema(
  {
    id: { type: String },
    identifier: { type: String, required: true },
    value: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  {
    collection: "verification",
    strict: false,
  }
);

const Verification = models.Verification || model("Verification", verificationSchema);
const Account = models.Account || model("Account", accountSchema);
const Session = models.Session || model("Session", sessionSchema);
const User = models.User || model("User", userSchema);

export { User, Session, Account, Verification };