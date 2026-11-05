import { scopedModel } from "@/lib/db";
import mongoose, { Schema } from "mongoose";

/**
 * Sub-schema for an individual match span within the submitted text.
 * Tracks character offsets, match type, and cross-reference to source index.
 */
const PlagiarismMatchSchema = new Schema(
  {
    startChar: { type: Number, required: true },
    endChar: { type: Number, required: true },
    matchText: { type: String },
    sourceText: { type: String },
    sourceIndex: { type: Number },
    matchType: {
      type: String,
      enum: ["identical", "paraphrased", "quoted"],
    },
    similarityScore: { type: Number, min: 0, max: 1 },
  },
  { _id: false }
);

/**
 * Sub-schema for an external web source discovered during the plagiarism check.
 */
const PlagiarismSourceSchema = new Schema(
  {
    url: { type: String, required: true },
    title: { type: String },
    domain: { type: String },
    author: { type: String },
    publishDate: { type: String },
    matchPercentage: { type: Number, min: 0, max: 100 },
    matchedWordCount: { type: Number },
    isExcluded: { type: Boolean, default: false },
    retrievedAt: { type: Date },
  },
  { _id: false }
);

/**
 * Main Mongoose schema for a persisted plagiarism report.
 * Linked to an AiJob document for lifecycle tracking.
 */
const PlagiarismReportSchema = new Schema(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "AiJob",
      required: true,
      index: true,
    },
    userId: { type: String, index: true },
    anonymousId: { type: String, index: true },
    overallSimilarity: { type: Number, min: 0, max: 100 },
    identicalScore: { type: Number, min: 0, max: 100 },
    paraphrasedScore: { type: Number, min: 0, max: 100 },
    quotedScore: { type: Number, min: 0, max: 100 },
    originalScore: { type: Number, min: 0, max: 100 },
    wordCount: { type: Number },
    sentenceCount: { type: Number },
    sources: { type: [PlagiarismSourceSchema], default: [] },
    matches: { type: [PlagiarismMatchSchema], default: [] },
    settings: {
      excludeQuotes: { type: Boolean, default: true },
      excludeBibliography: { type: Boolean, default: true },
      excludeSmallMatches: { type: Boolean, default: true },
      minWordsThreshold: { type: Number, default: 8 },
    },
    summary: { type: String },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    processingTimeMs: { type: Number },
  },
  { timestamps: true }
);

PlagiarismReportSchema.index({ userId: 1, createdAt: -1 });
PlagiarismReportSchema.index({ anonymousId: 1, createdAt: -1 });

export const PlagiarismReport = scopedModel(
  (mongoose.models.PlagiarismReport as mongoose.Model<mongoose.InferSchemaType<typeof PlagiarismReportSchema>>) ||
    mongoose.model("PlagiarismReport", PlagiarismReportSchema)
);
