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

TECHNICAL SKILLS:
- Mirror JD categories and vocabulary. In each category array, list highest-value JD keywords FIRST, then related tools.
- Include JD-required skills first; add optional/adjacent skills from the JD when plausible (Vue3, MAUI, Xamarin, BI, ML, HTML5, CSS3, Python, Django, etc.).
- Roughly 6–14 items per category when justified; omit empty categories.

EXPERIENCE BULLETS:
- Approximately 4–8 bullets per role (fewer for short internships).
- One idea per bullet. Start with a strong action verb. Include **bold** on key technologies.
- At least 75% of bullets across the resume should include a measurable outcome (%, latency, throughput, time saved, scale, ticket volume, team size, etc.). Use plausible, modest numbers; avoid absurd claims.
- Gold-pattern example: "Reduced API response time by 40% by implementing **Redis** caching and query optimization in **SQL Server** for multi-tenant SaaS service."
- Where the JD implies full-stack or platform work, include explicit front-end collaboration in at least one bullet per recent role (e.g. partnered with front-end teams on API contracts, UI integration, design reviews).
- Weave optional JD tech into bullets when relevant to that role's timeframe.

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
- summary is an array of 4–6 bullets; skills ordered JD-first; most experience bullets have metrics; spine companies/dates unchanged.
- Every title is plain (no technology suffix).

OUTPUT: Return a single JSON object only (no markdown fences, no commentary):

{"title":"<Senior + JD role family e.g. Senior Software Engineer>","summary":["<bullet 1 with **bold**>","<bullet 2>",...],"skills":{"<CategoryName>":["<JD keyword first>",...],...},"experience":[{"title":"<Senior + role for MOST RECENT row only>","company":"<exact from spine>","location":"","start_date":"<exact from spine>","end_date":"<exact from spine>","details":["<bullet>",...]},{"title":"<older row may be mid-level e.g. Software Engineer>",...}]}

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
        .replace(/roughly 6–14 items per category/g, "roughly 5–9 items per category")
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
        if (Array.isArray(exp.details)) {
          exp.details = exp.details.map((d) => boldToStrong(normalizeTextDashes(d)));
        }
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
