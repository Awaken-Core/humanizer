import type { Metadata } from "next";
import { SEO_TOOLS_CONFIG } from "@/lib/seo-data";
import { getCanonicalUrl } from "@/lib/seo-utils";
import { WorkspaceEditor } from "@/components/workspace/workspace-editor";
import { ToolSeoSection } from "@/components/tools/ToolSeoSection";

const config = SEO_TOOLS_CONFIG["summarizer"];

export async function generateMetadata(): Promise<Metadata> {
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

export default function SummarizerPage() {
  return (
    <>
      <WorkspaceEditor service="summarizer" />
      <ToolSeoSection config={config} />
    </>
  );
}

