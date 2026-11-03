export const Services = [
    "humanizer",
    "plagiarism-checker",
    "ai-detector",
    "paraphraser",
    "summarizer",
    "grammar-checker",
] as const;

export type Service = (typeof Services)[number];

export const ServiceLabels: Record<Service, string> = {
    humanizer: "Humanizer",
    "plagiarism-checker": "Plagiarism checker",
    "ai-detector": "AI detector",
    paraphraser: "Paraphraser",
    summarizer: "Summarizer",
    "grammar-checker": "Grammar checker",
};

export const ServiceActionLabels: Record<Service, string> = {
    humanizer: "Humanize",
    "plagiarism-checker": "Check plagiarism",
    "ai-detector": "Detect AI",
    paraphraser: "Paraphrase",
    summarizer: "Summarize",
    "grammar-checker": "Check grammar",
};
