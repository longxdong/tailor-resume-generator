export const FEDERAL_CLEARANCE_MESSAGE =
  "This is Federal or Security clearance required job, do not apply for this job";

const CLEARANCE_PATTERNS = [
  /\bsecurity clearance\b/i,
  /\bclearance required\b/i,
  /\b(active|current|existing|valid)\s+(security\s+)?clearance\b/i,
  /\b(top secret|TS\/SCI|SCI eligibility)\b/i,
  /\bsecret clearance\b/i,
  /\bconfidential clearance\b/i,
  /\bpublic trust\b/i,
  /\b(moderate|high)\s+risk\b/i,
  /\beligible for (a )?clearance\b/i,
  /\bmust (be able to )?obtain (a )?(security )?clearance\b/i,
  /\binterim clearance\b/i,
  /\bpolygraph\b/i,
  /\bsuitability determination\b/i,
];

const FEDERAL_PATTERNS = [
  /\bfederal (government|agency|contract|client|project|position|role|employee)\b/i,
  /\bgovernment agency\b/i,
  /\bU\.?S\.? citizenship required\b/i,
  /\bUS citizen(ship)? required\b/i,
  /\b(citizen(ship)? of the )?United States required\b/i,
  /\b(department of defense|\bDoD\b|\bDHS\b|\bNASA\b|\bNSA\b|\bFBI\b|\bCIA\b|\bGSA\b|\bVA\b|\bIRS\b|\bFDA\b|\bUSDA\b)\b/i,
  /\bstate department\b/i,
  /\bpublic sector (client|customer|contract)\b/i,
  /\bfederal contracting\b/i,
  /\bwork on site at a (federal|government) (facility|agency|location)\b/i,
  /\.gov\b/i,
];

/** Combine JD with optional company / title hints for screening. */
export function combineJdScreeningText(jd, ...hints) {
  return [jd, ...hints].filter((part) => typeof part === "string" && part.trim()).join("\n");
}

/** Fast deterministic screen for obvious federal / clearance postings. */
export function isFederalOrClearanceJobByRegex(jd, ...hints) {
  const text = combineJdScreeningText(jd, ...hints);
  if (!text.trim()) return false;
  return (
    CLEARANCE_PATTERNS.some((pattern) => pattern.test(text)) ||
    FEDERAL_PATTERNS.some((pattern) => pattern.test(text))
  );
}

/** Weak signals — run OpenAI classifier only when these appear (regex already passed). */
const WEAK_FEDERAL_SIGNALS = [
  /\bclearance\b/i,
  /\bfederal\b/i,
  /\bgovernment\b/i,
  /\bpublic sector\b/i,
  /\bcitizen(ship)?\b/i,
  /\b\.gov\b/i,
  /\bDoD\b/i,
  /\bagency\b/i,
  /\bFedRAMP\b/i,
  /\bGovCloud\b/i,
];

export function needsJdAiClassifier(jd, ...hints) {
  const text = combineJdScreeningText(jd, ...hints);
  return WEAK_FEDERAL_SIGNALS.some((pattern) => pattern.test(text));
}

export const JD_CLASSIFIER_SYSTEM_PROMPT = `Classify US job postings. JSON only: {"block":true|false}
block=true: requires US security clearance, clearance eligibility, US citizenship for federal/clearance work, or primary federal agency/contract role.
block=false: AppSec/security engineer without clearance, commercial compliance (HIPAA/SOC2), tech-only GovCloud/FedRAMP mentions, or private-sector government-domain work without clearance.
When uncertain, block=false.`;

export function buildJdClassifierUserPrompt(jd, ...hints) {
  const text = combineJdScreeningText(jd, ...hints);
  return `JOB POSTING:\n${text}`;
}

/** Parse {"block":boolean} from classifier response; defaults to false on parse failure. */
export function parseJdClassifierResponse(content) {
  if (typeof content !== "string" || !content.trim()) return false;
  let jsonText = content.trim();
  jsonText = jsonText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = jsonText.indexOf("{");
  const end = jsonText.lastIndexOf("}");
  if (start === -1 || end <= start) return false;
  try {
    const parsed = JSON.parse(jsonText.slice(start, end + 1));
    return parsed.block === true;
  } catch {
    return false;
  }
}

/**
 * Regex first; OpenAI classifier only when weak federal/clearance signals appear.
 * Classifier failures fail open (do not block generation).
 */
export async function assessJdEligibility(openai, jd, hints = [], callChat) {
  if (isFederalOrClearanceJobByRegex(jd, ...hints)) {
    return { block: true, source: "regex" };
  }

  if (!needsJdAiClassifier(jd, ...hints)) {
    return { block: false, source: null };
  }

  if (!openai || typeof callChat !== "function") {
    return { block: false, source: null };
  }

  try {
    const response = await callChat(
      [
        { role: "system", content: JD_CLASSIFIER_SYSTEM_PROMPT },
        { role: "user", content: buildJdClassifierUserPrompt(jd, ...hints) },
      ],
      null,
      120,
      1,
      30000
    );

    const content = response?.choices?.[0]?.message?.content ?? "";
    const block = parseJdClassifierResponse(content);
    return { block, source: block ? "openai" : null };
  } catch (err) {
    console.warn("JD eligibility classifier failed, proceeding:", err.message);
    return { block: false, source: null };
  }
}
