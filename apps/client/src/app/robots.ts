import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo-utils";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/board/", "/workspace"],
      },
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "PerplexityBot",
          "ClaudeBot",
          "anthropic-ai",
          "Applebot-Extended",
        ],
        allow: [
          "/",
          "/ai-humanizer",
          "/ai-detector",
          "/paraphraser",
          "/summarizer",
          "/plagiarism-checker",
          "/grammar-checker",
          "/how-it-works",
          "/faq",
          "/about",
          "/compare/",
          "/privacy",
          "/terms",
          "/llms.txt",
        ],
        disallow: ["/api/", "/board/", "/workspace"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
