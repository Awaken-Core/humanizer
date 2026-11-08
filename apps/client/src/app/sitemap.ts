import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo-utils";

// Stable content release timestamp to avoid spurious sitemap changes on every invocation
const STABLE_CONTENT_RELEASE_DATE = new Date("2026-11-08T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();

  // Includes only canonical URLs that serve content directly (no redirects)
  const publicPaths = [
    "",
    "/ai-humanizer",
    "/ai-detector",
    "/paraphraser",
    "/summarizer",
    "/plagiarism-checker",
    "/grammar-checker",
    "/how-it-works",
    "/faq",
    "/about",
    "/compare/quillbot-alternative",
    "/compare/stealthgpt-alternative",
    "/privacy",
    "/terms",
  ];

  return publicPaths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: STABLE_CONTENT_RELEASE_DATE,
  }));
}
