import { withDatabaseScope } from "@/lib/db";
import { NextResponse } from "next/server";
import { getAuthenticatedDocumentUser } from "@/lib/document.server";
import { AiJob } from "@/modal/ai";
import { Document } from "@/modal/document";
import { DocumentIdParamsDto } from "@/features/documents/document.dto";
import {
  AiJobContentResultDto,
  AiJobCorrectedResultDto,
  AiJobInputOptionsDto,
  AiJobPlagiarismResultDto,
  AiJobSummaryResultDto,
  StoredDocumentAiJobDto,
  type StoredDocumentAiJob,
} from "@/features/documents/document-ai-job.dto";

const JOB_TYPE_TO_TOOL = {
  AI_HUMANIZER: "humanizer",
  PLAGIARISM_CHECKER: "plagiarism-checker",
  AI_DETECTOR: "ai-detector",
  PARAPHRASER: "paraphraser",
  AI_SUMMARIZER: "summarizer",
  GRAMMAR_CHECKER: "grammar-checker",
} as const;

function getOutput(job: StoredDocumentAiJob) {
  if (job.status === "FAILED") return job.error?.message || "Tool run failed.";
  const content = AiJobContentResultDto.safeParse(job.result);
  if (content.success) return content.data.content;
  const corrected = AiJobCorrectedResultDto.safeParse(job.result);
  if (corrected.success) return corrected.data.correctedText;
  const summary = AiJobSummaryResultDto.safeParse(job.result);
  if (summary.success) return summary.data.summary;
  const plagiarism = AiJobPlagiarismResultDto.safeParse(job.result);
  if (job.type === "PLAGIARISM_CHECKER" && plagiarism.success) {
    return `${plagiarism.data.scores.overallSimilarity}% similarity detected.`;
  }
  return job.status === "COMPLETED" ? "Analysis completed." : "Processing…";
}

async function handleGET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const user = await getAuthenticatedDocumentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "Authentication required." } },
        { status: 401 },
      );
    }

    const params = DocumentIdParamsDto.safeParse(await context.params);
    if (!params.success) {
      return NextResponse.json(
        { success: false, error: { message: "Document not found." } },
        { status: 404 },
      );
    }
    const { documentId } = params.data;

    const document = await Document.exists({
      _id: documentId,
      ownerId: user.id,
    });
    if (!document) {
      return NextResponse.json(
        { success: false, error: { message: "Document not found." } },
        { status: 404 },
      );
    }

    const jobs = (
      await AiJob.find({
        documentId,
        userId: user.id,
        source: "BOARD",
        type: { $in: Object.keys(JOB_TYPE_TO_TOOL) },
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
    ).reverse();

    return NextResponse.json({
      success: true,
      data: {
        jobs: jobs.map((rawJob) => {
          const job = StoredDocumentAiJobDto.parse(rawJob);
          const options = AiJobInputOptionsDto.safeParse(job.input.options);
          return {
            id: String(job._id),
            service: JOB_TYPE_TO_TOOL[job.type],
            input: job.input.content,
            output: getOutput(job),
            source:
              options.success && options.data.inputSource === "selection"
                ? "selection"
                : "document",
            createdAt: job.createdAt,
            failed: job.status === "FAILED",
          };
        }),
      },
    });
  } catch (error) {
    console.error(
      "Failed to load document AI jobs:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { success: false, error: { message: "Unable to load tool history." } },
      { status: 500 },
    );
  }
}

async function handleDELETE(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const user = await getAuthenticatedDocumentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "Authentication required." } },
        { status: 401 },
      );
    }

    const params = DocumentIdParamsDto.safeParse(await context.params);
    if (!params.success) {
      return NextResponse.json(
        { success: false, error: { message: "Document not found." } },
        { status: 404 },
      );
    }

    const document = await Document.exists({
      _id: params.data.documentId,
      ownerId: user.id,
    });
    if (!document) {
      return NextResponse.json(
        { success: false, error: { message: "Document not found." } },
        { status: 404 },
      );
    }

    const result = await AiJob.deleteMany({
      documentId: params.data.documentId,
      userId: user.id,
      source: "BOARD",
    });

    return NextResponse.json({
      success: true,
      data: { deletedCount: result.deletedCount },
    });
  } catch (error) {
    console.error(
      "Failed to delete document AI jobs:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { success: false, error: { message: "Unable to clear tool history." } },
      { status: 500 },
    );
  }
}

export const GET = withDatabaseScope(handleGET);
export const DELETE = withDatabaseScope(handleDELETE);
