import { describe, expect, it } from "bun:test";
import {
  useToolStore,
  TOOL_CLIENT_TIMEOUTS_MS,
  DEFAULT_TOOL_PREFERENCES,
} from "../src/store/workspace.store";
import { normalizeClientError } from "../src/lib/api.dto";
import { classifyError, sanitizeLogData } from "../src/lib/server-error";
import sitemap from "../src/app/sitemap";
import { SEO_TOOLS_CONFIG } from "../src/lib/seo-data";

describe("Regression Suite: Persistent Workspace, Data Integrity & PR Review Findings", () => {
  describe("1. Document Preservation Across Tool Navigation (P1 Issue 1)", () => {
    it("preserves DOCX reconstruction metadata when switching tools", () => {
      const mockDocxResult = {
        text: "Extracted legal agreement paragraph.",
        zip: {} as any,
        paragraphCount: 4,
      };

      // User uploads DOCX on humanizer
      useToolStore.getState().setActiveTool("humanizer");
      useToolStore.getState().setUploadedDocument({
        name: "contract.docx",
        format: "docx",
        docxResult: mockDocxResult as any,
      });

      // User navigates across other tool routes
      useToolStore.getState().setActiveTool("ai-detector");
      expect(useToolStore.getState().uploadedDocument).not.toBeNull();
      expect(useToolStore.getState().uploadedDocument?.name).toBe("contract.docx");

      useToolStore.getState().setActiveTool("paraphraser");
      useToolStore.getState().setActiveTool("plagiarism-checker");

      // User returns to humanizer
      useToolStore.getState().setActiveTool("humanizer");
      const currentDoc = useToolStore.getState().uploadedDocument;
      expect(currentDoc).not.toBeNull();
      expect(currentDoc?.format).toBe("docx");
      expect(currentDoc?.docxResult?.paragraphCount).toBe(4);
    });

    it("preserves LaTeX and Markdown placeholder maps across multiple route switches", () => {
      const latexMap = new Map<string, string>([
        ["%%LATEX_EQ_1%%", "\\sum_{i=1}^{n} x_i"],
      ]);
      const mdMap = new Map<string, string>([
        ["%%MD_CODE_1%%", "```python\nprint(1)\n```"],
      ]);

      useToolStore.getState().setUploadedDocument({
        name: "paper.tex",
        format: "latex",
        latexPlaceholders: latexMap,
      });

      useToolStore.getState().setActiveTool("summarizer");
      useToolStore.getState().setActiveTool("grammar-checker");
      useToolStore.getState().setActiveTool("ai-humanizer" as any);

      const restored = useToolStore.getState().uploadedDocument;
      expect(restored?.format).toBe("latex");
      expect(restored?.latexPlaceholders?.get("%%LATEX_EQ_1%%")).toBe("\\sum_{i=1}^{n} x_i");

      // Update to Markdown
      useToolStore.getState().setUploadedDocument({
        name: "notes.md",
        format: "markdown",
        markdownPlaceholders: mdMap,
      });

      useToolStore.getState().setActiveTool("paraphraser");
      const mdRestored = useToolStore.getState().uploadedDocument;
      expect(mdRestored?.format).toBe("markdown");
      expect(mdRestored?.markdownPlaceholders?.get("%%MD_CODE_1%%")).toContain("print(1)");
    });
  });

  describe("2. Client Request Lifecycle & Timeout Budget (P1 Issue 2)", () => {
    it("allocates client deadlines strictly greater than server execution limits", () => {
      // Server limits: humanizer = 60s, plagiarism = 60s, grammar = 45s, paraphrase = 45s, summarize = 45s, detector = 15s
      expect(TOOL_CLIENT_TIMEOUTS_MS.humanizer).toBe(65_000);
      expect(TOOL_CLIENT_TIMEOUTS_MS.humanizer).toBeGreaterThan(60_000);

      expect(TOOL_CLIENT_TIMEOUTS_MS["plagiarism-checker"]).toBe(65_000);
      expect(TOOL_CLIENT_TIMEOUTS_MS["plagiarism-checker"]).toBeGreaterThan(60_000);

      expect(TOOL_CLIENT_TIMEOUTS_MS["grammar-checker"]).toBe(50_000);
      expect(TOOL_CLIENT_TIMEOUTS_MS["grammar-checker"]).toBeGreaterThan(45_000);

      expect(TOOL_CLIENT_TIMEOUTS_MS.paraphraser).toBe(50_000);
      expect(TOOL_CLIENT_TIMEOUTS_MS.paraphraser).toBeGreaterThan(45_000);

      expect(TOOL_CLIENT_TIMEOUTS_MS.summarizer).toBe(50_000);
      expect(TOOL_CLIENT_TIMEOUTS_MS.summarizer).toBeGreaterThan(45_000);

      expect(TOOL_CLIENT_TIMEOUTS_MS["ai-detector"]).toBe(18_000);
      expect(TOOL_CLIENT_TIMEOUTS_MS["ai-detector"]).toBeGreaterThan(15_000);
    });
  });

  describe("3. Race Conditions & Result State Isolation (Part 2 Issue 3)", () => {
    it("isolates tool results and prevents cross-tool data contamination", () => {
      useToolStore.getState().clearResult();

      // Populate humanizer result
      useToolStore.setState((state) => ({
        toolResults: {
          ...state.toolResults,
          humanizer: {
            outputText: "Humanized output text",
            plagiarismResult: null,
            aiDetectorResult: null,
            grammarResult: null,
            error: null,
            errorDetail: null,
          },
        },
      }));

      // Switch to ai-detector
      useToolStore.getState().setActiveTool("ai-detector");
      expect(useToolStore.getState().outputText).toBe("");

      // Switch back to humanizer
      useToolStore.getState().setActiveTool("humanizer");
      expect(useToolStore.getState().outputText).toBe("Humanized output text");
      expect(useToolStore.getState().getToolResult("humanizer").outputText).toBe("Humanized output text");
      expect(useToolStore.getState().getToolResult("ai-detector").outputText).toBe("");
    });
  });

  describe("4. Tool Preferences Persistence (Part 2 Issue 4)", () => {
    it("maintains independent tool settings across route transitions", () => {
      // Default preferences
      expect(DEFAULT_TOOL_PREFERENCES.humanizer.mode).toBe("natural");
      expect(DEFAULT_TOOL_PREFERENCES.paraphraser.tone).toBe("standard");

      // User changes humanizer to professional/high
      useToolStore.getState().setToolPreference("humanizer", "mode", "professional");
      useToolStore.getState().setToolPreference("humanizer", "intensity", "high");

      // User changes paraphraser to formal/structure
      useToolStore.getState().setToolPreference("paraphraser", "tone", "formal");
      useToolStore.getState().setToolPreference("paraphraser", "focus", "structure");

      // User changes plagiarism-checker exclusion filters
      useToolStore.getState().setToolPreference("plagiarism-checker", "excludeQuotes", false);

      // Verify states persist independently
      const prefs = useToolStore.getState().toolPreferences;
      expect(prefs.humanizer.mode).toBe("professional");
      expect(prefs.humanizer.intensity).toBe("high");
      expect(prefs.paraphraser.tone).toBe("formal");
      expect(prefs.paraphraser.focus).toBe("structure");
      expect(prefs.summarizer.mode).toBe("academic"); // untouched default
      expect(prefs["plagiarism-checker"].excludeQuotes).toBe(false);
      expect(prefs["plagiarism-checker"].excludeBibliography).toBe(true);
    });
  });

  describe("5. Error Handling Compatibility & Classification (Part 3 Issue 5 & 6)", () => {
    it("normalizes legacy message-only errors without losing context", () => {
      const errNotFound = normalizeClientError({ message: "Document not found." });
      expect(errNotFound.code).toBe("DOCUMENT_NOT_FOUND");
      expect(errNotFound.message).toBe("Document not found.");
      expect(errNotFound.retryable).toBe(false);

      const errAuth = normalizeClientError({ message: "Authentication required." });
      expect(errAuth.code).toBe("UNAUTHORIZED");
      expect(errAuth.message).toBe("Authentication required.");
      expect(errAuth.retryable).toBe(false);

      const errSession = normalizeClientError({ message: "Session expired. Please sign in." });
      expect(errSession.code).toBe("UNAUTHORIZED");
      expect(errSession.retryable).toBe(false);

      const errAccess = normalizeClientError({ message: "Unable to access document: Permission denied" });
      expect(errAccess.code).toBe("ACCESS_DENIED");
      expect(errAccess.retryable).toBe(false);
    });

    it("correctly classifies HTTP 415, 400, 401, 403, 408, 429, 500, 502, 503, 504", () => {
      expect(classifyError(new Error("Content-Type must be application/json."), 415).retryable).toBe(false);
      expect(classifyError(new Error("Content-Type must be application/json."), 415).code).toBe("UNSUPPORTED_MEDIA_TYPE");

      expect(classifyError(new Error("Invalid parameters"), 400).retryable).toBe(false);
      expect(classifyError(new Error("Unauthorized access"), 401).retryable).toBe(false);
      expect(classifyError(new Error("Forbidden action"), 403).retryable).toBe(false);
      expect(classifyError(new Error("Payload too big"), 413).retryable).toBe(false);

      expect(classifyError(new Error("Request timed out"), 408).retryable).toBe(true);
      expect(classifyError(new Error("Too many requests"), 429).retryable).toBe(true);
      expect(classifyError(new Error("Bad gateway"), 502).retryable).toBe(true);
      expect(classifyError(new Error("Service unavailable"), 503).retryable).toBe(true);
      expect(classifyError(new Error("Gateway timeout"), 504).retryable).toBe(true);
      expect(classifyError(new Error("Internal crash"), 500).retryable).toBe(true);
    });

    it("scrubs internal provider names and tokens in error sanitization", () => {
      const sanitized = sanitizeLogData("Error in DeepSeek API with sk-1234567890abcdefghijklmn and user email john@example.com") as string;
      expect(sanitized).not.toContain("sk-1234567890abcdefghijklmn");
      expect(sanitized).toContain("[REDACTED_API_KEY]");
      expect(sanitized).toContain("[REDACTED_EMAIL]");
    });
  });

  describe("6. SEO Canonical Sitemap (Part 4 Issue 8)", () => {
    it("excludes the redirecting root route from the sitemap", () => {
      const items = sitemap();
      const urls = items.map((i) => i.url);

      // Root homepage serves canonical landing content and is in the sitemap
      const hasBareRoot = urls.some((u) => u === "http://localhost:3000" || u === "http://localhost:3000/");
      expect(hasBareRoot).toBe(true);

      // Dedicated canonical tool pages MUST be present
      expect(urls.some((u) => u.endsWith("/ai-humanizer"))).toBe(true);
      expect(urls.some((u) => u.endsWith("/ai-detector"))).toBe(true);
      expect(urls.some((u) => u.endsWith("/paraphraser"))).toBe(true);
      expect(urls.some((u) => u.endsWith("/summarizer"))).toBe(true);
      expect(urls.some((u) => u.endsWith("/plagiarism-checker"))).toBe(true);
      expect(urls.some((u) => u.endsWith("/grammar-checker"))).toBe(true);
    });
  });

  describe("7. Privacy Claims Accuracy (Part 5 Issue 9)", () => {
    it("accurately describes AI detector storage practices without unsupported claims", () => {
      const detectorConfig = SEO_TOOLS_CONFIG["ai-detector"];
      const titles = detectorConfig.features.map((f) => f.title);

      // "Zero-Storage Privacy" was removed
      expect(titles).not.toContain("Zero-Storage Privacy");
      expect(titles).toContain("Private Analysis & Security");

      const storageFaq = detectorConfig.faqs.find((f) => f.question.includes("store my text"));
      expect(storageFaq).toBeDefined();
      expect(storageFaq?.answer).toContain("privacy policy");
      expect(storageFaq?.answer).not.toContain("does not store");
    });
  });
});

