/**
 * Sanitizes a URL to prevent javascript: protocol XSS.
 * Returns the URL if it starts with http/https, otherwise returns "#".
 */
export function safeUrl(url: string | null | undefined): string {
  if (!url) return "#";
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return url;
  }
  return "#";
}
