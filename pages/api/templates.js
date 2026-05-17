import fs from "fs";
import path from "path";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const templatesDir = path.join(process.cwd(), "templates");
    const files = fs.readdirSync(templatesDir);
    
    // Filter only .html files and create template objects
    const DISPLAY_NAMES = {
      Resume: "Classic",
      "Resume-Professional-Sans": "Professional Sans",
      "Resume-Executive-Minimal": "Executive Minimal",
      "Resume-Staff-Technical": "Staff Technical",
    };

    const SORT_PRIORITY = [
      "Resume-Professional-Sans",
      "Resume-Executive-Minimal",
      "Resume-Staff-Technical",
      "Resume",
    ];

    const templates = files
      .filter((file) => file.endsWith(".html"))
      .map((file) => {
        const id = file.replace(".html", "");
        let name = DISPLAY_NAMES[id];
        if (!name) {
          name = id.replace("Resume-", "").replace(/-/g, " ");
        }
        return { id, name, file };
      })
      .sort((a, b) => {
        const ai = SORT_PRIORITY.indexOf(a.id);
        const bi = SORT_PRIORITY.indexOf(b.id);
        if (ai !== -1 || bi !== -1) {
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        }
        return a.name.localeCompare(b.name);
      });

    res.status(200).json(templates);
  } catch (error) {
    console.error("Error loading templates:", error);
    res.status(500).json({ error: "Failed to load templates" });
  }
}

