import { scopedModel } from "@/lib/db";
import mongoose, { Schema } from "mongoose";

const EMPTY_RICH_TEXT = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const DocumentSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      default: "Untitled Document",
    },
    // Better Auth user IDs are strings rather than Mongo ObjectIds.
    ownerId: {
      type: String,
      ref: "User",
      index: true,
    },
    anonymousId: {
      type: String,
      index: true,
    },
    latestVersion: {
      type: Number,
      default: 1,
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    characterCount: {
      type: Number,
      default: 0,
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
      default: () => structuredClone(EMPTY_RICH_TEXT),
    },
    plainText: {
      type: String,
      default: "",
    },
    contentSchemaVersion: {
      type: Number,
      default: 1,
    },
    isFavorite: {
      type: Boolean,
      default: false,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

DocumentSchema.index({ ownerId: 1, updatedAt: -1 });
DocumentSchema.index({ anonymousId: 1, updatedAt: -1 });
DocumentSchema.index({
  ownerId: 1,
  isArchived: 1,
  isFavorite: 1,
  updatedAt: -1,
});

const DocumentVersionSchema = new Schema(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
    },

    content: {
      type: Schema.Types.Mixed,
      required: true,
    },
    plainText: {
      type: String,
      default: "",
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    characterCount: {
      type: Number,
      default: 0,
    },
    contentSchemaVersion: {
      type: Number,
      default: 1,
    },
    createdBy: {
      type: String,
      ref: "User",
    },
    parentVersion: {
      type: Number,
    },
  },
  { timestamps: true },
);

DocumentVersionSchema.index({ documentId: 1, version: 1 }, { unique: true });

export const DocumentVersion = scopedModel(
  mongoose.models.DocumentVersion ||
    mongoose.model("DocumentVersion", DocumentVersionSchema)
);

export const Document = scopedModel(
  mongoose.models.Document || mongoose.model("Document", DocumentSchema)
);
