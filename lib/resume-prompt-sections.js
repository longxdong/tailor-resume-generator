/** Shared prompt enhancement blocks for OpenAI and ChatGPT resume tailoring. */

export const ATS_KEYWORD_COVERAGE = `ATS KEYWORD COVERAGE (CRITICAL):
- Parse the entire Job Description before generating any content.
- Extract meaningful technical keywords: frameworks, cloud services, databases, languages, testing tools, DevOps tools, architectural patterns, methodologies, protocols, APIs, security concepts, and engineering practices.
- Ensure at least 90–95% of the JD's technical keywords appear naturally somewhere in the resume.
- Do not force every extracted JD keyword into every section. Layer placement for believability:
  • Summary: high-level strengths and role fit (not a keyword dump).
  • Skills: complete technology coverage — primary ATS keyword home.
  • Experience: only technologies naturally used in that role and era.
- Never keyword stuff. Every keyword must appear in a believable engineering context.
- High coverage means breadth across the full resume, not repeating every keyword in every bullet.`;

export const RESPONSIBILITY_ALIGNMENT = `RESPONSIBILITY ALIGNMENT (CRITICAL):
- Extract responsibilities from the JD, not only technologies.
- Represent these naturally in experience bullets where plausible: system architecture, distributed systems, backend services, frontend collaboration, scalability, observability, production support, incident response, debugging, performance optimization, mentoring, code review, Agile ceremonies, sprint planning, stakeholder communication, customer collaboration, documentation, CI/CD ownership, cloud migration, testing, deployment, technical ownership.
- Do not list responsibilities as a separate section; weave them into role-specific bullets.`;

export const SEMANTIC_JD_ALIGNMENT = `SEMANTIC JD ALIGNMENT (CRITICAL):
- Do not simply copy JD keywords or sentence structure.
- Infer underlying employer needs: scalability, distributed systems, reliability, maintainability, cloud-native architecture, performance, observability, secure coding, automation, platform engineering, customer impact, cross-functional collaboration.
- The resume should read as a strong fit for the target role through transferable experience — not as if every employer did identical JD-shaped work.
- Stay consistent with employment dates, employer context, and each company's engineering identity.`;

export const COMPANY_IDENTITY = `COMPANY IDENTITY (CRITICAL):
- Every employer must retain its own believable engineering identity. Do NOT rewrite every company into the target JD.
- Infer domain from company names and spine context, then adapt transferable experience naturally:
  • Financial: payments, reporting, compliance, transactional systems
  • Healthcare: patient systems, HIPAA, interoperability
  • GIS / mapping: telemetry, geospatial, routing
  • Gaming: rendering, networking, performance, graphics
  • Government: workflows, document management, compliance
  • SaaS / product: multi-tenant platforms, customer workflows, integrations
- Recent roles may align more closely with the JD; older roles should stay broader and era-appropriate unless the domain naturally matches.`;

export const CAREER_PROGRESSION = `CAREER PROGRESSION (CRITICAL):
- Every experience entry must reflect realistic growth. Do not make every role sound identical. Avoid repeating the same achievements across companies.
- Most recent role: architecture, mentoring, ownership, system design, cross-team collaboration.
- Second role: feature ownership, API implementation, optimization, testing.
- Third role: implementation, debugging, maintenance, documentation.
- Oldest / junior role: bug fixes, testing, internal tools, support, learning from senior engineers.
- Avoid making junior or early-career roles sound like senior architects.`;

export const BULLET_QUALITY = `EXPERIENCE BULLET QUALITY:
- Each bullet must describe something concrete: a real task, system, decision, or outcome.
- Avoid vague bullets. No first-person language. No bullets ending with periods.
- Each bullet: 18–28 words preferred, max 32. Vary length slightly across the resume.
- Not every bullet needs a metric or two technologies — mix architecture, ownership, collaboration, and impact naturally.`;

export const BULLET_STYLE_DIVERSITY = `BULLET STYLE DIVERSITY:
- Do not repeat one sentence pattern throughout the resume. Mix multiple styles:
  • Architecture-first: Designed a distributed event processing platform using **Kafka** to improve resiliency across financial services
  • Business-first: Accelerated partner onboarding by redesigning authentication workflows using **OAuth2**
  • Collaboration-first: Partnered with frontend engineers to simplify API contracts and improve client integration
  • Ownership-first: Owned the migration from monolithic services to **Azure Kubernetes Service**, coordinating release planning across multiple teams
- Rotate emphasis across bullets: architecture, business impact, collaboration, ownership, mentoring, debugging, design decisions, customer impact.
- Avoid formulaic repetition of Verb + Technology + Metric + Result in every bullet.`;

export const ACTION_VERB_DIVERSITY = `ACTION VERB DIVERSITY:
- Avoid overusing: Developed, Implemented, Worked on, Responsible for.
- Rotate naturally among: Designed, Built, Architected, Created, Delivered, Enhanced, Migrated, Optimized, Automated, Integrated, Refactored, Resolved, Analyzed, Partnered, Collaborated, Modernized, Standardized, Simplified, Accelerated, Improved, Engineered.
- No single action verb should appear more than twice across the entire resume.
- "Architected" as a verb is allowed; do not use Architect as a job title unless existing title rules allow.`;

export const TECHNOLOGY_DENSITY = `TECHNOLOGY DENSITY:
- Each bullet should mention no more than two or three technologies.
- Avoid technology lists in a single bullet.
- Bad: Built apps using React, Redux, GraphQL, Docker, AWS, Redis, Jenkins.
- Good: Built reusable interfaces using React and integrated backend APIs for improved user workflows.
- Not every bullet needs two technologies — some bullets may emphasize ownership, design, or collaboration with one or zero named tools.`;

export const METRICS_GUIDANCE = `METRICS (believable only):
- Approximately 60–70% of experience bullets should contain measurable outcomes. The rest should emphasize ownership, architecture, mentoring, collaboration, technical leadership, debugging, design decisions, or customer impact.
- Not every bullet needs a percentage or multiplier.
- Preferred ranges when used: 15%, 20%, 30%, 40%, 2x, 3x, modest user/request scale (e.g. 500K users, 2M requests/day).
- Avoid unrealistic numbers like 95%, 99%, 1000%, 100x unless the JD explicitly supports them.
- Metrics should vary naturally across bullets — do not repeat the same metric or accomplishment across jobs.`;

export const SKILLS_ORDERING = `SKILLS ORDERING (within every category):
1. Exact JD technologies
2. Closely related ecosystem tools
3. Industry-standard complementary technologies
4. Supporting methodologies (only when they are named standards, e.g. Scrum, OAuth2 — not vague concepts)
- Never alphabetize. Order from highest relevance to lowest.`;

export const TECHNICAL_SKILLS_BALANCED = `TECHNICAL SKILLS (BALANCED ATS + HUMAN READABILITY):
- The skills section represents CURRENT capabilities of a seasoned senior engineer in the JD's role family. Skills are NOT bound by per-job technology timeline rules (those apply to experience bullets only).
- Generate 7–9 skill categories tailored to the JD (always include Industry & Domain as the final category).
- Each category should contain approximately 8–12 carefully selected items. Do NOT force every category to 12–22 skills.
- Total skills across all categories: roughly 80–110 unique items. Prefer quality over quantity.
- ${SKILLS_ORDERING}
- Do not pad categories with unnecessary technologies simply to increase keyword count. Only include technologies that strengthen credibility for the target role.
- Avoid excessive duplication across categories; slight variants OK in different categories.
- List skills as plain text only — no **bold**, <b>, or <strong> on individual skill items. Category labels may use bold; skill names must not.
- Prefer concrete technologies over vague concepts.
  • Good: React, Redux, TypeScript, Next.js, HTML5, CSS3, Webpack, Jest, Playwright, Accessibility
  • Bad: Frontend Development, Modern Web Technologies, Cross-browser Compatibility, Client-side Development, Performance Optimization, Scalability Patterns
- Skills should primarily consist of: programming languages, frameworks, libraries, cloud services, databases, DevOps tools, testing tools, messaging platforms, infrastructure, protocols, authentication systems.
- Avoid generic engineering concepts as skill items (Performance Optimization, Scalability Patterns, Cloud-native Architecture, Modern Development, Frontend Development, Backend Development, Software Engineering, Server-side Development) — those belong in experience bullets.
- This section should be the primary home for ATS keyword coverage: comprehensive but curated, like a recruiter-polished senior engineer resume.`;

export const SKILLS_INDUSTRY_DOMAIN = `INDUSTRY & DOMAIN SKILLS (REQUIRED):
- Include an "Industry & Domain" category as the final skills category.
- Populate 8–12 terms matching BOTH the JD industry/domain (e.g. EdTech, FinTech, Insurance, SaaS B2B) AND believable domains from the candidate's employment spine (infer from company names/context).
- Use concrete domain terms (FinTech, HIPAA, Geospatial, Payments) — not vague concepts.
- Do not invent industries unrelated to listed employers or the JD.`;

export const CONTENT_DEDUPLICATION = `CONTENT DEDUPLICATION:
- Do not repeat technologies, metrics, accomplishments, or architecture themes across multiple jobs unless genuinely appropriate.
- The summary must not paraphrase or duplicate experience bullets.
- Skills should not merely duplicate every experience bullet — skills provide breadth; experience provides proof.
- No duplicated bullets anywhere on the resume.`;

export const TITLE_PROGRESSION = `TITLE PROGRESSION:
- Most recent title: Senior <Role Family> (must match existing Senior rules on headline and latest role).
- Older titles: Software Engineer, Backend Engineer, Frontend Engineer, Full Stack Engineer, Developer, or Junior variants on the oldest role.
- Avoid title inflation. Never use Staff, Principal, Distinguished, Director, Manager, VP, Lead as titles (existing rules still apply).`;

export const JD_TITLE_DERIVATION = `JD TITLE DERIVATION (CRITICAL — NON-NEGOTIABLE):
- NEVER copy the JD posting title verbatim into the resume headline or latest role title.
- Strip location, remote/hybrid/onsite, country, employer name, and stack lists from any title (e.g. WRONG: "Senior Angular/React Engineer - Fully Remote, in Portugal").
- Map the JD to a short standard Senior IC title (2–4 words after "Senior"): Senior Software Engineer, Senior Backend Engineer, Senior Frontend Engineer, Senior Full Stack Engineer, Senior DevOps Engineer, Senior Data Engineer, Senior Security Engineer, Senior Platform Engineer, Senior AI Engineer, Senior Mobile Engineer, or Senior Quality Engineer.
- Use CV_TITLE exactly for the header and latest company title — it is already normalized; do not replace it with the raw JD posting title.
- If the JD says Lead, Staff, Principal, Architect-without-Senior, or mid-level (II, III, Junior), still output Senior + role family on the headline and latest role only.
- Bullets and skills may reflect lead/principal scope; displayed titles stay Senior IC.`;

export const RESUME_WRITING_STYLE = `RESUME WRITING STYLE:
- Write like an experienced technical recruiter polished this resume: natural top-to-bottom flow, curated skills, distinct company identities, believable progression.
- No resume buzzwords or filler. No repeated sentence patterns across bullets.
- Avoid: passionate, hardworking, dynamic, go-getter, fast learner, team player, results-driven, leveraged cutting-edge, spearheaded innovative, robust and scalable solutions, seamless, synergy, transformative.
- Keep writing concise and achievement-oriented. The CV should sound like a real developer remembering real work.`;

export const SUMMARY_OPENAI = `SUMMARY (bullet format — executive overview):
- Return "summary" as a JSON array of 4–6 strings (each string is one summary bullet).
- Summarize overall expertise, architecture experience, technical breadth, business domains, cloud experience, mentoring, and engineering impact — not a replay of the latest role's bullets.
- Read like an executive overview of the candidate's career fit for this JD.
- Each bullet: one idea, strong opening, **bold** on key technologies where natural.
- Do not paraphrase experience bullets. Avoid generic personality statements.
- Do not repeat the same technology in consecutive bullets unless central to the JD.`;

export const SUMMARY_CHATGPT = `SUMMARY (paragraph — executive overview):
- Summary: 60–80 words, 3–4 sentences in the summary paragraph.
- Summarize overall expertise, architecture experience, technical breadth, business domains, cloud experience, mentoring, and engineering impact — not a replay of the latest role's bullets.
- Read like an executive overview of the candidate's career fit for this JD.
- Do not paraphrase experience bullets. Avoid generic personality statements.
- Do not repeat the same technology in consecutive sentences unless central to the JD.`;

export const ATS_PARSING_OPENAI = `ATS PARSING (OpenAI output):
- Return valid JSON only. No markdown fences, no commentary.
- Use **double asterisks** for bold on technical terms in summary and experience bullets only.
- Never use **bold** in skills values — skills must be plain text strings.
- Never bold job titles, companies, or dates.
- Avoid Unicode bullets, special symbols, or decorative formatting in JSON string values.`;

export const ATS_PARSING_CHATGPT = `ATS PARSING (HTML output):
- Output HTML body only inside the code block.
- Use <b> tags for technical terms in summary and experience bullets only — not in skill item lists.
- Skill category labels may use <b> (e.g. <b>Languages:</b>); list skill items as plain text after the label.
- Avoid Unicode bullets, special symbols, or decorative formatting beyond the provided template structure.`;

export const HUMAN_READABILITY_CHECK = `HUMAN READABILITY (verify before returning):
- The resume reads naturally from top to bottom.
- Bullet lengths vary slightly; not every bullet contains a metric or two technologies.
- The summary sounds different from the experience section.
- Skills look curated rather than exhaustive or padded.
- Company identities remain distinct; career progression is believable; junior roles remain junior.
- The resume should look indistinguishable from one written by an experienced technical recruiter.`;

export const SELF_VALIDATION_OPENAI = `SELF VALIDATION (MANDATORY — verify before returning JSON):
- Root "title" and experience[0].title both start with "Senior"; no Lead/Staff/Principal/mid-level markers on those two.
- Companies and dates exactly match the employment spine.
- No technology in a role bullet before its real-world release year for that role's dates.
- No duplicated bullets. No duplicated metrics. No action verb used more than twice.
- No duplicated skills across categories (slight variants OK in different categories).
- Skills: 7–9 categories; each has approximately 8–12 items; roughly 80–110 unique skills total; Industry & Domain included; no bold on skill items.
- Approximately 60–70% of experience bullets include measurable outcomes.
- At least 90% of major JD technical keywords appear naturally in the resume (primarily in skills + recent experience).
- Major JD responsibilities appear naturally in experience (not only in skills).
- Career progression is realistic; roles do not sound identical; oldest role remains junior-appropriate.
- Summary does not duplicate or paraphrase experience bullets.
- ${HUMAN_READABILITY_CHECK}
- Output is valid JSON only.`;

export const SELF_VALIDATION_CHATGPT = `SELF VALIDATION (MANDATORY — verify before returning HTML):
- Header title and latest company title match CV_TITLE and start with "Senior".
- Companies and dates exactly match the body structure spine.
- No technology in a role bullet before its real-world release year for that role's dates.
- No duplicated bullets. No duplicated metrics. No action verb used more than twice.
- Skills: 7–9 categories including Industry & Domain as the last; each has approximately 8–12 items; roughly 80–110 unique skills total; no bold on skill items.
- Approximately 60–70% of experience bullets include measurable outcomes (heaviest in latest role).
- At least 90% of major JD technical keywords appear naturally in the resume.
- Major JD responsibilities appear naturally in experience.
- Career progression is realistic; oldest role uses a junior-level title and junior-appropriate bullets.
- Summary does not duplicate or paraphrase experience bullets.
- ${HUMAN_READABILITY_CHECK}
- Output is one \`\`\`html code block only, no other text.`;

/** Block inserted after JD / tailoring intro in both prompts. */
export const CORE_ENHANCEMENTS = `${ATS_KEYWORD_COVERAGE}

${RESPONSIBILITY_ALIGNMENT}

${SEMANTIC_JD_ALIGNMENT}

${COMPANY_IDENTITY}

${CAREER_PROGRESSION}`;

/** Category label examples for ChatGPT skills section (7–9 categories; Industry & Domain last). */
export const SKILLS_CATEGORY_EXAMPLES = `Use 7–9 categories adapted to the CV title (always end with Industry & Domain). Examples by role family:
For Backend / Software / Full Stack: Programming Languages, Backend & Frameworks, Frontend & APIs, Databases, Cloud & Infrastructure, DevOps & CI/CD, Testing & Observability, Industry & Domain
For Frontend: Programming Languages, Frontend Frameworks & UI, State Management & APIs, Build & Tooling, Cloud & Deployment, Testing & Accessibility, Industry & Domain
For DevOps / Platform: Programming & Scripting, Cloud & Infrastructure, CI/CD & Automation, Containers & Orchestration, Monitoring & Networking, Security & Reliability, Industry & Domain
Adapt labels when more natural; omit lowest-relevance categories if using 7; add one if using 9.`;

/** Compact OpenAI-only prompt (~60% fewer tokens than full block stack). Timeline/title cleanup runs server-side. */
export const OPENAI_SYSTEM_PROMPT = `You are an expert technical recruiter writing ATS-optimized senior engineer resumes. Return valid JSON only — no markdown fences or commentary.

HARD RULES:
- Preserve employment spine: exact company names, start_date, end_date; same row count; most recent first.
- Root "title" and experience[0].title: Senior + short role family (e.g. Senior Software Engineer). No Lead/Staff/Principal/Junior on those two. Older rows: realistic mid/junior progression. No stack/location in titles.
- **bold** only in summary and experience bullets — never in skills. No bold on titles, companies, dates.
- Use era-appropriate tech per role dates; simpler stacks in older/junior roles. Full JD stack only in recent roles when dates allow.

CONTENT (recruiter-quality, not keyword-stuffed):
- ATS: 90%+ JD technical keywords across resume — primarily in skills + recent experience; not every keyword in every bullet.
- Summary: 4 bullets, executive overview of expertise/domains/cloud/mentoring — do NOT paraphrase experience bullets.
- Skills: 7–8 categories, 8–10 items each (~70–90 total), Industry & Domain last. JD terms first per category. Plain-text concrete technologies only (React, Kafka, Terraform) — not concepts (Scalability, Modern Development). No skill-item bold.
- Experience: 4–6 bullets on latest role, 3–5 on others. Concrete tasks; 18–28 words; no periods; max 2–3 tech per bullet. Mix architecture, ownership, collaboration, and impact — not the same Verb+Tech+Metric pattern every time. ~60–70% bullets with believable metrics (15–40%, 2x–3x). No verb more than twice. Each company keeps its own domain identity — do not rewrite every employer as the JD clone.
- Recent role: architecture, mentoring, ownership. Middle: features, APIs. Older/junior: implementation, debugging, support.
- No duplicated bullets, metrics, or buzzwords (passionate, synergy, cutting-edge, robust and scalable).`;

export const OPENAI_SYSTEM_PROMPT_RETRY = OPENAI_SYSTEM_PROMPT.replace(
  "4 bullets",
  "3 bullets"
)
  .replace("7–8 categories, 8–10 items each (~70–90 total)", "6–7 categories, 7–9 items each (~55–70 total)")
  .replace("4–6 bullets on latest role, 3–5 on others", "3–5 bullets on latest role, 3–4 on others");

export const OPENAI_OUTPUT_SCHEMA = `{"title":"Senior Software Engineer","summary":["bullet with **bold** tech",...],"skills":{"CategoryName":["plain skill",...],...},"experience":[{"title":"Senior ...","company":"<exact spine>","location":"","start_date":"<exact>","end_date":"<exact>","details":["bullet",...]},...]}`;

export const OPENAI_FINAL_CHECK = `Verify before returning: (1) spine match (2) Senior on title + exp[0] (3) no skill bold (4) 90%+ JD keywords (5) distinct companies (6) believable progression (7) 60–70% metrics (8) valid JSON only.`;

export function buildOpenAiUserPrompt(candidateContext, jobDescription, yearsOverTen) {
  const yearsNote =
    yearsOverTen
      ? "\n- Candidate has 10+ years: say only \"more than 10 years\" in summary, never an exact count."
      : "";
  return `CANDIDATE:\n${candidateContext}\n\nJOB DESCRIPTION:\n${jobDescription}${yearsNote}\n\n${OPENAI_FINAL_CHECK}\n\nOUTPUT JSON:\n${OPENAI_OUTPUT_SCHEMA}`;
}
