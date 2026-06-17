import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import puppeteer from "puppeteer";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import Handlebars from "handlebars";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Normalize dashes and whitespace for consistent PDF output */
function normalizeTextDashes(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\s+-\s+/g, " – ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDateDisplay(dateStr) {
  if (typeof dateStr !== "string") return dateStr;
  const t = dateStr.trim();
  if (/^present$/i.test(t)) return "Present";
  return normalizeTextDashes(t);
}

/** summary: string[] or string → HTML for {{{summary}}} in templates */
function formatSummaryHtml(summary, boldToStrong) {
  const apply = (s) => boldToStrong(normalizeTextDashes(s));
  const listStyle =
    "margin:0 0 6px 0;padding-left:1.15em;list-style:disc;font-size:10pt;line-height:1.45;color:#3d3d3d;";

  if (Array.isArray(summary)) {
    const items = summary.filter((s) => typeof s === "string" && s.trim()).map(apply);
    if (items.length === 0) return "";
    return `<ul class="summary" style="${listStyle}">${items.map((li) => `<li>${li}</li>`).join("")}</ul>`;
  }
  if (typeof summary === "string" && summary.trim()) {
    return `<p class="summary">${apply(summary)}</p>`;
  }
  return "";
}

function capYearsInText(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/\b(1[2-9]|[2-9]\d|\d{3})\s*\+\s*years?\b/gi, "more than 10 years")
    .replace(/\b(1[2-9]|[2-9]\d|\d{3})\s*years?\b/gi, "more than 10 years");
}

/** Standard corporate job title only — no stack, JD keywords, or tech after dashes/colons */
function sanitizeJobTitle(title) {
  if (typeof title !== "string") return title;
  let t = title.trim().replace(/\s+/g, " ");
  t = t.replace(/\s+at\s+.*$/i, "");
  t = t.replace(/\s*\([^)]*\)\s*$/, "");
  t = t.replace(/\s*[|:]\s+.*$/, "");
  t = t.replace(/\s+[–—]\s+.*$/, "");
  t = t.replace(/\s+-\s+.*$/, "");
  return t.trim();
}

/** Map stripped/vague title text to a standard IC role family before adding Senior. */
function inferRoleFamily(text) {
  const t = text.trim();
  if (!t) return "Software Engineer";
  const lower = t.toLowerCase();

  if (/\b(security engineer|software engineer|backend engineer|frontend engineer|full stack engineer|devops engineer|data engineer|cloud engineer|platform engineer|technical architect|software architect|solutions architect|systems engineer)\b/i.test(t)) {
    return t;
  }
  if (/security/.test(lower)) return "Security Engineer";
  if (/backend/.test(lower)) return "Backend Engineer";
  if (/frontend|front-end/.test(lower)) return "Frontend Engineer";
  if (/full[- ]?stack/.test(lower)) return "Full Stack Engineer";
  if (/devops|sre|reliability/.test(lower)) return "DevOps Engineer";
  if (/architect/.test(lower)) return "Technical Architect";
  if (/data/.test(lower)) return "Data Engineer";
  if (/platform/.test(lower)) return "Platform Engineer";
  if (/cloud|infrastructure/.test(lower)) return "Cloud Engineer";
  if (/\bengineering\b/.test(lower) && !/\bengineer\b/.test(lower)) return "Software Engineer";
  if (/\b(technical|team)\b/.test(lower) && !/\b(engineer|developer|architect)\b/.test(lower)) return "Software Engineer";
  if (/\b(engineer|developer|architect|analyst|specialist|administrator|consultant|programmer)\b/.test(lower)) return t;

  return "Software Engineer";
}

/**
 * Headline + most recent role must read as Senior IC level.
 * Strips Lead / Staff / Principal / management / mid-level markers; ensures "Senior" prefix.
 */
function enforceSeniorTitle(title) {
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
function sanitizeHistoricalTitle(title) {
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

/** Parse a spine date string to a calendar year (Present → current year). */
function parseJobYear(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return new Date().getFullYear();
  if (/present/i.test(dateStr.trim())) return new Date().getFullYear();
  const match = dateStr.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : new Date().getFullYear();
}

/** Known first-release years (public GA). Do not cite a technology in a role whose end year is before this. */
const TECH_RELEASE_YEAR = [
  { patterns: [/\bNext\.?js\b/gi, /\bNextJS\b/gi], year: 2016, fallback: "ASP.NET MVC" },
  { patterns: [/\bAngular\b(?!JS)/gi], year: 2016, fallback: "AngularJS 1.x" },
  { patterns: [/\bReact(?:\.js|JS)?(?! Native)\b/gi], year: 2013, fallback: "jQuery and Backbone.js" },
  { patterns: [/\bTypeScript\b/gi], year: 2012, fallback: "JavaScript" },
  { patterns: [/\bVue\.?js\b/gi], year: 2014, fallback: "Knockout.js and jQuery" },
  { patterns: [/\bDocker\b/gi], year: 2013, fallback: "VM-based deployments" },
  { patterns: [/\bKubernetes\b/gi, /\bK8s\b/gi], year: 2014, fallback: "manual server provisioning" },
  { patterns: [/\bAWS Lambda\b/gi], year: 2014, fallback: "cron jobs and application servers" },
  { patterns: [/\bGraphQL\b/gi], year: 2015, fallback: "REST and SOAP services" },
  { patterns: [/\bTerraform\b/gi], year: 2014, fallback: "manual infrastructure scripts" },
  { patterns: [/\bIstio\b/gi], year: 2017, fallback: "load balancers and reverse proxies" },
  { patterns: [/\bHelm\b/gi], year: 2016, fallback: "configuration management scripts" },
  { patterns: [/\bServerless\b/gi], year: 2014, fallback: "hosted application servers" },
  { patterns: [/\bGKE\b/gi, /\bGoogle Kubernetes Engine\b/gi], year: 2015, fallback: "Google Compute Engine VMs" },
  { patterns: [/\bBigQuery\b/gi], year: 2011, fallback: "SQL Server and MySQL" },
  { patterns: [/\bSnowflake\b/gi], year: 2014, fallback: "PostgreSQL and Redshift" },
  { patterns: [/\bdbt\b/gi], year: 2016, fallback: "SQL scripts and ETL jobs" },
];

/** Modern / senior stack terms that should not dominate early-career or long-ago roles. */
const LEGACY_ROLE_MODERN = [
  { patterns: [/\bKubernetes\b/gi, /\bK8s\b/gi], fallback: "on-prem servers" },
  { patterns: [/\bTerraform\b/gi], fallback: "shell scripts and runbooks" },
  { patterns: [/\bGraphQL\b/gi], fallback: "REST APIs" },
  { patterns: [/\bAWS Lambda\b/gi, /\bLambda functions\b/gi], fallback: "batch jobs" },
  { patterns: [/\bmicroservices\b/gi], fallback: "monolithic applications" },
  { patterns: [/\bDocker\b/gi], fallback: "VM deployments" },
  { patterns: [/\bCI\/CD pipelines\b/gi], fallback: "build scripts and manual releases" },
  { patterns: [/\bPrometheus\b/gi, /\bGrafana\b/gi], fallback: "log files and Nagios" },
  { patterns: [/\bKafka\b/gi], fallback: "message queues and cron" },
  { patterns: [/\bRedis\b/gi], fallback: "in-memory caching on application servers" },
];

function isLegacyExperienceRole(roleIndex, totalRoles, jobEndYear, title) {
  if (/\b(intern|internship|junior|jr\.?|associate|entry[- ]level)\b/i.test(title || "")) return true;
  if (jobEndYear < 2014) return true;
  if (roleIndex >= 2 && jobEndYear < 2018) return true;
  // Oldest row only when that stint ended in an clearly early era (not a recent second job on a 2-role resume)
  if (totalRoles > 0 && roleIndex === totalRoles - 1 && jobEndYear < 2016) return true;
  return false;
}

function replacePatterns(text, patterns, replacement) {
  let out = text;
  for (const pat of patterns) {
    out = out.replace(pat, replacement);
  }
  return out;
}

/** Enforce period-accurate technology in one bullet (plain or **bold** text). */
function sanitizeBulletTechTimeline(bullet, jobEndYear, roleIndex, totalRoles, title) {
  if (typeof bullet !== "string" || !bullet.trim()) return bullet;
  let b = bullet;

  for (const { patterns, year, fallback } of TECH_RELEASE_YEAR) {
    if (jobEndYear < year) {
      b = replacePatterns(b, patterns, fallback);
    }
  }

  if (isLegacyExperienceRole(roleIndex, totalRoles, jobEndYear, title)) {
    for (const { patterns, fallback } of LEGACY_ROLE_MODERN) {
      b = replacePatterns(b, patterns, fallback);
    }
  }

  return b.replace(/\s{2,}/g, " ").trim();
}

function applyTechTimelineToExperience(experience) {
  if (!Array.isArray(experience)) return;
  const total = experience.length;
  experience.forEach((exp, idx) => {
    const endYear = parseJobYear(exp.end_date);
    const title = exp.title || "";
    if (!Array.isArray(exp.details)) return;
    exp.details = exp.details.map((d) =>
      sanitizeBulletTechTimeline(d, endYear, idx, total, title)
    );
  });
}

// Call GPT with timeout & retries
async function callGPT(promptOrMessages, model = null, maxTokens = 80000, retries = 2, timeoutMs = 180000) {
  const resolvedModel = model || process.env.OPENAI_MODEL || "gpt-5-mini";
  while (retries > 0) {
    try {
      let messages;
      if (typeof promptOrMessages === "string") {
        messages = [{ role: "user", content: promptOrMessages }];
      } else if (Array.isArray(promptOrMessages)) {
        messages = promptOrMessages.map((msg) => ({
          role: msg.role === "system" ? "system" : msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        }));
      } else {
        messages = [{ role: "user", content: String(promptOrMessages) }];
      }

      const response = await Promise.race([
        openai.chat.completions.create({
          model: resolvedModel,
          max_completion_tokens: maxTokens,
          messages,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("OpenAI request timed out")), timeoutMs)
        ),
      ]);
      return response;
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      console.log(`Retrying... (${retries} attempts left)`);
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const { profile, jd, template, jobTitle, companyName } = req.body;

    if (!profile) return res.status(400).send("Profile required");
    if (!jd) return res.status(400).send("Job description required");
    
    // Default to Resume.html if no template specified
    const templateName = template || "Resume-Professional-Sans";

    // Load profile JSON
    console.log(`Loading profile: ${profile}`);
    const profilePath = path.join(process.cwd(), "resumes", `${profile}.json`);
    
    if (!fs.existsSync(profilePath)) {
      return res.status(404).send(`Profile "${profile}" not found`);
    }
    
    const profileData = JSON.parse(fs.readFileSync(profilePath, "utf-8"));


    // Calculate years of experience
    const calculateYears = (experience) => {
      if (!experience || experience.length === 0) return 0;
      
      const parseDate = (dateStr) => {
        if (dateStr.toLowerCase() === "present") return new Date();
        return new Date(dateStr);
      };
      
      const earliest = experience.reduce((min, job) => {
        const date = parseDate(job.start_date);
        return date < min ? date : min;
      }, new Date());
      
      const years = (new Date() - earliest) / (1000 * 60 * 60 * 24 * 365);
      return Math.round(years);
    };

    const yearsOfExperience = calculateYears(profileData.experience);

    // JSON file: personal facts + employment spine (company + dates). Titles and narrative are JD-driven in the model prompt.
    const employmentSpine = Array.isArray(profileData.experience)
      ? profileData.experience.map((j) => {
          const loc = j.location && String(j.location).trim() ? ` | ${j.location}` : "";
          return `${j.company} | ${j.start_date} - ${j.end_date}${loc}`;
        })
      : [];

    const educationLines = Array.isArray(profileData.education)
      ? profileData.education.map(
          (e) =>
            `${e.degree}, ${e.school} (${e.start_year}-${e.end_year})${e.grade ? " | " + e.grade : ""}`
        )
      : [];

    const candidateContext = [
      "CANDIDATE PERSONAL (use exactly for the resume header; do not change spelling of name or contact):",
      profileData.name,
      [
        profileData.email,
        profileData.phone,
        profileData.location,
        profileData.linkedin,
        profileData.website,
      ]
        .filter(Boolean)
        .join(" | "),
      "",
      "EDUCATION (facts only):",
      ...educationLines,
      "",
      "EMPLOYMENT SPINE (non-negotiable: keep these company names and start_date/end_date exactly. Same number of roles as listed. Ignore any job titles in the JSON file; generate JD-aligned titles and bullets only.):",
      ...employmentSpine.map((line) => `- ${line}`),
    ].join("\n");

    const resumePromptTemplate = `You are an expert resume writer producing offer-worthy, ATS-optimized resumes aligned to the Job Description (JD).

INPUT RULES (CRITICAL):
- "CANDIDATE PERSONAL" and "EDUCATION" are the only authoritative biographical facts from the candidate file.
- "EMPLOYMENT SPINE" lists real employers and date ranges. Preserve each company name and start_date and end_date exactly. Same number of experience rows as spine rows. Ignore any titles stored in the JSON file.
- Generate summary, skills, job titles, and experience bullets from the JD (not from a prior resume narrative). Stay broadly plausible per employer and dates.

JD ALIGNMENT:
- Root "title" (resume headline under the candidate name) and experience[0].title (MOST RECENT job, first row after sorting most-recent-first) MUST both be Senior-level titles. This rule overrides the JD posting title when the JD says Lead, Staff, Principal, Architect-without-Senior, or any mid-level title.
- SENIORITY OVERRIDE (CRITICAL — NON-NEGOTIABLE):
  • Root "title" and experience[0].title MUST use the word "Senior" (e.g. "Senior Software Engineer", "Senior Backend Engineer", "Senior Security Engineer", "Senior Technical Architect").
  • NEVER use on root "title" or experience[0].title: Lead, Staff, Principal, Distinguished, Head, Director, Manager, VP, Intern, Junior, Associate, Entry Level, or roman/numeric levels (II, III, Level 2, etc.).
  • If the JD title is "Lead Software Engineer", "Software Engineer", "Staff Engineer", "Principal Engineer", "Backend Engineer II", etc., map the role family from the JD but output Senior + role family on root "title" and experience[0].title only (e.g. JD "Lead Backend Engineer" → "Senior Backend Engineer"; JD "Software Engineer" → "Senior Software Engineer"; JD "Principal Security Engineer" → "Senior Security Engineer").
  • Bullets, skills, and summary may still reflect JD duties (including lead/principal scope) even though the displayed title says Senior.
- JOB TITLE FORMAT: Short standard corporate titles only (2–5 words). No tech stacks after dashes/colons/parentheses. WRONG: "Senior Software Engineer - C#". RIGHT: "Senior Software Engineer".
- experience[1] onward (older roles): same JD job family; show realistic progression (mid-level or junior titles allowed on older rows only). Never Staff/Principal/Lead on any row. No tech suffixes on any title.

SUMMARY (bullet format):
- Return "summary" as a JSON array of 4–6 strings (each string is one summary bullet, not a paragraph).
- Each bullet: one idea, strong action verb at the start (Led, Built, Reduced, Delivered, Architected, Partnered, etc.), weave JD tech with **bold** on tools/platforms where natural.
- Include optional JD technologies when relevant (e.g. Vue3, MAUI/Xamarin, BI/ML, HTML5/CSS3, Python/Django) even if secondary to core stack.
- If the candidate has more than 10 years of experience, say only "more than 10 years" or "over 10 years" in summary text, never an exact count like 14 years.

TECHNICAL SKILLS (CRITICAL — DENSE SENIOR-LEVEL SECTION):
- The skills section represents CURRENT capabilities of a seasoned senior engineer in the JD's role family. It is NOT limited to words copied from the JD. Skills are NOT bound by per-job technology timeline rules (those apply to experience bullets only).
- Structure: use 6–10 categories tailored to the JD (e.g. Languages, Backend, Frontend, Cloud & Infrastructure, Databases, Data & Messaging, DevOps & CI/CD, Security, Testing & Observability, Tools & Methodologies — adapt labels to the role).
- ORDER within each category: (1) highest-priority JD keywords first, (2) then expand with the full realistic ecosystem a senior engineer in this role would know from years of practice.
- DENSITY (HARD): Each category MUST contain at least 12 skills (target 14–22 when credible). If a category would have fewer than 12, expand with adjacent tools, libraries, protocols, cloud services, and practices common to that stack until the minimum is met.
- EXPANSION RULES: After JD terms, add related senior-level ecosystem items even if absent from the JD — e.g. for backend/security/cloud roles: REST, GraphQL, gRPC, OAuth2/JWT, Docker, Kubernetes, Terraform, CI/CD (GitHub Actions, Jenkins), monitoring (Prometheus, Grafana), logging, SQL/NoSQL variants, message queues (Kafka, Pub/Sub), Agile/Scrum, code review, system design. For frontend-heavy roles add HTML5, CSS3, webpack, testing libraries, etc. Stay plausible for the role family; do not invent niche tools with no connection.
- Avoid exact duplicates across categories; slight variants OK (e.g. Docker and Containerization in different sections). No filler words — every item must be a real technology, tool, platform, or methodology.
- This section should dominate ATS keyword coverage: comprehensive, detailed, and what a real experienced senior engineer's resume would list.

EXPERIENCE BULLETS:
- Approximately 4–8 bullets per role (fewer for short internships).
- One idea per bullet. Start with a strong action verb. Include **bold** on key technologies.
- At least 75% of bullets across the resume should include a measurable outcome (%, latency, throughput, time saved, scale, ticket volume, team size, etc.). Use plausible, modest numbers; avoid absurd claims.
- Gold-pattern example: "Reduced API response time by 40% by implementing **Redis** caching and query optimization in **SQL Server** for multi-tenant SaaS service."
- Where the JD implies full-stack or platform work, include explicit front-end collaboration in at least one bullet per recent role (e.g. partnered with front-end teams on API contracts, UI integration, design reviews).
- Put the densest JD/modern stack in experience[0] and recent rows. Do NOT copy the full modern JD stack into every historical job.

TECHNOLOGY TIMELINE (CRITICAL — NON-NEGOTIABLE):
- Before writing bullets for EACH role, read that row's start_date and end_date. Every **bold** or plain technology in that role's bullets MUST have existed and been realistically used during that employment period (use the role's end year as the cutoff).
- NEVER cite a framework/tool in a job that ended before that technology's public release. Reference release years (verify mentally before output):
  • Angular (2+): 2016 — NOT in roles ending before 2016
  • React: 2013 — NOT before 2013
  • TypeScript: 2012 — NOT before 2012
  • Vue.js: 2014 — NOT before 2014
  • Next.js: 2016 — NOT before 2016
  • Docker: 2013 — NOT before 2013
  • Kubernetes / K8s: 2014 — NOT before 2014
  • AWS Lambda: 2014 — NOT before 2014
  • GraphQL: 2015 — NOT before 2015
  • Terraform: 2014 — NOT before 2014
- If unsure about release timing, use generic or period-appropriate alternatives instead of modern names (pre-2013 frontend: jQuery, Backbone.js, AngularJS 1.x; pre-2013 backend: PHP, Java, .NET, Ruby on Rails; pre-2014 infra: on-prem VMs, FTP/cron, manual deploys).
- LEGACY / JUNIOR / OLDEST ROLES (titles with Intern/Junior/Associate, roles ending before 2014, third-or-later rows ending before 2018, OR the oldest row when it ended before 2016): bullets MUST use simpler, era-appropriate stacks only — monoliths, SQL, SVN/CVS, on-prem servers, basic scripting, jQuery-era frontend, Java/.NET/PHP, manual releases. Do NOT put Kubernetes, Terraform, GraphQL, Lambda/serverless, Next.js, or other modern senior/platform tooling in those rows even if the JD mentions them.
- experience[0] (most recent): full JD-aligned modern stack is allowed when dates support it.

CONSISTENCY:
- Use the same date format as the spine (e.g. "Aug 2024 – Present"). Use an en-dash surrounded by spaces between dates in display strings if you output a combined range in text; in JSON use separate start_date and end_date fields exactly as in the spine.
- Title Case for skill category names. No em dashes (—). No emojis.

BOLD (**double asterisks**): only on technical terms in summary bullets and experience bullets. Never bold job titles, companies, or dates.

Here is the candidate context (personal + education + employment spine only):

\${candidateContext}

Here is the target job description:

\${jobDescription}

FINAL CHECK:
- Root "title" and experience[0].title both start with "Senior" and contain no Lead/Staff/Principal/mid-level markers.
- For EVERY experience row: re-check start_date/end_date — no anachronistic tech; oldest/intern/junior rows use simple period-appropriate tools only.
- skills: 6–10 categories; EVERY category has at least 12 items; JD keywords first in each list; section reads like a senior engineer's full stack, not a short JD paste.
- summary is an array of 4–6 bullets; most experience bullets have metrics; spine companies/dates unchanged.
- Every title is plain (no technology suffix).

OUTPUT: Return a single JSON object only (no markdown fences, no commentary):

{"title":"<Senior + JD role family e.g. Senior Software Engineer>","summary":["<bullet 1 with **bold**>","<bullet 2>",...],"skills":{"<CategoryName>":["<JD keyword first>", "<12-22 total per category>",...],...},"experience":[{"title":"<Senior + role for MOST RECENT row only>","company":"<exact from spine>","location":"","start_date":"<exact from spine>","end_date":"<exact from spine>","details":["<bullet>",...]},{"title":"<older row may be mid-level e.g. Software Engineer>",...}]}

Order experience most recent first (same order as spine).`;

    const prompt = resumePromptTemplate
      .replace(/\$\{candidateContext\}/g, candidateContext)
      .replace(/\$\{jobDescription\}/g, jd);

    const aiResponse = await callGPT(prompt);

    const finishReason = aiResponse.choices?.[0]?.finish_reason;
    const contentRaw = aiResponse.choices?.[0]?.message?.content ?? "";

    console.log("OpenAI API Response Metadata:");
    console.log("- Model:", aiResponse.model);
    console.log("- Finish reason:", finishReason);
    console.log("- Input tokens:", aiResponse.usage?.prompt_tokens);
    console.log("- Output tokens:", aiResponse.usage?.completion_tokens);

    let content;
    if (finishReason === "length") {
      console.error("⚠️ WARNING: GPT hit max_tokens limit! Response was truncated.");
      console.log("🔄 Retrying with reduced requirements to fit in token limit...");

      const concisePrompt = prompt
        .replace(/4–6 strings/g, "3–4 strings")
        .replace(/Approximately 4–8 bullets per role/g, "Approximately 3–5 bullets per role")
        .replace(/at least 12 skills \(target 14–22/g, "at least 10 skills (target 12–16")
        .replace(/6–10 categories/g, "5–8 categories")
        .replace(/At least 75% of bullets/g, "At least 60% of bullets");

      const retryResponse = await callGPT(concisePrompt, null, 10000);
      console.log("Retry Response Metadata:");
      console.log("- Finish reason:", retryResponse.choices?.[0]?.finish_reason);
      console.log("- Output tokens:", retryResponse.usage?.completion_tokens);

      content = (retryResponse.choices?.[0]?.message?.content ?? "").trim();
    } else {
      content = contentRaw.trim();
    }
    
    // Check if AI is apologizing instead of returning JSON
    if (content.toLowerCase().startsWith("i'm sorry") || 
        content.toLowerCase().startsWith("i cannot") || 
        content.toLowerCase().startsWith("i apologize")) {
      console.error("AI is apologizing instead of returning JSON:", content.substring(0, 200));
      throw new Error("AI refused to generate resume. The prompt may be too complex. Please try again with a shorter job description or simpler requirements.");
    }
    
    // Enhanced JSON extraction - handle various formats
    // Remove markdown code blocks (case insensitive)
    content = content.replace(/```json\s*/gi, "");
    content = content.replace(/```javascript\s*/gi, "");
    content = content.replace(/```\s*/g, "");
    
    // Remove common prefixes
    content = content.replace(/^(here is|here's|this is|the json is):?\s*/gi, "");
    
    // Try to extract JSON from text if wrapped
    // Look for content between first { and last }
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      content = content.substring(firstBrace, lastBrace + 1);
    } else {
      console.error("No JSON object found in response");
      throw new Error("AI did not return valid JSON format. Please try again.");
    }
    
    content = content.trim();
    
    // Parse JSON with better error handling
    let resumeContent;
    try {
      resumeContent = JSON.parse(content);
    } catch (parseError) {
      console.error("=== JSON PARSE ERROR ===");
      console.error("Parse error:", parseError.message);
      console.error("Content length:", content.length);
      console.error("First 1000 chars:", content.substring(0, 1000));
      console.error("Last 500 chars:", content.substring(Math.max(0, content.length - 500)));
      
      // Try to fix common JSON issues
      try {
        // Remove trailing commas
        let fixedContent = content.replace(/,(\s*[}\]])/g, '$1');
        // Fix unescaped quotes in strings (basic attempt)
        fixedContent = fixedContent.replace(/([^\\])"([^",:}\]]*)":/g, '$1\\"$2":');
        resumeContent = JSON.parse(fixedContent);
        console.log("✅ Successfully parsed after fixing common issues");
      } catch (secondError) {
        console.error("Failed to parse even after fixes");
        throw new Error(`AI returned invalid JSON: ${parseError.message}. Please try again.`);
      }
    }
    
    // Validate required fields (summary may be string or array of bullets)
    const hasSummary =
      (typeof resumeContent.summary === "string" && resumeContent.summary.trim()) ||
      (Array.isArray(resumeContent.summary) &&
        resumeContent.summary.some((s) => typeof s === "string" && s.trim()));

    if (!resumeContent.title || !hasSummary || !resumeContent.skills || !resumeContent.experience) {
      console.error("Missing required fields in AI response:", Object.keys(resumeContent));
      throw new Error("AI response missing required fields (title, summary, skills, or experience)");
    }

    const spineLen = Array.isArray(profileData.experience) ? profileData.experience.length : 0;
    const aiExpLen = Array.isArray(resumeContent.experience) ? resumeContent.experience.length : 0;
    if (spineLen > 0 && aiExpLen !== spineLen) {
      console.warn(
        `Experience row count from model (${aiExpLen}) does not match employment spine in JSON (${spineLen}); PDF may not match your profile file.`
      );
    }

    if (typeof resumeContent.title === "string") {
      resumeContent.title = enforceSeniorTitle(resumeContent.title);
    }

    // Convert **bold** to <strong> for HTML template
    const boldToStrong = (s) =>
      typeof s === "string" ? s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>") : s;

    // Summary: cap years wording; render as bullet list HTML for templates
    if (yearsOfExperience > 10) {
      if (typeof resumeContent.summary === "string") {
        resumeContent.summary = capYearsInText(resumeContent.summary);
      } else if (Array.isArray(resumeContent.summary)) {
        resumeContent.summary = resumeContent.summary.map(capYearsInText);
      }
    }

    const summaryHtml = formatSummaryHtml(resumeContent.summary, boldToStrong);

    if (Array.isArray(resumeContent.experience)) {
      resumeContent.experience.forEach((exp, idx) => {
        if (typeof exp.title === "string") {
          exp.title = idx === 0 ? enforceSeniorTitle(exp.title) : sanitizeHistoricalTitle(exp.title);
        }
      });
    }

    // Skills: clean category keys; dedupe items; preserve JD-first order from model
    if (resumeContent.skills && typeof resumeContent.skills === "object") {
      const skillsClean = {};
      for (const [key, value] of Object.entries(resumeContent.skills)) {
        const cleanKey =
          typeof key === "string"
            ? key.replace(/\*/g, "").trim().replace(/\b\w/g, (c) => c.toUpperCase())
            : key;
        const items = Array.isArray(value)
          ? [...new Set(value.map((v) => (typeof v === "string" ? v.trim() : v)).filter(Boolean))]
          : value;
        skillsClean[cleanKey || key] = items;
      }
      resumeContent.skills = skillsClean;

      const skillCategoryCounts = Object.entries(skillsClean).map(([k, v]) => ({
        category: k,
        count: Array.isArray(v) ? v.length : 0,
      }));
      const thinCategories = skillCategoryCounts.filter((c) => c.count > 0 && c.count < 12);
      if (thinCategories.length > 0) {
        console.warn(
          "Skills categories below 12 items:",
          thinCategories.map((c) => `${c.category}(${c.count})`).join(", ")
        );
      }
      console.log(
        "Skills per category:",
        skillCategoryCounts.map((c) => `${c.category}: ${c.count}`).join("; ")
      );
    }

    console.log("✅ AI content generated successfully");
    console.log("Skills categories:", Object.keys(resumeContent.skills).length);
    console.log("Experience entries:", resumeContent.experience.length);
    
    // Debug: Check if experience has details
    resumeContent.experience.forEach((exp, idx) => {
      console.log(`Experience ${idx + 1}: ${exp.title || 'NO TITLE'} - Details count: ${exp.details?.length || 0}`);
      if (!exp.details || exp.details.length === 0) {
        console.error(`⚠️ WARNING: Experience entry ${idx + 1} has NO DETAILS!`);
      }
    });

    // Load Handlebars template (dynamic based on user selection)
    const templateFile = `${templateName}.html`;
    const templatePath = path.join(process.cwd(), "templates", templateFile);
    
    if (!fs.existsSync(templatePath)) {
      console.error(`Template not found: ${templateFile}`);
      return res.status(404).send(`Template "${templateName}" not found`);
    }
    
    console.log(`Using template: ${templateFile}`);
    const templateSource = fs.readFileSync(templatePath, "utf-8");
    
    // Register Handlebars helpers
    Handlebars.registerHelper('formatKey', function(key) {
      // Convert keys like "Programming Languages" or "frontend" to proper format
      return key;
    });
    
    Handlebars.registerHelper('join', function(array, separator) {
      // Join array elements with separator
      if (Array.isArray(array)) {
        return array.join(separator);
      }
      return '';
    });
    
    const compiledTemplate = Handlebars.compile(templateSource);

    const aiExp = resumeContent.experience || [];
    const spine = profileData.experience || [];

    // Always anchor company/dates to JSON spine when counts match; use AI for titles and bullets
    const experience =
      spine.length > 0 && aiExp.length === spine.length
        ? spine.map((job, idx) => ({
            title: idx === 0
              ? enforceSeniorTitle(aiExp[idx]?.title || "Engineer")
              : sanitizeHistoricalTitle(aiExp[idx]?.title || "Engineer"),
            company: job.company,
            location: job.location && String(job.location).trim() ? job.location : "",
            start_date: normalizeDateDisplay(job.start_date),
            end_date: normalizeDateDisplay(job.end_date),
            details: Array.isArray(aiExp[idx]?.details) ? aiExp[idx].details : [],
          }))
        : aiExp.map((e, idx) => ({
            title: idx === 0
              ? enforceSeniorTitle(e.title || "Engineer")
              : sanitizeHistoricalTitle(e.title || "Engineer"),
            company: e.company,
            location: e.location && String(e.location).trim() ? e.location : "",
            start_date: normalizeDateDisplay(e.start_date),
            end_date: normalizeDateDisplay(e.end_date),
            details: Array.isArray(e.details) ? e.details : [],
          }));

    // Timeline rules use authoritative spine dates; then convert markdown bold to HTML
    applyTechTimelineToExperience(experience);
    experience.forEach((exp) => {
      if (Array.isArray(exp.details)) {
        exp.details = exp.details.map((d) => boldToStrong(normalizeTextDashes(d)));
      }
    });

    const templateData = {
      name: profileData.name,
      title: typeof resumeContent.title === "string" ? enforceSeniorTitle(resumeContent.title) : "",
      email: profileData.email,
      phone: profileData.phone,
      location: profileData.location,
      linkedin: profileData.linkedin,
      website: profileData.website,
      summary: summaryHtml,
      skills: resumeContent.skills,
      experience,
      education: profileData.education,
    };

    // Render HTML
    const html = compiledTemplate(templateData);
    console.log("HTML rendered from template");

    // Generate PDF with Puppeteer
    const browser = process.env.NODE_ENV === 'production'
      ? await puppeteerCore.launch({
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        })
      : await puppeteer.launch({ headless: "new" });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { 
        top: "15mm", 
        bottom: "15mm", 
        left: "0mm", 
        right: "0mm" 
      },
    });
    await browser.close();

    console.log("PDF generated successfully!");

    // Build safe filename: Name_company name_job title.pdf
    const profileName = profileData.name || 'resume';
    
    // Sanitize each part: remove spaces within section, remove special chars, keep only alphanumeric
    const sanitize = (str) => str ? str.replace(/\s+/g, "").replace(/[^A-Za-z0-9]/g, "") : "";
    const sanitizedName = sanitize(profileName);
    const sanitizedCompany = sanitize(companyName);
    const sanitizedJobTitle = sanitize(jobTitle);
    
    // Build filename: Name_company name_job title (underscores only between sections)
    let baseName = sanitizedName;
    if (sanitizedCompany) baseName += `_${sanitizedCompany}`;
    if (sanitizedJobTitle) baseName += `_${sanitizedJobTitle}`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.pdf"`);
    res.end(pdfBuffer);
    

  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).send("PDF generation failed: " + err.message);
  }
}
