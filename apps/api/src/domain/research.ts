import { isDryFact } from "./dry-facts";
import { cleanForSpeech } from "./story";

/** A story or trivia about a place found on the web, with the page it comes from. */
export type Finding = { text: string; url: string; title: string };

export const MAX_FINDINGS = 6;

/**
 * Reads the model's `{ findings: [{ text, url }] }`. A finding must come from a page the search
 * returned (`citations`); when the provider returned none, any http(s) page is kept.
 * Anything unusable or dry (`isDryFact`) is skipped, so the worst case is an empty list.
 */
export function parseResearchAnswer(
  raw: string,
  citations: readonly { url: string; title: string }[],
): Finding[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/^\s*```(?:json)?|```\s*$/g, ""));
  } catch {
    return [];
  }
  const list = (parsed as { findings?: unknown } | null)?.findings;
  if (!Array.isArray(list)) return [];

  const findings: Finding[] = [];
  for (const item of list) {
    const { text, url } = (item ?? {}) as { text?: unknown; url?: unknown };
    if (typeof text !== "string" || typeof url !== "string") continue;
    const clean = cleanForSpeech(text);
    const cited = citations.find((c) => sameUrl(c.url, url));
    if (!clean || (citations.length > 0 && !cited) || !/^https?:\/\//.test(url)) continue;
    // The search still brings office space and parking places; they are not a story.
    if (isDryFact(clean)) continue;
    findings.push({ text: clean, url: cited?.url ?? url, title: cited?.title ?? hostOf(url) });
    if (findings.length === MAX_FINDINGS) break;
  }
  return findings;
}

/** Models drop the trailing slash or the query string; the page is the same. */
function sameUrl(a: string, b: string) {
  const norm = (u: string) => u.replace(/[?#].*$/, "").replace(/\/+$/, "");
  return norm(a) === norm(b);
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
