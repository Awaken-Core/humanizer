import mongoose, { Schema } from "mongoose";

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
        isArchived: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

DocumentSchema.index({ ownerId: 1, updatedAt: -1 });
DocumentSchema.index({ anonymousId: 1, updatedAt: -1 });

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
            type: String,
            required: true,
        },
        createdBy: {
            type: String,
            ref: "User",
        },
        parentVersion: {
            type: Number,
        },
    },
    { timestamps: true }
);

DocumentVersionSchema.index(
    { documentId: 1, version: 1 },
    { unique: true }
);

export const DocumentVersion =
    mongoose.models.DocumentVersion ||
    mongoose.model("DocumentVersion", DocumentVersionSchema);

export const Document =
    mongoose.models.Document ||
    mongoose.model("Document", DocumentSchema);
