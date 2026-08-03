/**
 * Built-in moderation rules for Edge Functions.
 * Keep in sync with src/services/moderationRules.js
 */

export const CAPTION_MAX_LENGTH = 500;
export const COMMENT_MAX_LENGTH = 500;
export const LOCATION_MAX_LENGTH = 200;

const PROHIBITED_TERMS = [
  "kill yourself",
  "kys",
  "nigger",
  "faggot",
  "child porn",
  "csam",
  "rape you",
];

const SPAM_PATTERNS = [
  /(.)\1{12,}/i,
  /https?:\/\/\S+/gi,
  /\b(buy now|crypto giveaway|free money|onlyfans)\b/i,
];

export type ModerationDecision = "approved" | "rejected";

export function screenTextWithRules(
  text: string,
): { decision: ModerationDecision; reason?: string } {
  const normalized = String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return { decision: "approved" };
  }

  for (const term of PROHIBITED_TERMS) {
    if (normalized.includes(term)) {
      return { decision: "rejected", reason: "prohibited_term" };
    }
  }

  for (const pattern of SPAM_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(normalized)) {
      return { decision: "rejected", reason: "spam_pattern" };
    }
  }

  return { decision: "approved" };
}

/**
 * Optional external moderation provider. Fail open when not configured.
 * Never log full private content.
 */
export async function screenWithExternalProvider(
  text: string,
  opts: { apiKey?: string; endpoint?: string } | null,
): Promise<{ decision: ModerationDecision; reason?: string }> {
  if (!opts?.apiKey || !opts?.endpoint) {
    return { decision: "approved" };
  }

  try {
    const res = await fetch(opts.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        text: text.slice(0, 2000),
        languages: ["en"],
      }),
    });

    if (!res.ok) {
      // Provider outage: do not block publishing beyond built-in rules
      return { decision: "approved" };
    }

    const data = await res.json();
    if (data?.flagged === true || data?.decision === "rejected") {
      return { decision: "rejected", reason: "external_provider" };
    }
    return { decision: "approved" };
  } catch {
    return { decision: "approved" };
  }
}

export async function screenContent(text: string): Promise<{
  decision: ModerationDecision;
  reason?: string;
}> {
  const local = screenTextWithRules(text);
  if (local.decision === "rejected") return local;

  return screenWithExternalProvider(text, {
    apiKey: Deno.env.get("MODERATION_API_KEY") ?? undefined,
    endpoint: Deno.env.get("MODERATION_API_ENDPOINT") ?? undefined,
  });
}
