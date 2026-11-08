import type { Metadata } from "next";
import { SEO_TOOLS_CONFIG } from "@/lib/seo-data";
import { buildToolMetadata } from "@/lib/seo-utils";
import { WorkspaceEditor } from "@/components/workspace/workspace-editor";
import { ToolSeoSection } from "@/components/tools/ToolSeoSection";

const config = SEO_TOOLS_CONFIG["ai-humanizer"];

export function generateMetadata(): Metadata {
  return buildToolMetadata(config);
}

export default function AiHumanizerPage() {
  return (
    <>
      <WorkspaceEditor service="humanizer" />
      <ToolSeoSection config={config} />
    </>
  );
}
