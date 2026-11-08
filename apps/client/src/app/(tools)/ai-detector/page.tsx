import type { Metadata } from "next";
import { SEO_TOOLS_CONFIG } from "@/lib/seo-data";
import { buildToolMetadata } from "@/lib/seo-utils";
import { WorkspaceEditor } from "@/components/workspace/workspace-editor";
import { ToolSeoSection } from "@/components/tools/ToolSeoSection";

const config = SEO_TOOLS_CONFIG["ai-detector"];

export function generateMetadata(): Metadata {
  return buildToolMetadata(config);
}

export default function AiDetectorPage() {
  return (
    <>
      <WorkspaceEditor service="ai-detector" />
      <ToolSeoSection config={config} />
    </>
  );
}
