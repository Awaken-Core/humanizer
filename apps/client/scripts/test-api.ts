import { NextRequest } from "next/server";
import dotenv from "dotenv";
import path from "path";

process.env.SKIP_ENV_VALIDATION = "1";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { POST } from "../src/app/api/v1/humanize/route";

async function runApiTests() {
  console.log("==================================================");
  console.log("   Humanizer API Endpoint (/api/humanize) Tests   ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Unsupported Content-Type
  console.log("Test 1: Content-Type validation (reject text/plain)...");
  {
    const req = new NextRequest("http://localhost:3000/api/humanize", {
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

  // Test 2: Invalid JSON body
  console.log("Test 2: Malformed JSON validation...");
  {
    const req = new NextRequest("http://localhost:3000/api/humanize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json }",
    });
    const res = await POST(req);
    const body = await res.json();
    if (res.status === 400 && body.error?.code === "INVALID_JSON") {
      console.log("✅ Passed (Status 400, INVALID_JSON)\n");
      passed++;
    } else {
      console.error(`❌ Failed: Status ${res.status}`, body);
      failed++;
    }
  }

  // Test 3: Empty string text
  console.log("Test 3: Empty string validation...");
  {
    const req = new NextRequest("http://localhost:3000/api/humanize", {
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

  // Test 4: Payload too large
  console.log("Test 4: Payload too large validation (> 15,000 chars)...");
  {
    const hugeText = "a".repeat(16_000);
    const req = new NextRequest("http://localhost:3000/api/humanize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: hugeText }),
    });
    const res = await POST(req);
    const body = await res.json();
    if (res.status === 413 && body.error?.code === "PAYLOAD_TOO_LARGE") {
      console.log("✅ Passed (Status 413, PAYLOAD_TOO_LARGE)\n");
      passed++;
    } else {
      console.error(`❌ Failed: Status ${res.status}`, body);
      failed++;
    }
  }

  // Test 5: Invalid mode
  console.log("Test 5: Invalid mode validation...");
  {
    const req = new NextRequest("http://localhost:3000/api/humanize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "valid text", mode: "alien_language" }),
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

  // Test 6: Valid request end-to-end
  console.log("Test 6: Valid request execution (lowercase mode & intensity)...");
  {
    const req = new NextRequest("http://localhost:3000/api/humanize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "The artificial intelligence system generated remarkable improvements across operational workflows.",
        mode: "natural",
        intensity: "medium",
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    if (
      res.status === 200 &&
      body.success === true &&
      body.data?.humanizedText &&
      body.data?.selectedMode === "natural" &&
      body.data?.selectedIntensity === "medium" &&
      body.data?.processingMetadata?.duration > 0
    ) {
      console.log("✅ Passed (Status 200, valid response structure)");
      console.log(`Original:  "${body.data.originalText}"`);
      console.log(`Humanized: "${body.data.humanizedText}"`);
      console.log(`Duration:  ${body.data.processingMetadata.duration}ms\n`);
      passed++;
    } else {
      console.error(`❌ Failed: Status ${res.status}`, body);
      failed++;
    }
  }

  console.log("==================================================");
  console.log(`API Tests Complete: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runApiTests();

