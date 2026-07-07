import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import puppeteer from "puppeteer";
import { buildHtmlShell } from "./resume-shell";
import { clampBoldInResumeHtml } from "./bold-formatting.js";

export async function htmlToPdfBuffer(html) {
  const browser =
    process.env.NODE_ENV === "production"
      ? await puppeteerCore.launch({
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        })
      : await puppeteer.launch({ headless: "new" });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "11mm",
        bottom: "11mm",
        left: "0mm",
        right: "0mm",
      },
    });
  } finally {
    await browser.close();
  }
}

export function sanitizeFilenamePart(str) {
  return str ? str.replace(/\s+/g, "").replace(/[^A-Za-z0-9]/g, "") : "";
}

export function buildPdfFilename(profileName, companyName, jobTitle) {
  let baseName = sanitizeFilenamePart(profileName) || "resume";
  const sanitizedCompany = sanitizeFilenamePart(companyName);
  const sanitizedJobTitle = sanitizeFilenamePart(jobTitle);
  if (sanitizedCompany) baseName += `_${sanitizedCompany}`;
  if (sanitizedJobTitle) baseName += `_${sanitizedJobTitle}`;
  return `${baseName}.pdf`;
}

/** Extract HTML from pasted ChatGPT output (code block or raw). */
export function normalizePastedHtml(raw) {
  if (typeof raw !== "string") return "";
  let text = raw.trim();

  const blockMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (blockMatch) {
    text = blockMatch[1].trim();
  }

  return text;
}

function isFullDocument(html) {
  const lower = html.toLowerCase().trim();
  return (
    lower.startsWith("<!doctype html") ||
    lower.startsWith("<html") ||
    (lower.includes("<html") && lower.includes("</html>"))
  );
}

function looksLikeBodyContent(html) {
  const lower = html.toLowerCase();
  return (
    lower.includes('class="name"') ||
    lower.includes("class='name'") ||
    (lower.includes('class="section"') && lower.includes('class="job"'))
  );
}

function extractBodyInner(html) {
  let inner = html.trim();
  const bodyMatch = inner.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) return bodyMatch[1].trim();
  return inner;
}

function stripBoldFromSkillItems(html) {
  if (typeof html !== "string" || !html) return html;

  return html.replace(
    /(<div class="section skills"[\s\S]*?)(<div class="section"[\s>])/i,
    (match, skillsBlock, nextSection) => {
      const cleaned = skillsBlock.replace(
        /(<div><b>[^<]+:<\/b>\s*)([\s\S]*?)(<\/div>)/gi,
        (_, label, items, close) => {
          const plain = items
            .replace(/<\/?(?:strong|b)>/gi, "")
            .replace(/\*\*([^*]+)\*\*/g, "$1");
          return `${label}${plain}${close}`;
        }
      );
      return cleaned + nextSection;
    }
  );
}

/** Merge body-only paste with fixed CSS shell, or pass through full documents. */
export function resolveResumeHtml(pasted, profileName = "Resume") {
  const normalized = normalizePastedHtml(pasted);

  if (isFullDocument(normalized)) {
    return { ok: true, html: stripBoldFromSkillItems(clampBoldInResumeHtml(normalized)) };
  }

  if (looksLikeBodyContent(normalized)) {
    const bodyInner = stripBoldFromSkillItems(clampBoldInResumeHtml(extractBodyInner(normalized)));
    return { ok: true, html: buildHtmlShell(profileName, bodyInner) };
  }

  const preview = normalized.slice(0, 200).replace(/\s+/g, " ");
  return {
    ok: false,
    error: `Expected a \`\`\`html code block with resume body content, or a full HTML document. Received: "${preview}${normalized.length > 200 ? "…" : ""}"`,
  };
}

export function validateResumeHtml(html) {
  const trimmed = html.trim();
  if (!trimmed) {
    return { ok: false, error: "HTML is empty. Paste the ChatGPT code block output." };
  }

  const lower = trimmed.toLowerCase();
  const looksLikeHtml =
    lower.startsWith("<!doctype html") ||
    lower.startsWith("<html") ||
    (lower.includes("<html") && lower.includes("</html>"));

  if (!looksLikeHtml) {
    const preview = trimmed.slice(0, 200).replace(/\s+/g, " ");
    return {
      ok: false,
      error: `Invalid HTML document after merge. Received: "${preview}${trimmed.length > 200 ? "…" : ""}"`,
    };
  }

  return { ok: true, html: trimmed };
}
