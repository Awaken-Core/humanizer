import {
  FileCheck2,
  Fingerprint,
  Languages,
  ListFilter,
  ScanText,
  ShieldCheck,
} from "lucide-react";

export const tools = [
  {
    name: "AI Humanizer",
    short: "Humanize",
    href: "/ai-humanizer",
    icon: Fingerprint,
    description:
      "Turn mechanical drafts into natural writing. Keep your meaning. Find your voice.",
    detail: "Natural rhythm. Your original meaning.",
    live: true,
  },
  {
    name: "AI Content Detector",
    short: "Detect",
    href: "/ai-detector",
    icon: ScanText,
    description:
      "Explore signals of AI-generated writing and understand where a draft needs a human touch.",
    detail: "A closer look at how your content reads.",
    live: true,
  },
  {
    name: "Summarizer",
    short: "Summarize",
    href: "/summarizer",
    icon: ListFilter,
    description:
      "Find the essential ideas in a long document, then make every sentence work harder.",
    detail: "Less noise. More meaning.",
    live: true,
  },
  {
    name: "Plagiarism Detector",
    short: "Check originality",
    href: "/plagiarism-checker",
    icon: ShieldCheck,
    description:
      "Review potential overlaps and give original ideas the attention and attribution they deserve.",
    detail: "Make originality part of your process.",
    live: true,
  },
  {
    name: "Grammar & Accuracy",
    short: "Refine",
    href: "/grammar-checker",
    icon: FileCheck2,
    description:
      "Catch awkward phrasing, sharpen your grammar, and review claims before you hit publish.",
    detail: "Small improvements. A stronger impression.",
    live: true,
  },
  {
    name: "AI Paraphraser",
    short: "Paraphrase",
    href: "/paraphraser",
    icon: Languages,
    description:
      "Explore a fresh way to say it. Adjust your tone and structure without losing the point.",
    detail: "A different expression. The same intention.",
    live: true,
  },
];
