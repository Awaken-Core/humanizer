/**
 * Dynamic resolution of the production base URL without hardcoded domains.
 */
export function getBaseUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

/**
 * Creates a fully-qualified canonical URL for a given relative path.
 */
export function getCanonicalUrl(relativePath: string): string {
  const base = getBaseUrl();
  const normalized = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${base}${normalized}`;
}

