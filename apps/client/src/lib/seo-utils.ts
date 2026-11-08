import type { Metadata } from "next";
import type { ToolSeoConfig } from "@/lib/seo-data";

/**
 * Dynamic resolution of the production base URL without hardcoded domains.
 */
export function getBaseUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

/**
 * Creates a fully-qualified canonical URL for a given relative path.
 */
export function getCanonicalUrl(relativePath: string): string {
  const base = getBaseUrl();
  const normalized = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${base}${normalized}`;
}

/**
 * Builds standard Open Graph, Twitter, and canonical metadata for dedicated AI tool routes.
 * Eliminates repetitive metadata boilerplate across all 6 tool pages.
 */
export function buildToolMetadata(config: ToolSeoConfig): Metadata {
  const canonicalUrl = getCanonicalUrl(config.slug);

  return {
    title: config.title,
    description: config.description,
    keywords: [config.primaryKeyword, ...config.secondaryKeywords],
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
      },
    },
    openGraph: {
      title: config.title,
      description: config.description,
      url: canonicalUrl,
      type: "website",
      siteName: "Humanizer",
    },
    twitter: {
      card: "summary_large_image",
      title: config.title,
      description: config.description,
    },
  };
}
