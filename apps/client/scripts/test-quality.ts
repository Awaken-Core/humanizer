import dotenv from "dotenv";
import path from "path";

process.env.SKIP_ENV_VALIDATION = "1";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { humanizeText } from "../src/features/humanizer";

interface TestCase {
  title: string;
  input: string;
  mode?: "Natural" | "Academic" | "Professional" | "Casual";
  intensity?: "Low" | "Medium" | "High";
  verifyRules: (original: string, rewritten: string) => boolean | string;
}

const testCases: TestCase[] = [
  {
    title: "1. Existing Prompt Issue Case (No Unsupported Examples)",
    input:
      "In conclusion, it is of paramount importance to leverage artificial intelligence in order to optimize business productivity and facilitate synergies across multifaceted organizational paradigms.",
    mode: "Natural",
    intensity: "Medium",
    verifyRules: (_, rewritten) => {
      const lower = rewritten.toLowerCase();
      if (lower.includes("invoice") || lower.includes("ticket") || lower.includes("customer support")) {
        return "Failed: Output hallucinated unsupported examples (invoices/tickets).";
      }
      return true;
    },
  },
  {
    title: "2. Simple Sentences",
    input: "The dog barked at the cat. The cat ran up the tree. The dog waited below.",
    mode: "Casual",
    intensity: "Low",
    verifyRules: (_, rewritten) => {
      const lower = rewritten.toLowerCase();
      if (!lower.includes("dog") || !lower.includes("cat") || !lower.includes("tree")) {
        return "Failed: Lost core subjects or actions.";
      }
      return true;
    },
  },
  {
    title: "3. Academic Paragraph with Formal Rigor",
    input:
      "Empirical investigations substantiate the hypothesis that anthropogenic carbon emissions exacerbate global climatological destabilization. Consequently, mitigation frameworks must prioritize renewable infrastructure.",
    mode: "Academic",
    intensity: "Medium",
    verifyRules: (_, rewritten) => {
      const lower = rewritten.toLowerCase();
      if (!lower.includes("carbon") || !lower.includes("renewable")) {
        return "Failed: Lost primary academic topics.";
      }
      return true;
    },
  },
  {
    title: "4. Technical Content & Code Blocks",
    input:
      "To initialize the cache, call `redis.connect()`. Ensure you export the singleton instance:\n```typescript\nconst client = new Redis(process.env.REDIS_URL);\nexport default client;\n```\nNever expose the connection string in client-side bundles.",
    mode: "Professional",
    intensity: "High",
    verifyRules: (original, rewritten) => {
      if (!rewritten.includes("```typescript") || !rewritten.includes("const client = new Redis(process.env.REDIS_URL);")) {
        return "Failed: Code block was modified or removed.";
      }
      if (!rewritten.includes("`redis.connect()`")) {
        return "Failed: Inline code was altered.";
      }
      return true;
    },
  },
  {
    title: "5. Numbers, Statistics and Dates",
    input:
      "In Q3 2024, our revenue increased by 14.8% to $4.2 million, whereas operating expenses decreased by 3.1% on October 15.",
    mode: "Professional",
    intensity: "Medium",
    verifyRules: (_, rewritten) => {
      const numbers = ["14.8%", "$4.2 million", "3.1%", "October 15", "Q3 2024"];
      for (const num of numbers) {
        if (!rewritten.includes(num)) {
          return `Failed: Missing precise number or date "${num}".`;
        }
      }
      return true;
    },
  },
  {
    title: "6. Text Containing URLs and Citations",
    input:
      "According to Smith et al. (2021, p. 45), neural scaling laws exhibit predictable power-law exponents. Detailed benchmark data is accessible at https://arxiv.org/abs/2001.08361.",
    mode: "Academic",
    intensity: "High",
    verifyRules: (_, rewritten) => {
      if (!rewritten.includes("https://arxiv.org/abs/2001.08361")) {
        return "Failed: URL was removed or modified.";
      }
      if (!rewritten.includes("Smith et al. (2021") && !rewritten.includes("Smith et al.")) {
        return "Failed: Academic citation was omitted.";
      }
      return true;
    },
  },
  {
    title: "7. Markdown Headings and Lists",
    input:
      "### Project Objectives\n\n* Enhance user experience across mobile endpoints\n* Decrease average response latency to sub-100ms\n* Maintain 99.99% service availability\n\nEach requirement is non-negotiable.",
    mode: "Natural",
    intensity: "Medium",
    verifyRules: (_, rewritten) => {
      if (!rewritten.includes("#") && !rewritten.toLowerCase().includes("project objectives")) {
        return "Failed: Heading was eliminated.";
      }
      if (!rewritten.includes("100ms") || !rewritten.includes("99.99%")) {
        return "Failed: Key technical constraints modified.";
      }
      return true;
    },
  },
  {
    title: "8. Content with Ambiguous or Abstract Meaning (No Invented Details)",
    input:
      "The system might or might not resolve the ambiguity when the condition triggers.",
    mode: "Natural",
    intensity: "High",
    verifyRules: (_, rewritten) => {
      const lower = rewritten.toLowerCase();
      // Ensure it didn't invent what "the system" or "the condition" is
      if (lower.includes("database") || lower.includes("server") || lower.includes("timeout") || lower.includes("error code")) {
        return "Failed: Hallucinated concrete details for an intentionally ambiguous sentence.";
      }
      return true;
    },
  },
];

async function runQualityTests() {
  console.log("==================================================");
  console.log("   Humanizer Quality & Invariant Test Suite       ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    console.log(`Running: ${tc.title}`);
    console.log(`[Mode: ${tc.mode || "Natural"} | Intensity: ${tc.intensity || "Medium"}]`);

    try {
      const res = await humanizeText({
        text: tc.input,
        mode: tc.mode,
        intensity: tc.intensity,
      });

      console.log(`--- Original ---\n${tc.input}`);
      console.log(`--- Rewritten ---\n${res.humanizedText}`);

      const ruleResult = tc.verifyRules(tc.input, res.humanizedText);

      if (ruleResult === true) {
        console.log("✅ Passed Verification\n");
        passed++;
      } else {
        console.error(`❌ Verification Error: ${ruleResult}\n`);
        failed++;
      }
    } catch (err: any) {
      console.error(`❌ Test failed with exception: ${err.message}\n`);
      failed++;
    }
  }

  console.log("==================================================");
  console.log(`Tests Complete: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runQualityTests();

