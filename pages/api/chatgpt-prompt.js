import fs from "fs";
import path from "path";

// Inline require avoids Next.js dev webpack chunk issues with lib/ re-exports.
const { buildChatGptPrompt } = require("../../lib/chatgpt-prompt");
const {
  FEDERAL_CLEARANCE_MESSAGE,
  isFederalOrClearanceJobByRegex,
} = require("../../lib/jd-eligibility");

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { profile: profileId, jobTitle, jd, companyName } = req.body || {};

    if (!profileId) {
      return res.status(400).json({ error: "Profile is required" });
    }
    if (!jd || !String(jd).trim()) {
      return res.status(400).json({ error: "Job description is required" });
    }

    if (isFederalOrClearanceJobByRegex(jd, companyName, jobTitle)) {
      return res.status(400).json({ error: FEDERAL_CLEARANCE_MESSAGE });
    }

    const profilePath = path.join(process.cwd(), "resumes", `${profileId}.json`);
    if (!fs.existsSync(profilePath)) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const profileData = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
    const prompt = buildChatGptPrompt(profileData, jobTitle, jd);

    res.status(200).json({ prompt, length: prompt.length });
  } catch (error) {
    console.error("ChatGPT prompt build error:", error);
    res.status(500).json({ error: "Failed to build prompt" });
  }
}
