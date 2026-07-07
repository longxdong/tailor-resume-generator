/** Shared guidance for certifications + per-role projects (OpenAI + ChatGPT). */

export const CERTIFICATIONS_GUIDANCE = `CERTIFICATIONS (section below Technical Skills):
- 3–5 plain-text items; JD-relevant cloud, security, or platform certs when plausible (e.g. AWS Solutions Architect – Associate, AZ-204, CKA).
- One certification per line — never combine into a single row or comma/bullet-separated sentence.
- Match seniority and career timeline; do not invent obscure or expired-only credentials.
- No bold markup in certification strings.`;

export const EXPERIENCE_PROJECT_GUIDANCE = `PER-ROLE PROJECT (above accomplishment bullets for every experience row):
- Each experience entry includes a "project" object: {"name":"<short platform/product name>","summary":"<one sentence, 18–32 words; bold only 1–2 tech terms, never the whole sentence>"}.
- Project must be believable for that spine company and employment dates; infer domain from employer name (e.g. search/analytics at Elastic, AI platform at Mistral).
- Latest 2 roles: JD-aligned flagship initiative. Older roles: simpler, era-appropriate internal systems — still distinct per company.
- Project sets context; bullets prove accomplishments — do not duplicate the same sentence in project.summary and details[0].
- Era-appropriate technology only (same timeline rules as bullets).`;

/** Normalize AI certifications array. */
export function normalizeCertifications(raw) {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .map((item) =>
          typeof item === "string"
            ? item.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/<\/?(?:strong|b)>/gi, "").trim()
            : ""
        )
        .filter(Boolean)
    ),
  ].slice(0, 6);
}

/** Normalize project from string or {name, summary}. */
export function normalizeProject(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    const summary = raw.trim();
    return summary ? { name: "", summary } : null;
  }
  if (typeof raw === "object") {
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
    if (!name && !summary) return null;
    return { name, summary };
  }
  return null;
}

export function hasProjectContent(project) {
  return Boolean(project && (project.name || project.summary));
}
