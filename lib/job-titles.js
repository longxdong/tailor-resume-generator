/** Standard corporate job title only — no stack, JD keywords, or tech after dashes/colons */
export function sanitizeJobTitle(title) {
  if (typeof title !== "string") return title;
  let t = title.trim().replace(/\s+/g, " ");
  t = t.replace(/\s+at\s+.*$/i, "");
  t = t.replace(/\s*\([^)]*\)\s*$/, "");
  t = t.replace(/\s*[|:]\s+.*$/, "");
  t = t.replace(/\s+[–—]\s+.*$/, "");
  t = t.replace(/\s+-\s+.*$/, "");
  t = t.replace(/,\s*in\s+.+$/i, "");
  t = t.replace(/\b(fully\s+)?remote\b/gi, "");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/** Map stripped/vague title text to a standard IC role family before adding Senior. */
export function inferRoleFamily(text) {
  const t = text.trim();
  if (!t) return "Software Engineer";
  const lower = t.toLowerCase();

  if (
    /\b(security engineer|software engineer|backend engineer|frontend engineer|full stack engineer|devops engineer|data engineer|cloud engineer|platform engineer|technical architect|software architect|solutions architect|systems engineer|ai engineer|mobile engineer|quality engineer)\b/i.test(
      t
    )
  ) {
    return t.replace(/^senior\s+/i, "").trim();
  }

  if (/angular|react|vue|svelte|next\.?js/i.test(lower) && /full[- ]?stack|\.net|c#|node\.?js|python|java|backend|api/i.test(lower)) {
    return "Full Stack Engineer";
  }
  if (/angular|react|vue|svelte|frontend|front-end/i.test(lower)) return "Frontend Engineer";

  if (/security/.test(lower)) return "Security Engineer";
  if (/backend/.test(lower)) return "Backend Engineer";
  if (/frontend|front-end/.test(lower)) return "Frontend Engineer";
  if (/full[- ]?stack/.test(lower)) return "Full Stack Engineer";
  if (/devops|sre|reliability/.test(lower)) return "DevOps Engineer";
  if (/architect/.test(lower)) return "Technical Architect";
  if (/data/.test(lower)) return "Data Engineer";
  if (/platform/.test(lower)) return "Platform Engineer";
  if (/cloud|infrastructure/.test(lower)) return "Cloud Engineer";
  if (/\bai\b|machine learning|ml engineer/.test(lower)) return "AI Engineer";
  if (/mobile|ios|android/.test(lower)) return "Mobile Engineer";
  if (/qa|quality|test/.test(lower)) return "Quality Engineer";
  if (/\bengineering\b/.test(lower) && !/\bengineer\b/.test(lower)) return "Software Engineer";
  if (/\b(technical|team)\b/.test(lower) && !/\b(engineer|developer|architect)\b/.test(lower)) return "Software Engineer";
  if (/\b(engineer|developer|architect|analyst|specialist|administrator|consultant|programmer)\b/.test(lower)) {
    return sanitizeJobTitle(t);
  }

  return "Software Engineer";
}

/**
 * Headline + most recent role must read as Senior IC level.
 * Strips Lead / Staff / Principal / management / mid-level markers; ensures "Senior" prefix.
 */
export function enforceSeniorTitle(title) {
  let t = sanitizeJobTitle(title);
  if (!t) return "Senior Software Engineer";

  t = t
    .replace(
      /\b(staff|principal|distinguished|lead|leading|intern|internship|junior|jr\.?|associate|entry[- ]level|director|manager|head|vp|vice president|chief)\b/gi,
      " "
    )
    .replace(/\s+(i{1,3}|iv|v|vi{0,3}|1|2|3|4|5)\b/gi, "")
    .replace(/\blevel\s+[1-5]\b/gi, "")
    .replace(/^\s*of\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  t = t.replace(/^sr\.?\s+/i, "").replace(/^senior\s+/i, "").trim();
  t = inferRoleFamily(t);

  const result = `Senior ${t}`.replace(/\s+/g, " ");
  return result.replace(/^Senior Senior\s+/i, "Senior ");
}

/** Older roles: no Lead/Staff/Principal/management; may remain mid-level; drop Senior prefix for progression. */
export function sanitizeHistoricalTitle(title) {
  let t = sanitizeJobTitle(title);
  t = t
    .replace(
      /\b(staff|principal|distinguished|lead|leading|director|manager|head|vp|vice president|chief)\b/gi,
      " "
    )
    .replace(/\s+(i{1,3}|iv|v|vi{0,3}|1|2|3|4|5)\b/gi, "")
    .replace(/\blevel\s+[1-5]\b/gi, "")
    .replace(/^sr\.?\s+/i, "")
    .replace(/^senior\s+/i, "")
    .replace(/^\s*of\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  t = inferRoleFamily(t);
  return t || "Software Engineer";
}

function looksLikePostingTitle(title) {
  if (!title || typeof title !== "string") return true;
  const trimmed = title.trim();
  if (!trimmed) return true;
  return (
    /\b(remote|hybrid|onsite|fully remote|work from home|wfh)\b/i.test(trimmed) ||
    /,\s*in\s+/i.test(trimmed) ||
    (/\/|\\/.test(trimmed) && /\b(engineer|developer|architect)\b/i.test(trimmed)) ||
    trimmed.split(/\s+/).length > 7 ||
    /\b(hiring|apply now|join our|we are looking)\b/i.test(trimmed)
  );
}

function extractTitleCandidateFromJd(jd) {
  if (!jd || typeof jd !== "string") return "";
  const lines = jd
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 10)) {
    if (line.length > 120) continue;
    if (!/\b(engineer|developer|architect|programmer|analyst)\b/i.test(line)) continue;
    if (/\b(responsibilities|requirements|qualifications|about us|description|benefits)\b/i.test(line)) continue;
    return line;
  }

  return lines[0] || "";
}

function inferSeniorTitleFromJdStacks(jd) {
  const lower = (jd || "").toLowerCase();
  const hasFrontend = /\b(react|angular|vue|frontend|front-end|typescript|javascript|svelte)\b/.test(lower);
  const hasBackend = /(\.net|c#|dotnet|node\.?js|python|java|backend|api|microservice|spring)/i.test(lower);
  const hasFull = hasFrontend && hasBackend;
  const hasDevops = /\b(devops|kubernetes|terraform|ci\/cd|sre)\b/.test(lower);
  const hasData = /\b(data engineer|etl|spark|warehouse|bigquery)\b/.test(lower);
  const hasSecurity = /\b(security engineer|appsec|cybersecurity)\b/.test(lower);

  if (hasSecurity) return "Senior Security Engineer";
  if (hasData) return "Senior Data Engineer";
  if (hasDevops && !hasFull && !hasFrontend) return "Senior DevOps Engineer";
  if (hasFull) return "Senior Full Stack Engineer";
  if (hasFrontend && !hasBackend) return "Senior Frontend Engineer";
  if (hasBackend && !hasFrontend) return "Senior Backend Engineer";
  return null;
}

/**
 * Derive a clean Senior IC headline from an optional UI hint and the JD text.
 * Never returns posting-style titles (remote, location, slash-stacks).
 */
export function deriveSeniorTitle(jobTitleHint, jd) {
  const hint = typeof jobTitleHint === "string" ? jobTitleHint.trim() : "";
  const jdText = typeof jd === "string" ? jd : "";
  const hintLooksLikePosting = looksLikePostingTitle(hint);
  const fromStacks = inferSeniorTitleFromJdStacks(jdText);

  let source = hint;
  if (!source || hintLooksLikePosting) {
    source = extractTitleCandidateFromJd(jdText) || hint || "Software Engineer";
  }

  if (fromStacks && (!hint || hintLooksLikePosting || looksLikePostingTitle(source))) {
    return fromStacks;
  }

  let title = enforceSeniorTitle(source);

  if (looksLikePostingTitle(title) || /[\/\\]/.test(title)) {
    if (fromStacks) title = fromStacks;
    else title = enforceSeniorTitle(inferRoleFamily(sanitizeJobTitle(source)));
  }

  return title;
}
