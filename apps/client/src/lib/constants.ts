export const Services = [
    "humanizer",
    "summarizer",
    "paraphraser",
    "grammar-checker",
    "plagiarism-checker",
] as const;

export type Service = (typeof Services)[number];

export const ServiceLabels: Record<Service, string> = {
    humanizer: "Humanizer",
    summarizer: "Summarizer",
    paraphraser: "Paraphraser",
    "grammar-checker": "Grammar checker",
    "plagiarism-checker": "Plagiarism checker",
};

export const ServiceActionLabels: Record<Service, string> = {
    humanizer: "Humanize",
    summarizer: "Summarize",
    paraphraser: "Paraphrase",
    "grammar-checker": "Check grammar",
    "plagiarism-checker": "Check plagiarism",
};
