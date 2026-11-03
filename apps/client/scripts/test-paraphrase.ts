import { NextRequest } from "next/server";
import dotenv from "dotenv";
import path from "path";

process.env.SKIP_ENV_VALIDATION = "1";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { POST } from "../src/app/api/v1/paraphrase/route";

async function runParaphraseTests() {
  console.log("==========================================================");
  console.log("      AI Paraphraser API (/api/v1/paraphrase) Tests       ");
  console.log("==========================================================\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Content-Type check
  console.log("Test 1: Reject non-JSON content-type...");
  {
    const req = new NextRequest("http://localhost:3000/api/v1/paraphrase", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hello world",
    });
    const res = await POST(req);
    const body = await res.json();
    if (res.status === 415 && body.error?.code === "UNSUPPORTED_MEDIA_TYPE") {
      console.log("✅ Passed (Status 415, UNSUPPORTED_MEDIA_TYPE)\n");
      passed++;
    } else {
      console.error(`❌ Failed: Status ${res.status}`, body);
      failed++;
    }
  }

  // Test 2: Empty text rejected
  console.log("Test 2: Reject empty text...");
  {
    const req = new NextRequest("http://localhost:3000/api/v1/paraphrase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "   " }),
    });
    const res = await POST(req);
    const body = await res.json();
    if (res.status === 400 && body.error?.code === "VALIDATION_ERROR") {
      console.log("✅ Passed (Status 400, VALIDATION_ERROR)\n");
      passed++;
    } else {
      console.error(`❌ Failed: Status ${res.status}`, body);
      failed++;
    }
  }

  // Test 3: Standard tone + Both focus (Live DeepSeek call)
  console.log("Test 3: Live paraphrase with Tone: Standard & Focus: Both...");
  {
    const sample =
      "Artificial intelligence models have demonstrated notable capabilities in modern data processing. However, users should always verify factual assertions independently.";
    const req = new NextRequest("http://localhost:3000/api/v1/paraphrase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: sample,
        tone: "standard",
        focus: "both",
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    if (res.status === 200 && body.success && body.data?.paraphrasedText) {
      console.log("✅ Passed (Status 200, successfully paraphrased)");
      console.log(`\nOriginal:\n"${sample}"`);
      console.log(`\nParaphrased:\n"${body.data.paraphrasedText}"\n`);
      passed++;
    } else {
      console.error(`❌ Failed: Status ${res.status}`, body);
      failed++;
    }
  }

  // Test 4: Shorten tone (Verify compression)
  console.log("Test 4: Live paraphrase with Tone: Shorten...");
  {
    const sample =
      "Due to the fact that inclement weather conditions have been forecasted by meteorological agencies, it is strongly recommended that all employees work from their personal residences tomorrow.";
    const req = new NextRequest("http://localhost:3000/api/v1/paraphrase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: sample,
        tone: "shorten",
        focus: "structure",
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    if (res.status === 200 && body.success && body.data?.paraphrasedText) {
      console.log("✅ Passed (Status 200, successfully shortened)");
      console.log(`\nOriginal:\n"${sample}"`);
      console.log(`\nShortened:\n"${body.data.paraphrasedText}"\n`);
      passed++;
    } else {
      console.error(`❌ Failed: Status ${res.status}`, body);
      failed++;
    }
  }

  // Summary
  console.log("==========================================================");
  console.log(`Tests Completed: ${passed} passed, ${failed} failed`);
  console.log("==========================================================");

  if (failed > 0) process.exit(1);
}

runParaphraseTests().catch((err) => {
  console.error("Test runner encountered error:", err);
  process.exit(1);
});
