import type { ToolId } from "./tool-registry";
import { getCanonicalUrl } from "./seo-utils";

export interface ToolFaq {
  question: string;
  answer: string;
}

export interface HowItWorksStep {
  step: number;
  title: string;
  description: string;
}

export interface ToolFeature {
  title: string;
  description: string;
}

export interface ToolSeoConfig {
  slug: string;
  service: ToolId;
  name: string;
  title: string;
  description: string;
  h1: string;
  subtitle: string;
  badge: string;
  howItWorks: HowItWorksStep[];
  features: ToolFeature[];
  faqs: ToolFaq[];
  primaryKeyword: string;
  secondaryKeywords: string[];
}

export const SEO_TOOLS_CONFIG: Record<string, ToolSeoConfig> = {
  "ai-humanizer": {
    slug: "ai-humanizer",
    service: "humanizer",
    name: "AI Humanizer",
    primaryKeyword: "humanize ai text",
    secondaryKeywords: ["ai text humanizer", "make ai text sound human", "rewrite ai text", "natural writing ai"],
    title: "AI Humanizer — Rewrite AI Text to Sound Natural & Fluent",
    description: "Refine AI-generated text into clear, natural human writing. Adjust tone, sentence variety, and flow with customizable writing modes.",
    h1: "Transform AI Text into Natural, Fluent Writing",
    subtitle: "Overcome robotic repetition, predictable sentence lengths, and rigid structure with intelligent stylistic humanization.",
    badge: "Voice & Rhythm Refinement",
    howItWorks: [
      {
        step: 1,
        title: "Paste or Draft Your Text",
        description: "Enter your draft or AI-generated prose directly into the editor. Up to 800 characters free without an account.",
      },
      {
        step: 2,
        title: "Choose Mode & Intensity",
        description: "Select from Natural, Academic, Professional, or Casual modes, and choose Low, Medium, or High intensity to match your context.",
      },
      {
        step: 3,
        title: "Generate & Refine",
        description: "Receive a fluent rewrite with varied sentence lengths, natural discourse flow, and preserved original meaning.",
      },
    ],
    features: [
      {
        title: "Multiple Stylistic Modes",
        description: "Choose Natural, Academic, Professional, or Casual modes depending on your intended publication audience.",
      },
      {
        title: "Sentence Rhythm & Burstiness",
        description: "Breaks repetitive sentence length distributions typical of machine-generated prose into varied, engaging cadences.",
      },
      {
        title: "Sanitized Punctuation",
        description: "Replaces excessive AI-style em-dashes and mechanical conjunctions with natural human punctuation.",
      },
      {
        title: "Non-Destructive Editing",
        description: "Your original draft is never lost. Easily compare original and revised versions side by side.",
      },
    ],
    faqs: [
      {
        question: "What does the AI Humanizer do?",
        answer: "The AI Humanizer analyzes input text for uniform sentence structures, repetitive phrasing, and machine markers, then rewrites it to sound more conversational, varied, and authentic while keeping your core message intact.",
      },
      {
        question: "Does this change the factual meaning of my writing?",
        answer: "No. The system is instructed to maintain your original thesis, arguments, and factual statements while improving phrasing, vocabulary variety, and syntactic rhythm.",
      },
      {
        question: "What modes are available?",
        answer: "You can select Natural (balanced every-day tone), Academic (scholarly clarity with formal vocabulary), Professional (business-ready prose), or Casual (friendly, relaxed expression).",
      },
      {
        question: "Can I use the tool without creating an account?",
        answer: "Yes, you can run transformations on short texts anonymously. Signing in unlocks higher character limits and document management boards.",
      },
    ],
  },

  "ai-detector": {
    slug: "ai-detector",
    service: "ai-detector",
    name: "AI Detector",
    primaryKeyword: "free ai detector",
    secondaryKeywords: ["ai content detector", "check ai text", "perplexity checker", "ai writing analyzer"],
    title: "Free AI Content Detector — Statistical Text Pattern Analysis",
    description: "Analyze text for statistical markers of AI-generated content using perplexity, burstiness, and sentence predictability heuristics.",
    h1: "Inspect Writing for Statistical AI Markers",
    subtitle: "Fast, deterministic linguistic analysis evaluating perplexity, sentence structure entropy, and repetitive syntactic patterns.",
    badge: "Heuristic Pattern Analysis",
    howItWorks: [
      {
        step: 1,
        title: "Provide Text",
        description: "Paste a minimum of 50 characters to ensure sufficient sample size for statistical pattern analysis.",
      },
      {
        step: 2,
        title: "Automated Inspection",
        description: "The engine parses vocabulary distributions, ngram repetition, and sentence length variance instantly.",
      },
      {
        step: 3,
        title: "Review Results",
        description: "Examine overall AI probability score alongside sentence-level breakdowns and pattern highlights.",
      },
    ],
    features: [
      {
        title: "Perplexity & Burstiness Metrics",
        description: "Evaluates word choice predictability alongside the rhythm and variance of consecutive sentence lengths.",
      },
      {
        title: "Deterministic Scoring Engine",
        description: "Runs fast local heuristics without routing your private draft to third-party language models for scoring.",
      },
      {
        title: "Sentence-Level Highlights",
        description: "Identifies individual sentences that exhibit high predictability or rigid syntactic repetition.",
      },
      {
        title: "Private Analysis & Security",
        description: "Your text is analyzed in isolated runtime workers and never indexed into public training datasets.",
      },
    ],
    faqs: [
      {
        question: "How does this AI detector work?",
        answer: "The tool analyzes statistical properties of writing including perplexity (how expected words are) and burstiness (how much sentence structure and length vary throughout the text).",
      },
      {
        question: "Are AI detectors 100% accurate?",
        answer: "No AI detector is infallible. False positives can occur on structured human writing, and false negatives can occur on edited machine text. These scores should be used as guidance rather than definitive proof.",
      },
      {
        question: "Why is there a 50-character minimum?",
        answer: "Statistical analysis requires sufficient text to calculate reliable variance in vocabulary and sentence structures.",
      },
      {
        question: "Does the AI detector store my text?",
        answer: "Submissions are recorded temporarily to manage your session job history and rate limits in accordance with our privacy policy, but your content is never sold, shared with third parties, or used to train public AI models.",
      },
    ],
  },

  paraphraser: {
    slug: "paraphraser",
    service: "paraphraser",
    name: "AI Paraphraser",
    primaryKeyword: "ai paraphraser",
    secondaryKeywords: ["paraphrasing tool", "rewrite sentences", "sentence rephraser", "paraphrase tool online"],
    title: "AI Paraphraser — Rephrase Text with Tone & Focus Controls",
    description: "Rephrase sentences, essays, and articles with precision. Choose from Standard, Formal, Creative, Shorten, or Expand tones.",
    h1: "Rephrase Text with Tone & Structural Focus",
    subtitle: "Rewrite any passage while adjusting stylistic register, enhancing vocabulary, or condensing long paragraphs.",
    badge: "Tone & Focus Customization",
    howItWorks: [
      {
        step: 1,
        title: "Enter Source Text",
        description: "Paste sentences, paragraphs, or essays you wish to rephrase into the input area.",
      },
      {
        step: 2,
        title: "Select Tone & Focus",
        description: "Choose your tone (Standard, Formal, Creative, Shorten, Expand) and focus (Vocabulary, Structure, or Both).",
      },
      {
        step: 3,
        title: "Copy or Refine",
        description: "Review the rephrased output, copy it with a single click, or re-run with different parameters.",
      },
    ],
    features: [
      {
        title: "5 Expressive Tones",
        description: "Tailor output across Standard, Formal, Creative, Shorten, and Expand presets.",
      },
      {
        title: "Vocabulary vs Structure Focus",
        description: "Decide whether to substitute synonyms, restructure clauses, or apply both simultaneously.",
      },
      {
        title: "Meaning Preservation",
        description: "Engineered prompts protect the underlying argument and key terminology of your original draft.",
      },
      {
        title: "Instant One-Click Copy",
        description: "Quickly transfer your refined text back into your document editor or writing workflow.",
      },
    ],
    faqs: [
      {
        question: "What is the difference between tones?",
        answer: "Standard balances clarity and natural flow; Formal adopts scholarly vocabulary; Creative explores vibrant phrasing; Shorten removes redundant words; and Expand elaborates on key points.",
      },
      {
        question: "What does the 'Focus' option do?",
        answer: "'Vocabulary' preserves your sentence clauses while finding stronger words. 'Structure' rearranges sentences. 'Both' combines vocabulary enhancement with structural reorganization.",
      },
      {
        question: "Is this tool suitable for academic writing?",
        answer: "Yes, using the Formal tone and Vocabulary focus allows researchers and students to improve the clarity of their writing without altering academic rigor.",
      },
      {
        question: "Can I undo or retry if I want a different variation?",
        answer: "Yes, click 'Try Again' or re-click 'Paraphrase' with altered tone settings to generate a fresh variation.",
      },
    ],
  },

  summarizer: {
    slug: "summarizer",
    service: "summarizer",
    name: "AI Summarizer",
    primaryKeyword: "ai text summarizer",
    secondaryKeywords: ["summarize text online", "article summarizer", "condense text ai", "tldr generator"],
    title: "AI Text Summarizer — Condense Long Articles & Documents",
    description: "Extract essential ideas and condense lengthy writing into concise overviews with adjustable mode and intensity controls.",
    h1: "Condense Long Articles into Essential Ideas",
    subtitle: "Save hours of reading by synthesizing comprehensive reports, essays, and articles into focused overviews.",
    badge: "Executive Synthesis",
    howItWorks: [
      {
        step: 1,
        title: "Paste Your Document",
        description: "Input long articles, research papers, reports, or meeting notes into the text pane.",
      },
      {
        step: 2,
        title: "Configure Condensation",
        description: "Select mode (Natural, Academic, Professional, Casual) and condensation intensity (Low, Medium, High).",
      },
      {
        step: 3,
        title: "Read Key Insights",
        description: "Receive a clear summary preserving critical claims, findings, and actionable conclusions.",
      },
    ],
    features: [
      {
        title: "Intensity-Based Condensation",
        description: "Choose Low (light trim), Medium (balanced core points), or High (concise executive overview).",
      },
      {
        title: "Context-Aware Summaries",
        description: "Retains numbers, dates, findings, and proper nouns so vital information is never omitted.",
      },
      {
        title: "Multiple Voice Registers",
        description: "Adapt the output to fit executive briefs, academic notes, or casual reading digests.",
      },
      {
        title: "Fast Generation",
        description: "Processes lengthy prose in seconds, significantly accelerating research and reading workflows.",
      },
    ],
    faqs: [
      {
        question: "How does the intensity setting affect the summary?",
        answer: "Low intensity creates a thorough summary keeping supporting evidence; Medium provides balanced key arguments; High produces a concise summary with only core takeaways.",
      },
      {
        question: "Will the summary miss crucial data points?",
        answer: "The model is tuned to preserve quantitative data, key names, and decisive conclusions so you get an accurate representation of the original text.",
      },
      {
        question: "What types of content can I summarize?",
        answer: "You can summarize articles, book chapters, essays, legal summaries, blog posts, and lecture transcripts.",
      },
      {
        question: "Is there a limit on how much I can summarize?",
        answer: "Anonymous visitors can summarize up to 800 characters per run. Free registered accounts can process up to 15,000 characters per request.",
      },
    ],
  },

  "plagiarism-checker": {
    slug: "plagiarism-checker",
    service: "plagiarism-checker",
    name: "Plagiarism Checker",
    primaryKeyword: "free plagiarism checker",
    secondaryKeywords: ["check plagiarism online", "originality scanner", "plagiarism detection", "duplicate text finder"],
    title: "Plagiarism Checker — Check Text for Attribution & Source Matches",
    description: "Inspect text for matching sources and attribution risks with shingle fingerprinting and exclusion filters for quotes and citations.",
    h1: "Scan Text for Source Matches & Attribution Risks",
    subtitle: "Identify overlapping phrases, calculate originality metrics, and verify proper citation before publication.",
    badge: "Attribution & Originality Scanner",
    howItWorks: [
      {
        step: 1,
        title: "Submit Written Work",
        description: "Paste your paper, essay, or blog post into the checker.",
      },
      {
        step: 2,
        title: "Configure Exclusion Filters",
        description: "Optionally exclude direct quotes, bibliographies, and common references to prevent false positives.",
      },
      {
        step: 3,
        title: "Review Similarity Report",
        description: "Inspect overall similarity percentages, identical matches, and identified web candidate domains.",
      },
    ],
    features: [
      {
        title: "Smart Exclusion Filters",
        description: "Automatically identify and ignore properly formatted quotation marks and bibliographic entries.",
      },
      {
        title: "Shingle Fingerprint Analysis",
        description: "Combines ngram shingling and cosine similarity to detect both verbatim copying and paraphrased overlap.",
      },
      {
        title: "Source Attribution Breakdown",
        description: "Displays candidate web domains alongside match word counts and direct URL links.",
      },
      {
        title: "Automated Fallback Summary",
        description: "Guarantees a clean analytical summary even when external web search services experience temporary latency.",
      },
    ],
    faqs: [
      {
        question: "What counts as a plagiarism match?",
        answer: "The scanner looks for identical word sequences (verbatim copying) as well as close paraphrasing where sentence structures match existing online publications.",
      },
      {
        question: "Can I exclude quotes and references?",
        answer: "Yes, you can toggle exclusion for quoted passages and bibliographic lists to avoid inflating similarity scores.",
      },
      {
        question: "What is an acceptable similarity score?",
        answer: "Scores under 15% generally represent standard idioms and terminology. Scores above 30% usually suggest sections that need revised paraphrasing and formal citations.",
      },
      {
        question: "Do you store or sell submitted manuscripts?",
        answer: "No. Your submissions are processed strictly for the requested report and are not added to commercial essay banks.",
      },
    ],
  },

  "grammar-checker": {
    slug: "grammar-checker",
    service: "grammar-checker",
    name: "Grammar Checker",
    primaryKeyword: "ai grammar checker",
    secondaryKeywords: ["free grammar check", "spelling and punctuation checker", "sentence corrector", "fix grammar errors"],
    title: "AI Grammar Checker — Real-Time Spelling, Punctuation & Style Fixes",
    description: "Detect and fix typos, punctuation mistakes, and awkward phrasing with hybrid deterministic rules and AI-powered context checking.",
    h1: "Fix Grammar, Spelling, and Punctuation Mistakes",
    subtitle: "Eliminate embarrassing errors and enhance sentence polish with hybrid mechanical and contextual corrections.",
    badge: "Spelling, Syntax & Polish",
    howItWorks: [
      {
        step: 1,
        title: "Paste Your Draft",
        description: "Enter any sentence, paragraph, or document into the editor.",
      },
      {
        step: 2,
        title: "Instant Hybrid Scan",
        description: "The engine runs deterministic punctuation checks combined with context-aware language inspection.",
      },
      {
        step: 3,
        title: "Review & Apply Fixes",
        description: "View highlighted issues categorized by punctuation, spelling, and grammar, and copy the polished text.",
      },
    ],
    features: [
      {
        title: "Hybrid Correction Engine",
        description: "Blends instant deterministic regex rules for punctuation with AI-driven contextual grammar assistance.",
      },
      {
        title: "Graceful Fallback Protection",
        description: "If network latency affects the LLM, deterministic mechanical rules still return accurate punctuation corrections.",
      },
      {
        title: "Categorized Issue Highlights",
        description: "Clearly separates punctuation spacing, word repetition, spelling errors, and syntactic agreements.",
      },
      {
        title: "Readability Scoring",
        description: "Provides an overall text quality score (0-100) reflecting the mechanical polish of the submitted writing.",
      },
    ],
    faqs: [
      {
        question: "What types of errors does the tool catch?",
        answer: "It identifies misspelled words, repeated adjacent words, misplaced commas, spacing errors before punctuation marks, subject-verb disagreements, and awkward phrasing.",
      },
      {
        question: "How does the hybrid system work?",
        answer: "Common mechanical issues (like double spaces or space-before-comma) are corrected instantly with deterministic rules, while stylistic and nuanced grammatical issues are analyzed via language models.",
      },
      {
        question: "Can I copy the corrected text with one click?",
        answer: "Yes, click the 'Copy' button in the output pane to copy the completely corrected text directly to your clipboard.",
      },
      {
        question: "Does it support non-English text?",
        answer: "The primary optimization is for English (academic, business, and general prose), though common mechanical punctuation rules apply generally.",
      },
    ],
  },
};

/**
 * Builds Schema.org JSON-LD structured data for a tool page.
 */
export function buildToolJsonLd(config: ToolSeoConfig) {
  const canonicalUrl = getCanonicalUrl(config.slug);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": config.name,
        "operatingSystem": "All",
        "applicationCategory": "UtilitiesApplication",
        "url": canonicalUrl,
        "description": config.description,
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
        },
      },
      {
        "@type": "HowTo",
        "name": `How to use ${config.name}`,
        "description": `Step-by-step guide to using ${config.name} online.`,
        "step": config.howItWorks.map((step) => ({
          "@type": "HowToStep",
          "position": step.step,
          "name": step.title,
          "text": step.description,
        })),
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": getCanonicalUrl("/"),
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": config.name,
            "item": canonicalUrl,
          },
        ],
      },
    ],
  };
}

