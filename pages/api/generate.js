import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import puppeteer from "puppeteer";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import {
  buildOpenAiUserPrompt,
  OPENAI_SYSTEM_PROMPT,
  OPENAI_SYSTEM_PROMPT_RETRY,
} from "../../lib/resume-prompt-sections";
import { enforceSeniorTitle, sanitizeHistoricalTitle } from "../../lib/job-titles";
import {
  assessJdEligibility,
  FEDERAL_CLEARANCE_MESSAGE,
} from "../../lib/jd-eligibility";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Default max completion tokens for resume JSON (full resume fits well under this). */
const OPENAI_MAX_COMPLETION_TOKENS = 80000;
const OPENAI_RETRY_MAX_TOKENS = 50000;

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
async function callGPT(promptOrMessages, model = null, maxTokens = OPENAI_MAX_COMPLETION_TOKENS, retries = 2, timeoutMs = 180000) {
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

    const eligibility = await assessJdEligibility(openai, jd, [companyName, jobTitle], callGPT);
    if (eligibility.block) {
      console.log(`JD blocked (${eligibility.source || "unknown"}): federal/clearance posting`);
      return res.status(400).send(FEDERAL_CLEARANCE_MESSAGE);
    }
    
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
      `NAME: ${profileData.name}`,
      `CONTACT: ${[
        profileData.email,
        profileData.phone,
        profileData.location,
        profileData.linkedin,
        profileData.website,
      ]
        .filter(Boolean)
        .join(" | ")}`,
      educationLines.length > 0 ? `EDUCATION:\n${educationLines.map((l) => `- ${l}`).join("\n")}` : "",
      `SPINE (exact companies/dates, ${employmentSpine.length} roles):\n${employmentSpine.map((line) => `- ${line}`).join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n");

    const userPrompt = buildOpenAiUserPrompt(
      candidateContext,
      jd,
      yearsOfExperience > 10
    );

    const messages = [
      { role: "system", content: OPENAI_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ];

    const aiResponse = await callGPT(messages);

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

      const retryMessages = [
        { role: "system", content: OPENAI_SYSTEM_PROMPT_RETRY },
        { role: "user", content: userPrompt },
      ];

      const retryResponse = await callGPT(retryMessages, null, OPENAI_RETRY_MAX_TOKENS);
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

    // Convert **bold** to <strong> for HTML template (summary and experience bullets only)
    const boldToStrong = (s) =>
      typeof s === "string" ? s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>") : s;

    const stripSkillFormatting = (s) =>
      typeof s === "string"
        ? s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/<\/?(?:strong|b)>/gi, "").trim()
        : s;

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
          ? [
              ...new Set(
                value
                  .map((v) => (typeof v === "string" ? stripSkillFormatting(v) : v))
                  .filter(Boolean)
              ),
            ]
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
