/**
 * Built-in server-side content screening rules.
 * Keep in sync with supabase/functions/_shared/moderationRules.ts
 */

/** @typedef {'approved' | 'rejected'} ModerationDecision */

export const CAPTION_MAX_LENGTH = 500;
export const COMMENT_MAX_LENGTH = 500;
export const LOCATION_MAX_LENGTH = 200;

/** Obvious prohibited terms / phrases (word-boundary matched where possible). */
const PROHIBITED_TERMS = [
  'kill yourself',
  'kys',
  'nigger',
  'faggot',
  'child porn',
  'csam',
  'rape you',
];

/** Spam-like patterns */
const SPAM_PATTERNS = [
  /(.)\1{12,}/i,
  /https?:\/\/\S+/gi,
  /\b(buy now|crypto giveaway|free money|onlyfans)\b/i,
];

/**
 * @param {string} text
 * @returns {{ decision: ModerationDecision, reason?: string }}
 */
export function screenTextWithRules(text) {
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return { decision: 'approved' };
  }

  for (const term of PROHIBITED_TERMS) {
    if (normalized.includes(term)) {
      return { decision: 'rejected', reason: 'prohibited_term' };
    }
  }

  for (const pattern of SPAM_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(normalized)) {
      return { decision: 'rejected', reason: 'spam_pattern' };
    }
  }

  return { decision: 'approved' };
}

/**
 * Optional external provider hook (client never calls this with secrets).
 * @param {string} _text
 * @param {{ apiKey?: string, endpoint?: string } | null} provider
 * @returns {Promise<{ decision: ModerationDecision, reason?: string }>}
 */
export async function screenWithExternalProvider(_text, provider) {
  if (!provider?.apiKey || !provider?.endpoint) {
    return { decision: 'approved' };
  }
  // Placeholder: when configured in Edge Function secrets, call the provider there.
  return { decision: 'approved' };
}
