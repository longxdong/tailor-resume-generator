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

export const JD_CLASSIFIER_SYSTEM_PROMPT = `You classify US job descriptions for a resume tool.

Return JSON only: {"block":true|false}

Set block=true when the role requires or expects ANY of:
- US security clearance (Secret, Top Secret, TS/SCI, Public Trust, etc.)
- Eligibility/obtainment of clearance or suitability determination for federal work
- US citizenship mandated for clearance or federal employment
- Primary work for a US federal agency or federal government contract where clearance/citizenship is implied

Set block=false for:
- Generic "security engineer", AppSec, cybersecurity, or OWASP work without clearance
- HIPAA, SOC2, or commercial compliance only
- Private-sector "government" domain experience (e.g. built workflows for a government client) without clearance requirement
- Technology mentions only (GovCloud, FedRAMP, AWS GovCloud) without clearance/citizenship requirement

When uncertain, prefer block=false.`;

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
 * Regex first, then optional OpenAI classifier for nuanced JDs.
 * Classifier failures fail open (do not block generation).
 */
export async function assessJdEligibility(openai, jd, hints = [], callChat) {
  if (isFederalOrClearanceJobByRegex(jd, ...hints)) {
    return { block: true, source: "regex" };
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
