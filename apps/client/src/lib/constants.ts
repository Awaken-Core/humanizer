import { TOOL_IDS, TOOL_REGISTRY, type ToolId } from "@/lib/tool-registry";

/** @deprecated Prefer TOOL_IDS and TOOL_REGISTRY from tool-registry. */
export const Services = TOOL_IDS;
export type Service = ToolId;

/** @deprecated Prefer getToolDefinition(service).label. */
export const ServiceLabels = Object.fromEntries(
  TOOL_IDS.map((id) => [id, TOOL_REGISTRY[id].label]),
) as Record<Service, string>;

/** @deprecated Prefer getToolDefinition(service).actionLabel. */
export const ServiceActionLabels = Object.fromEntries(
  TOOL_IDS.map((id) => [id, TOOL_REGISTRY[id].actionLabel]),
) as Record<Service, string>;
