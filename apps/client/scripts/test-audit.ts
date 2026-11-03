import { NextRequest } from "next/server";
import dotenv from "dotenv";
import path from "path";

process.env.SKIP_ENV_VALIDATION = "1";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { POST } from "../src/app/api/v1/humanize/route";
import { MAX_INPUT_TEXT_LENGTH } from "../src/features/humanizer";

async function runComprehensiveAuditTests() {
  console.log("===============================================================");
  console.log("   Step 4: Comprehensive Backend & API Production Audit Suite  ");
  console.log("===============================================================\n");

  let passed = 0;
  let failed = 0;

  async function assertCase(
    name: string,
    req: NextRequest,
    expectedStatus: number,
    checkFn: (body: any) => boolean | string
  ) {
    process.stdout.write(`• Checking: ${name}... `);
    try {
      const res = await POST(req);
      const body = await res.json();

      if (res.status !== expectedStatus) {
        console.log(`❌ Failed: Expected status ${expectedStatus}, got ${res.status}`);
        console.log("Body:", body);
        failed++;
        return;
      }

      const result = checkFn(body);
      if (result === true) {
        console.log(`✅ Passed (${res.status})`);
        passed++;
      } else {
        console.log(`❌ Failed: ${result}`);
        failed++;
      }
    } catch (err: any) {
      console.log(`❌ Failed with exception: ${err.message}`);
      failed++;
    }
  }

  // 1. Missing Content-Type
  await assertCase(
    "Missing Content-Type header rejection (415)",
    new NextRequest("http://localhost:3000/api/humanize", {
      method: "POST",
      body: JSON.stringify({ text: "Valid text" }),
    }),
    415,
    (b) => b.error?.code === "UNSUPPORTED_MEDIA_TYPE"
  );

  // 2. Malformed JSON
  await assertCase(
    "Malformed JSON body rejection (400)",
    new NextRequest("http://localhost:3000/api/humanize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ text: invalid_no_quotes }",
    }),
    400,
    (b) => b.error?.code === "INVALID_JSON"
  );

  // 3. Missing text field
  await assertCase(
    "Missing text field validation (400)",
    new NextRequest("http://localhost:3000/api/humanize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "natural" }),
    }),
    400,
    (b) => b.error?.code === "VALIDATION_ERROR"
  );

  // 4. Whitespace-only text
  await assertCase(
    "Whitespace-only text validation (400)",
    new NextRequest("http://localhost:3000/api/humanize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "   \n\t  " }),
    }),
    400,
    (b) => b.error?.code === "VALIDATION_ERROR"
  );

  // 5. Invalid mode
  await assertCase(
    "Invalid mode parameter validation (400)",
    new NextRequest("http://localhost:3000/api/humanize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "valid text", mode: "unsupported_mode" }),
    }),
    400,
    (b) => b.error?.code === "VALIDATION_ERROR"
  );

  // 6. Invalid intensity
  await assertCase(
    "Invalid intensity parameter validation (400)",
    new NextRequest("http://localhost:3000/api/humanize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "valid text", intensity: "extreme" }),
    }),
    400,
    (b) => b.error?.code === "VALIDATION_ERROR"
  );

  // 7. Oversized payload (> 15,000 chars)
  await assertCase(
    "Oversized payload rejection (413)",
    new NextRequest("http://localhost:3000/api/humanize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "x".repeat(MAX_INPUT_TEXT_LENGTH + 1) }),
    }),
    413,
    (b) => b.error?.code === "PAYLOAD_TOO_LARGE"
  );

  // 8. Anonymous rate-limiting check
  await assertCase(
    "Anonymous request handling with IP extraction (200)",
    new NextRequest("http://localhost:3000/api/humanize", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.195, 70.41.3.18",
      },
      body: JSON.stringify({
        text: "The quarterly financial report was published this morning.",
        mode: "professional",
        intensity: "low",
      }),
    }),
    200,
    (b) =>
      b.success === true &&
      b.data?.selectedMode === "professional" &&
      b.data?.selectedIntensity === "low" &&
      typeof b.data?.humanizedText === "string"
  );

  // 9. Semantic Regression Test: No Hallucinated Examples (No invoices, tickets, support)
  await assertCase(
    "Semantic Regression: Strict Meaning Preservation without Hallucination (200)",
    new NextRequest("http://localhost:3000/api/humanize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "In conclusion, it is of paramount importance to leverage artificial intelligence in order to optimize business productivity and facilitate synergies across multifaceted organizational paradigms.",
        mode: "natural",
        intensity: "medium",
      }),
    }),
    200,
    (b) => {
      const lower = (b.data?.humanizedText || "").toLowerCase();
      if (lower.includes("invoice") || lower.includes("ticket") || lower.includes("customer support")) {
        return "Failed: Output hallucinated unsupported examples (invoices/tickets).";
      }
      return true;
    }
  );

  console.log("\n===============================================================");
  console.log(`Audit Suite Results: ${passed} Passed, ${failed} Failed`);
  console.log("===============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveAuditTests();

