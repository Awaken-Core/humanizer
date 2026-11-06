import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.NEXT_PUBLIC_APP_BASE_URL.endsWith("/")
    ? env.NEXT_PUBLIC_APP_BASE_URL.slice(0, -1)
    : env.NEXT_PUBLIC_APP_BASE_URL;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/board/"],
      },
      {
        userAgent: ["GPTBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "anthropic-ai", "Applebot-Extended"],
        allow: ["/", "/how-it-works", "/faq", "/about", "/compare/", "/privacy", "/terms", "/llms.txt"],
        disallow: ["/api/", "/board/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

