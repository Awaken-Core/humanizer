import { describe, it, expect } from "bun:test";
import { SEO_TOOLS_CONFIG, buildToolJsonLd } from "../src/lib/seo-data";
import { getBaseUrl, getCanonicalUrl } from "../src/lib/seo-utils";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";

describe("Phase 2: Dedicated SEO & URL Architecture Test Suite", () => {
  const expectedSlugs = [
    "ai-humanizer",
    "ai-detector",
    "paraphraser",
    "summarizer",
    "plagiarism-checker",
    "grammar-checker",
  ];

  // Test 1: All 6 Tools are Registered in SEO Config
  it("registers all six AI tools with valid metadata and zero unsupported claims", () => {
    for (const slug of expectedSlugs) {
      const config = SEO_TOOLS_CONFIG[slug];
      expect(config).toBeDefined();
      expect(config.slug).toBe(slug);
      expect(config.name.length).toBeGreaterThan(0);
      expect(config.title.length).toBeGreaterThan(15);
      expect(config.description.length).toBeGreaterThan(30);
      expect(config.h1.length).toBeGreaterThan(10);
      expect(config.subtitle.length).toBeGreaterThan(20);
      expect(config.badge.length).toBeGreaterThan(0);
      expect(config.howItWorks.length).toBe(3);
      expect(config.features.length).toBe(4);
      expect(config.faqs.length).toBeGreaterThanOrEqual(4);

      // Verify no unsupported marketing/ranking claims in SEO copy
      const fullCopy = JSON.stringify(config).toLowerCase();
      expect(fullCopy).not.toContain("100% undetectable");
      expect(fullCopy).not.toContain("zero ai trace");
      expect(fullCopy).not.toContain("guaranteed rankings");
      expect(fullCopy).not.toContain("guaranteed rich results");
    }
  });

  // Test 2: Dynamic Canonical URL Generation
  it("resolves canonical URLs dynamically without hardcoded domains", () => {
    const baseUrl = getBaseUrl();
    expect(baseUrl).toBeDefined();
    expect(baseUrl).not.toContain("antigravity.ai"); // Assumed domain must not be hardcoded

    for (const slug of expectedSlugs) {
      const canonical = getCanonicalUrl(slug);
      expect(canonical).toBe(`${baseUrl}/${slug}`);
      expect(canonical).not.toContain("//" + slug); // No double slashes
    }
  });

  // Test 3: Structured Data Schema.org (JSON-LD) Validation
  it("generates valid SoftwareApplication, HowTo, and BreadcrumbList JSON-LD schemas", () => {
    for (const slug of expectedSlugs) {
      const config = SEO_TOOLS_CONFIG[slug];
      const jsonLd = buildToolJsonLd(config);

      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(Array.isArray(jsonLd["@graph"])).toBe(true);

      const graph = jsonLd["@graph"];
      const appSchema = graph.find((item: any) => item["@type"] === "SoftwareApplication");
      const howToSchema = graph.find((item: any) => item["@type"] === "HowTo");
      const breadcrumbSchema = graph.find((item: any) => item["@type"] === "BreadcrumbList");

      expect(appSchema).toBeDefined();
      expect(appSchema.name).toBe(config.name);
      expect(appSchema.url).toBe(getCanonicalUrl(slug));

      expect(howToSchema).toBeDefined();
      expect(howToSchema.step.length).toBe(3);

      expect(breadcrumbSchema).toBeDefined();
      expect(breadcrumbSchema.itemListElement.length).toBe(2);
    }
  });

  // Test 4: Sitemap Integrity
  it("includes all dedicated tool URLs, omits /workspace, and uses stable lastModified", () => {
    const siteMapEntries = sitemap();
    const urls = siteMapEntries.map((e) => e.url);

    // Verify all 6 dedicated tools are present in sitemap
    for (const slug of expectedSlugs) {
      expect(urls.some((u) => u.endsWith(`/${slug}`))).toBe(true);
    }

    // Verify private /workspace is omitted
    expect(urls.some((u) => u.endsWith("/workspace"))).toBe(false);

    // Verify stable lastModified timestamp is identical across all entries
    const dates = siteMapEntries.map((e) => e.lastModified?.toISOString());
    const uniqueDates = new Set(dates);
    expect(uniqueDates.size).toBe(1);
    expect(dates[0]).toBe("2026-11-08T00:00:00.000Z");

    // Verify no deprecated priority or changeFrequency properties
    for (const entry of siteMapEntries as any[]) {
      expect(entry.priority).toBeUndefined();
      expect(entry.changeFrequency).toBeUndefined();
    }
  });

  // Test 5: Robots.txt Rules & Crawl Security
  it("configures robots.txt to crawl dedicated pages and disallow private app routes", () => {
    const robotsConfig = robots();
    expect(robotsConfig.rules).toBeDefined();

    const rules = Array.isArray(robotsConfig.rules) ? robotsConfig.rules : [robotsConfig.rules];
    const defaultRule = rules.find((r) => r.userAgent === "*");

    expect(defaultRule).toBeDefined();
    expect(defaultRule?.allow).toBe("/");
    expect(defaultRule?.disallow).toContain("/workspace");
    expect(defaultRule?.disallow).toContain("/board/");
    expect(defaultRule?.disallow).toContain("/api/");

    expect(robotsConfig.sitemap).toContain("/sitemap.xml");
  });
});

