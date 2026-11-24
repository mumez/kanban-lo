/**
 * http(s) URL from a free-form string, safe to open in a new tab. Blank values
 * and any other scheme (including `javascript:`) are not openable.
 */
export function openableHttpUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  return url.href;
}
