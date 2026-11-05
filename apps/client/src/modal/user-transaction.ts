import { scopedModel } from "@/lib/db";
import mongoose, { Schema } from "mongoose";

export const UsageTransactionTypes = ["CREDIT", "DEBIT", "REFUND"] as const;
export const UsageTransactionServices = [
  "AI_HUMANIZER",
  "AI_SUMMARIZER",
  "PARAPHRASER",
  "GRAMMAR_CHECKER",
  "PLAGIARISM_CHECKER",
] as const;

const UsageTransactionSchema = new Schema(
  {
    userId: {
      type: String,
      ref: "User",
      required: true,
      index: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "AiJob",
    },
    type: {
      type: String,
      enum: UsageTransactionTypes,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    service: {
      type: String,
      enum: UsageTransactionServices,
      required: true,
    },

    description: String,

    balanceAfter: Number,
  },
  { timestamps: true }
);

UsageTransactionSchema.index({ userId: 1, createdAt: -1 });

export const UsageTransaction = scopedModel(
  mongoose.models.UsageTransaction ||
    mongoose.model("UsageTransaction", UsageTransactionSchema)
);
