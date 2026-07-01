import fs from "fs";
import path from "path";
import {
  buildPdfFilename,
  htmlToPdfBuffer,
  resolveResumeHtml,
  validateResumeHtml,
} from "../../lib/pdf";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const { html: rawHtml, profile: profileId, jobTitle, companyName } = req.body || {};

    let profileName = "Resume";
    if (profileId) {
      const profilePath = path.join(process.cwd(), "resumes", `${profileId}.json`);
      if (fs.existsSync(profilePath)) {
        const profileData = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
        profileName = profileData.name || profileName;
      }
    }

    const resolved = resolveResumeHtml(rawHtml, profileName);
    if (!resolved.ok) {
      return res.status(400).send(resolved.error);
    }

    const validation = validateResumeHtml(resolved.html);
    if (!validation.ok) {
      return res.status(400).send(validation.error);
    }

    const pdfBuffer = await htmlToPdfBuffer(validation.html);
    const filename = buildPdfFilename(profileName, companyName, jobTitle);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.end(pdfBuffer);
  } catch (err) {
    console.error("HTML to PDF error:", err);
    res.status(500).send("PDF generation failed: " + err.message);
  }
}
