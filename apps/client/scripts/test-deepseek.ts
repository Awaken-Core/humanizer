import dotenv from "dotenv";
import path from "path";

// Allow testing DeepSeek client without full application database/auth env vars
process.env.SKIP_ENV_VALIDATION = "1";

// Load environment variables from apps/client/.env.local, .env, or root .env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function runTest() {
  console.log("=========================================");
  console.log("   DeepSeek Client Connectivity Test     ");
  console.log("=========================================\n");

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

  if (!apiKey) {
    console.error("❌ FAILED: DEEPSEEK_API_KEY is not set.");
    console.info("\nHow to configure:");
    console.info("1. Create or open 'apps/client/.env.local'");
    console.info("2. Add your DeepSeek API key:");
    console.info("   DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx");
    console.info("   DEEPSEEK_MODEL=deepseek-chat");
    console.info("   DEEPSEEK_BASE_URL=https://api.deepseek.com");
    console.info("3. Re-run: bun run test:deepseek\n");
    process.exit(1);
  }

  console.log(`Configured Base URL: ${baseURL}`);
  console.log(`Configured Model:    ${model}`);
  console.log("API Key Status:      [Configured - Hidden]\n");

  try {
    const { getDeepSeekClient } = await import("../src/lib/ai/deepseek.client");
    const client = getDeepSeekClient({ timeoutMs: 15_000, maxRetries: 1 });

    console.log("Sending test ping chat completion...");
    const startTime = Date.now();

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: "Respond with the single word 'OK' if you receive this message.",
        },
      ],
      max_tokens: 10,
      stream: false,
    });

    const elapsed = Date.now() - startTime;
    const reply = response.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      console.error(`❌ FAILED: Received empty response choice from DeepSeek API (${elapsed}ms).`);
      process.exit(1);
    }

    console.log(`\n✅ SUCCESS: Connected to DeepSeek API in ${elapsed}ms!`);
    console.log(`Response text: "${reply}"`);
    console.log(`Model returned: ${response.model}`);
    console.log(`Prompt tokens: ${response.usage?.prompt_tokens ?? 0}, Completion tokens: ${response.usage?.completion_tokens ?? 0}\n`);
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ FAILED: Error communicating with DeepSeek API.");
    if (error?.status) {
      console.error(`HTTP Status: ${error.status}`);
    }
    console.error(`Error message: ${error?.message || error}`);
    process.exit(1);
  }
}

runTest();
