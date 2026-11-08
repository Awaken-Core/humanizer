import { redirect } from "next/navigation";

const SERVICE_TO_PATH: Record<string, string> = {
  humanizer: "/ai-humanizer",
  "ai-humanizer": "/ai-humanizer",
  "ai-detector": "/ai-detector",
  paraphraser: "/paraphraser",
  summarizer: "/summarizer",
  "plagiarism-checker": "/plagiarism-checker",
  "grammar-checker": "/grammar-checker",
};

export default async function WorkspaceRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<{
    service?: string;
    [key: string]: string | string[] | undefined;
  }>;
}) {
  const params = searchParams ? await searchParams : {};
  const service =
    typeof params?.service === "string" ? params.service : undefined;
  const target = (service && SERVICE_TO_PATH[service]) || "/ai-humanizer";
  redirect(target);
}
