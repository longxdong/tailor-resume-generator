/** Max words/chars allowed inside a single bold span — prevents whole-sentence bolding. */
const MAX_BOLD_WORDS = 4;
const MAX_BOLD_CHARS = 40;

function isBoldSpanTooLong(inner) {
  const trimmed = inner.trim();
  if (!trimmed) return true;
  if (trimmed.length > MAX_BOLD_CHARS) return true;
  if (trimmed.split(/\s+/).length > MAX_BOLD_WORDS) return true;
  return false;
}

/**
 * Strip **markdown** or <b>/<strong> when the span covers more than a short tech term.
 * Keeps short spans like **React**, **AWS Lambda**, **.NET**.
 */
export function clampBoldSpans(text) {
  if (typeof text !== "string" || !text) return text;

  let out = text.replace(/\*\*([^*]+)\*\*/g, (match, inner) => {
    if (isBoldSpanTooLong(inner)) return inner.trim();
    return match;
  });

  out = out.replace(/<(strong|b)>([^<]*)<\/\1>/gi, (match, _tag, inner) => {
    if (isBoldSpanTooLong(inner)) return inner.trim();
    return match;
  });

  return out;
}

/** Clamp bold tags in resume body HTML (summary, projects, experience bullets). */
export function clampBoldInResumeHtml(html) {
  if (typeof html !== "string" || !html) return html;

  return html.replace(/<(strong|b)>([^<]*)<\/\1>/gi, (match, _tag, inner) => {
    if (isBoldSpanTooLong(inner)) return inner.trim();
    return match;
  });
}

export const BOLD_FORMATTING_GUIDANCE = `BOLD FORMATTING (STRICT):
- Use **bold** or <b> only on individual technology names, tools, platforms, or protocols — max 4 words per bold span (e.g. **React**, **TypeScript**, **AWS Lambda**, **Azure Kubernetes Service**).
- NEVER bold an entire sentence, bullet, clause, or phrase. WRONG: **Designed APIs for partner onboarding using REST and OAuth2**. RIGHT: Designed APIs for partner onboarding using **REST** and **OAuth2**.
- Per summary paragraph: bold 3–6 separate tech terms total, not whole sentences. Per bullet: bold 0–2 tech terms only.`;
