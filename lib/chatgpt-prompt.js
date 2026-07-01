import { buildHtmlShell } from "./resume-shell";
import { deriveSeniorTitle } from "./job-titles";
import {
  ATS_PARSING_CHATGPT,
  BULLET_QUALITY,
  BULLET_STYLE_DIVERSITY,
  ACTION_VERB_DIVERSITY,
  CONTENT_DEDUPLICATION,
  CORE_ENHANCEMENTS,
  JD_TITLE_DERIVATION,
  METRICS_GUIDANCE,
  RESUME_WRITING_STYLE,
  SELF_VALIDATION_CHATGPT,
  SKILLS_CATEGORY_EXAMPLES,
  TECHNICAL_SKILLS_BALANCED,
  SUMMARY_CHATGPT,
  TECHNOLOGY_DENSITY,
  TITLE_PROGRESSION,
} from "./resume-prompt-sections";

const CODE_FENCE = "```";

const PROMPT_RULES = `Follow these rules in order.
1. Output — generate immediately
- The job description is already included in this message. Generate the resume now. Do not ask for the JD.
- Never say you are ready, waiting, or list what you will do. No acknowledgments. No questions.
- If eligible: return exactly ONE fenced code block and nothing else.
- Format:
${CODE_FENCE}html
<body content here — see section 3>
${CODE_FENCE}
- Put only the filled resume body inside the code block: either the full <body>...</body> element or the same inner elements shown in the body structure (from the opening name div through education).
- Do not output <!DOCTYPE>, <html>, <head>, or <style> — CSS is applied automatically by the application.
- No text before or after the code block. No "Part 1", "Part 2", options, questions, or explanations.
- Never refuse or ask to split across messages. Deliver the complete body in one code block.
- If space is tight, keep exact bullet counts but use 18-28 words per bullet — never drop bullets or sections.
- Rejection only (when ineligible): 1-2 plain sentences, no code block, no HTML.
2. Eligibility check before HTML
- Generate HTML if the JD says remote, fully remote, work from anywhere, remote possible, remote or office, or gives remote as one option.
- Generate HTML if work mode is not mentioned.
- Reject only for clear hybrid-only, onsite-only, office-only, mandatory regular office attendance with no remote option, or required non-English local language.
- Do not infer restrictions from city names, office addresses, headquarters, country restrictions, residency, visas, or location-limited remote wording.
- Treat non-English language as reject only when required, not preferred or nice to have.
3. Template lock
- CSS, head, class names, body structure, section order, and print rules are fixed by the application.
- Use the BODY STRUCTURE section at the end of this message exactly.
- Replace only text content: title, contact, summary, skills, role titles, dates, bullets, and education.
- Keep one column, ATS friendly, no tables, icons, sidebars, skill bars, or graphics.
- No company locations in experience. Dates must include month and year.
4. Company context
{{COMPANY_CONTEXT}}

{{CORE_ENHANCEMENTS}}

5. Tailoring method
- First imagine one believable project at the latest company close to the JD; use it as hidden context for the latest role.
- Do the same more lightly for the second company when useful.
- Write from practical memory of implementation, defects, releases, reviews, tradeoffs, and collaboration.
- Do not copy JD sentence structure; cover JD keywords through natural placement (see ATS KEYWORD COVERAGE).
6. Skills
- ${TECHNICAL_SKILLS_BALANCED}
- Output 7–9 one-line skill categories in the Technical Skills section (use 7, 8, or 9 rows as appropriate; last category must be Industry & Domain).
- ${SKILLS_CATEGORY_EXAMPLES}
7. Experience
- Keep exactly {{ROLE_COUNT}} companies in newest-to-oldest order as listed in the body structure.
- Bullet counts: latest {{BULLETS_1}}, second {{BULLETS_2}}, third {{BULLETS_3}}{{BULLETS_4_LINE}}
- ${BULLET_QUALITY}
- ${BULLET_STYLE_DIVERSITY}
- ${TECHNOLOGY_DENSITY}
- ${METRICS_GUIDANCE}
- ${CONTENT_DEDUPLICATION}
- First latest-role bullet must name a believable platform/system and explain frontend, backend, infrastructure/deployment, and purpose.
- Do not invent revenue, patents, executive ownership, headcount management, or unrealistic scale.
- Before writing bullets for each role, respect technology release dates for that role's employment period (no anachronistic tools).
8. Titles
- Header title and latest company title must match exactly: {{CV_TITLE}}.
- ${JD_TITLE_DERIVATION}
- ${TITLE_PROGRESSION}
- Use a common market title, not a rare JD-shaped title.
- Prefer: Senior Backend Engineer, Senior Software Engineer, Senior Full Stack Engineer, Senior AI Engineer, Senior DevOps Engineer, Senior Data Engineer, Senior Mobile Engineer, Senior Platform Engineer, Senior Quality Engineer, or Senior Frontend Engineer.
- Avoid long, stack-heavy, vendor-heavy, parenthesized, or overly specific titles.
- Second company title = header title with only leading "Senior " removed.
- Third company: mid-level title (Software Engineer, Backend Engineer, etc.). Oldest company: Junior-level title (Junior Software Developer, Junior Backend Developer, or similar).
9. Writing quality
- ${SUMMARY_CHATGPT}
- ${ACTION_VERB_DIVERSITY}
- ${RESUME_WRITING_STYLE}
- ATS friendly: common role titles, common technology names, clear project keywords, standard section text.

${ATS_PARSING_CHATGPT}

${SELF_VALIDATION_CHATGPT}`;

const PROMPT_TASK_PREFIX = `TASK: Generate a tailored resume for the job description below. Output the completed resume body in one ${CODE_FENCE}html code block now — or 1-2 rejection sentences if ineligible. The JD, candidate facts, rules, and body template are all in this message. Do not ask for input. Do not reply that you are ready.`;

const BULLET_COUNTS = [9, 8, 5, 3];

function formatDateRange(job) {
  const start = job.start_date || "";
  const end = job.end_date || "";
  return `${start} - ${end}`.replace(/\s+/g, " ").trim();
}

function formatContactLine(profile) {
  const parts = [];
  if (profile.email) {
    parts.push(`<a href="mailto:${profile.email}">${profile.email}</a>`);
  }
  if (profile.location) parts.push(profile.location);
  if (profile.linkedin) {
    const href = profile.linkedin.startsWith("http")
      ? profile.linkedin
      : `https://${profile.linkedin}`;
    const label = profile.linkedin.replace(/^https?:\/\/(www\.)?/, "");
    parts.push(`<a href="${href}">${label}</a>`);
  }
  if (profile.phone) parts.push(profile.phone);
  return parts.join(" | ");
}

function formatEducationBlock(education) {
  if (!Array.isArray(education) || education.length === 0) {
    return `<div class="education"><b>Degree, Field</b><br>School Name - Month Year - Month Year</div>`;
  }

  return education
    .map((edu) => {
      const degree = edu.degree || "Degree";
      const school = edu.school || "School";
      const start = edu.start_year || edu.start_date || "";
      const end = edu.end_year || edu.end_date || "";
      const range = [start, end].filter(Boolean).join(" - ");
      return `<div class="education"><b>${degree}</b><br>${school}${range ? ` - ${range}` : ""}</div>`;
    })
    .join("\n");
}

function buildCompanyContext(roles) {
  if (roles.length === 0) {
    return "Use believable consulting and product drafts for each employer listed in the body structure.";
  }

  const lines = [];
  const latest = roles[0];
  lines.push(
    `${latest.company} is the candidate's current or most recent employer. Use the latest role as senior engineering in a consulting or product delivery environment. Depending on the JD, the believable project may involve client platforms, backend services, web applications, integrations, data workflows, cloud delivery, DevOps practices, AI-enabled product work, modernization, or internal tooling.`
  );

  if (roles[1]) {
    lines.push(
      `${roles[1].company} is a prior employer. Use it through believable enterprise client, product, platform, integration, cloud delivery, data flow, QA, or modernization context. Keep it realistic; do not pretend every project exactly matches the JD.`
    );
  }

  const older = roles.slice(2);
  if (older.length > 0) {
    const names = older.map((r) => r.company).join(", ");
    lines.push(
      `${names} should usually stay broader and more foundational, unless the JD naturally matches web applications, backend services, frontend delivery, cloud support, QA, DevOps, data workflows, or enterprise workflow platforms.`
    );
  }

  return lines.join("\n");
}

function buildRoleBullets(count, prefix) {
  return Array.from({ length: count }, (_, i) => `<li>{{${prefix}_BULLET_${String(i + 1).padStart(2, "0")}}}</li>`).join(
    "\n"
  );
}

function buildExperienceHtml(roles, cvTitle) {
  const titleHints = [
    cvTitle,
    `{{remove only the leading "Senior " from CV_TITLE}}`,
    "{{Software Engineer, Backend Developer, Frontend Developer, Data Engineer, DevOps Engineer, Platform Engineer, Quality Engineer, or similar mid-level title that fits the JD and remains below the second role}}",
    "{{Junior Software Developer, Junior Backend Developer, Junior Frontend Developer, Junior QA Engineer, or similar junior title that fits the JD}}",
  ];

  return roles
    .map((job, idx) => {
      const bullets = BULLET_COUNTS[idx] ?? 3;
      const titleLine = idx === 0 ? cvTitle : titleHints[Math.min(idx, titleHints.length - 1)];
      return `<div class="job">
<div class="job-title">${titleLine} - <span class="company">${job.company}</span><span class="date">${formatDateRange(job)}</span></div>
<ul>
${buildRoleBullets(bullets, `ROLE_${idx + 1}`)}
</ul>
</div>`;
    })
    .join("\n");
}

export function buildBodySkeleton(profile, cvTitle, roles) {
  const contact = formatContactLine(profile);
  const education = formatEducationBlock(profile.education);
  const experience = buildExperienceHtml(roles, cvTitle);

  return `<div class="name">${profile.name}</div>
<div class="title">${cvTitle}</div>
<div class="contact">${contact}</div>
<div class="section">
<div class="section-title">Summary</div>
<p>
{{SUMMARY_60_TO_80_WORDS}}
</p>
</div>
<div class="section skills">
<div class="section-title">Technical Skills</div>
<div><b>{{SKILL_CATEGORY_1}}:</b> {{SKILL_LIST_1, 8-12 plain-text technologies — no bold}}</div>
<div><b>{{SKILL_CATEGORY_2}}:</b> {{SKILL_LIST_2, 8-12 plain-text technologies — no bold}}</div>
<div><b>{{SKILL_CATEGORY_3}}:</b> {{SKILL_LIST_3, 8-12 plain-text technologies — no bold}}</div>
<div><b>{{SKILL_CATEGORY_4}}:</b> {{SKILL_LIST_4, 8-12 plain-text technologies — no bold}}</div>
<div><b>{{SKILL_CATEGORY_5}}:</b> {{SKILL_LIST_5, 8-12 plain-text technologies — no bold}}</div>
<div><b>{{SKILL_CATEGORY_6}}:</b> {{SKILL_LIST_6, 8-12 plain-text technologies — no bold}}</div>
<div><b>{{SKILL_CATEGORY_7}}:</b> {{SKILL_LIST_7, 8-12 plain-text technologies — no bold}}</div>
<div><b>Industry & Domain:</b> {{SKILL_LIST_8, 8-12 plain-text domain terms — no bold; always last category}}</div>
</div>
<div class="section">
<div class="section-title">Professional Experience</div>
${experience}
</div>
<div class="section">
<div class="section-title">Education</div>
${education}
</div>`;
}

function buildHtmlTemplate(profile, cvTitle, roles) {
  const body = buildBodySkeleton(profile, cvTitle, roles);
  return buildHtmlShell(profile.name, body);
}

function buildCandidateFacts(profile, roles) {
  const lines = [
    "CANDIDATE FACTS (use for contact and education only; employers and dates are fixed in the body structure):",
    `Name: ${profile.name}`,
  ];
  if (profile.email) lines.push(`Email: ${profile.email}`);
  if (profile.phone) lines.push(`Phone: ${profile.phone}`);
  if (profile.location) lines.push(`Location: ${profile.location}`);
  if (profile.linkedin) lines.push(`LinkedIn: ${profile.linkedin}`);
  if (profile.website) lines.push(`Website: ${profile.website}`);

  lines.push("", "Employment spine (newest first — keep companies and dates exactly):");
  roles.forEach((job, idx) => {
    lines.push(`${idx + 1}. ${job.company} | ${formatDateRange(job)}`);
  });

  if (Array.isArray(profile.education) && profile.education.length > 0) {
    lines.push("", "Education:");
    profile.education.forEach((edu) => {
      lines.push(`- ${edu.degree || "Degree"} | ${edu.school || "School"} | ${edu.start_year || ""} - ${edu.end_year || ""}`);
    });
  }

  return lines.join("\n");
}

export function buildChatGptPrompt(profile, cvTitle, jd) {
  const title = deriveSeniorTitle(cvTitle, jd);
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const roles = experience.slice(0, 4);
  const roleCount = roles.length || 4;

  const defaultRoles = [
    { company: "Company 1", start_date: "Month Year", end_date: "Present" },
    { company: "Company 2", start_date: "Month Year", end_date: "Month Year" },
    { company: "Company 3", start_date: "Month Year", end_date: "Month Year" },
    { company: "Company 4", start_date: "Month Year", end_date: "Month Year" },
  ];
  const activeRoles = roles.length > 0 ? roles : defaultRoles;

  const bullets = activeRoles.map((_, idx) => BULLET_COUNTS[idx] ?? 3);
  const bullets4Line =
    activeRoles.length >= 4 ? `, oldest ${bullets[3]}` : activeRoles.length === 3 ? `, oldest ${bullets[2]}` : "";

  const rules = PROMPT_RULES.replace("{{COMPANY_CONTEXT}}", buildCompanyContext(activeRoles))
    .replace("{{CORE_ENHANCEMENTS}}", CORE_ENHANCEMENTS)
    .replace(/\{\{CV_TITLE\}\}/g, title)
    .replace("{{ROLE_COUNT}}", String(roleCount))
    .replace("{{BULLETS_1}}", String(bullets[0] ?? 9))
    .replace("{{BULLETS_2}}", String(bullets[1] ?? 8))
    .replace("{{BULLETS_3}}", String(bullets[2] ?? 5))
    .replace("{{BULLETS_4_LINE}}", bullets4Line);

  const bodySkeleton = buildBodySkeleton(profile, title, activeRoles);
  const candidateFacts = buildCandidateFacts(profile, activeRoles);
  const jobDescription = (jd || "").trim();

  return `${PROMPT_TASK_PREFIX}

CV_TITLE: ${title}

--- JOB DESCRIPTION (already provided — tailor the resume to this) ---
${jobDescription}

${rules}

${candidateFacts}

--- BODY STRUCTURE (fill every placeholder; output this completed in one ${CODE_FENCE}html code block now) ---
${bodySkeleton}`;
}

// Kept for tests / full-document preview
export { buildHtmlTemplate };
