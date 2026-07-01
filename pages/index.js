import { useState, useEffect } from "react";

const MODES = {
  OPENAI: "openai",
  CHATGPT: "chatgpt",
};

function sanitizeFilenamePart(str) {
  return str ? str.replace(/\s+/g, "").replace(/[^A-Za-z0-9]/g, "") : "";
}

function buildDownloadName(profiles, selectedProfile, companyName, jobTitle) {
  const profile = profiles.find((p) => p.id === selectedProfile);
  const profileName = profile ? profile.name : "Profile";
  let baseName = sanitizeFilenamePart(profileName);
  const sanitizedCompany = sanitizeFilenamePart(companyName);
  const sanitizedJobTitle = sanitizeFilenamePart(jobTitle);
  if (sanitizedCompany) baseName += `_${sanitizedCompany}`;
  if (sanitizedJobTitle) baseName += `_${sanitizedJobTitle}`;
  return `${baseName}.pdf`;
}

function triggerDownload(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
}

const fieldStyles = {
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    fontSize: "15px",
    fontFamily: "inherit",
    color: "#f1f5f9",
    background: "rgba(30, 41, 59, 0.55)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "12px",
    outline: "none",
    transition: "all 0.2s ease",
  },
  textarea: {
    width: "100%",
    padding: "16px",
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', monospace",
    color: "#e2e8f0",
    background: "rgba(15, 23, 42, 0.65)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "12px",
    outline: "none",
    resize: "vertical",
    lineHeight: "1.65",
    transition: "all 0.2s ease",
  },
};

function focusHandlers(accent = "#22d3ee") {
  return {
    onFocus: (e) => {
      e.target.style.borderColor = accent;
      e.target.style.boxShadow = `0 0 0 3px ${accent}22`;
    },
    onBlur: (e) => {
      e.target.style.borderColor = "rgba(255, 255, 255, 0.1)";
      e.target.style.boxShadow = "none";
    },
  };
}

export default function Home() {
  const [mode, setMode] = useState(MODES.OPENAI);
  const [profiles, setProfiles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("Resume-Professional-Sans");
  const [jd, setJd] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [pastedHtml, setPastedHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [copyState, setCopyState] = useState("idle");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetch("/api/profiles")
      .then((res) => res.json())
      .then((data) => setProfiles(data))
      .catch((err) => console.error("Failed to load profiles:", err));

    fetch("/api/templates")
      .then((res) => res.json())
      .then((data) => setTemplates(data))
      .catch((err) => console.error("Failed to load templates:", err));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (message, type = "success") => setToast({ message, type });

  const validateCommon = () => {
    if (!selectedProfile) {
      showToast("Please select a profile", "error");
      return false;
    }
    if (!jd.trim()) {
      showToast("Please paste the job description", "error");
      return false;
    }
    return true;
  };

  const generateOpenAiPdf = async () => {
    if (loading || !validateCommon()) return;
    setLoading(true);

    try {
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: selectedProfile,
          jd,
          template: selectedTemplate,
          jobTitle,
          companyName,
        }),
      });

      if (!genRes.ok) {
        const errorText = await genRes.text();
        throw new Error(errorText || "Failed to generate PDF");
      }

      const blob = await genRes.blob();
      triggerDownload(blob, buildDownloadName(profiles, selectedProfile, companyName, jobTitle));
      showToast("Resume PDF downloaded");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const copyChatGptPrompt = async () => {
    if (loading || !validateCommon()) return;
    setLoading(true);
    setCopyState("loading");

    try {
      const res = await fetch("/api/chatgpt-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: selectedProfile,
          jobTitle: jobTitle.trim() || "",
          companyName: companyName.trim() || "",
          jd,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to build prompt");

      await navigator.clipboard.writeText(data.prompt);
      setCopyState("copied");
      showToast("Prompt copied — paste it into ChatGPT");
      setTimeout(() => setCopyState("idle"), 2500);
    } catch (error) {
      setCopyState("idle");
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const generateFromHtml = async () => {
    if (loading || !validateCommon()) return;
    if (!pastedHtml.trim()) {
      showToast("Paste the HTML output from ChatGPT", "error");
      return;
    }

    setLoading(true);

    try {
      const genRes = await fetch("/api/html-to-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: pastedHtml,
          profile: selectedProfile,
          jobTitle,
          companyName,
        }),
      });

      if (!genRes.ok) {
        const errorText = await genRes.text();
        throw new Error(errorText || "Failed to generate PDF");
      }

      const blob = await genRes.blob();
      triggerDownload(blob, buildDownloadName(profiles, selectedProfile, companyName, jobTitle));
      showToast("PDF created from ChatGPT HTML");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const isOpenAi = mode === MODES.OPENAI;
  const accent = isOpenAi ? "#22d3ee" : "#a78bfa";
  const accentSecondary = isOpenAi ? "#10b981" : "#6366f1";

  return (
    <>
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap");

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif;
          background: #0a0f1c;
          min-height: 100vh;
        }

        ::selection {
          background: #22d3ee;
          color: #0a0f1c;
        }

        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #1a1f2e;
        }
        ::-webkit-scrollbar-thumb {
          background: #3b4563;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #4b5573;
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0a0f1c 0%, #111827 50%, #0f172a 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-40%",
            left: "-15%",
            width: "640px",
            height: "640px",
            background: `radial-gradient(circle, ${isOpenAi ? "rgba(34, 211, 238, 0.09)" : "rgba(167, 139, 250, 0.09)"} 0%, transparent 70%)`,
            borderRadius: "50%",
            pointerEvents: "none",
            transition: "background 0.5s ease",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-25%",
            right: "-8%",
            width: "520px",
            height: "520px",
            background: `radial-gradient(circle, ${isOpenAi ? "rgba(16, 185, 129, 0.06)" : "rgba(99, 102, 241, 0.07)"} 0%, transparent 70%)`,
            borderRadius: "50%",
            pointerEvents: "none",
            transition: "background 0.5s ease",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "32px 20px 48px",
          }}
        >
          <div
            style={{
              maxWidth: isOpenAi ? "720px" : "860px",
              width: "100%",
              background: "rgba(17, 24, 39, 0.82)",
              backdropFilter: "blur(20px)",
              borderRadius: "24px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "0 25px 80px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
              padding: "40px 44px 44px",
              transition: "max-width 0.35s ease",
            }}
          >
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    background: `linear-gradient(135deg, ${accent} 0%, ${accentSecondary} 100%)`,
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "22px",
                    boxShadow: `0 8px 32px ${accent}44`,
                    transition: "all 0.35s ease",
                  }}
                >
                  {isOpenAi ? "⚡" : "✦"}
                </div>
                <h1
                  style={{
                    fontSize: "30px",
                    fontWeight: "700",
                    background: "linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    letterSpacing: "-0.5px",
                  }}
                >
                  Resume Tailor
                </h1>
              </div>
              <p style={{ fontSize: "14px", color: "#64748b", lineHeight: "1.6", maxWidth: "480px", margin: "0 auto" }}>
                {isOpenAi
                  ? "Automatic tailoring with OpenAI — profile, template, JD, instant PDF."
                  : "Manual ChatGPT flow — copy a crafted prompt, paste HTML back, export PDF."}
              </p>
            </div>

            {/* Mode toggle */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                padding: "6px",
                marginBottom: "28px",
                background: "rgba(15, 23, 42, 0.7)",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {[
                { id: MODES.OPENAI, label: "OpenAI", sub: "API key · auto PDF", icon: "⚡" },
                { id: MODES.CHATGPT, label: "ChatGPT", sub: "Copy prompt · paste HTML", icon: "💬" },
              ].map((m) => {
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "10px",
                      border: active ? `1px solid ${m.id === MODES.OPENAI ? "#22d3ee55" : "#a78bfa55"}` : "1px solid transparent",
                      background: active
                        ? m.id === MODES.OPENAI
                          ? "linear-gradient(135deg, rgba(34,211,238,0.15), rgba(16,185,129,0.12))"
                          : "linear-gradient(135deg, rgba(167,139,250,0.18), rgba(99,102,241,0.12))"
                        : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.25s ease",
                      fontFamily: "inherit",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "18px" }}>{m.icon}</span>
                      <div>
                        <div style={{ fontSize: "15px", fontWeight: "700", color: active ? "#f1f5f9" : "#94a3b8" }}>
                          {m.label}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{m.sub}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
              {/* Profile + Template */}
              <div style={{ display: "grid", gridTemplateColumns: isOpenAi ? "1fr 1fr" : "1fr", gap: "16px" }}>
                <div>
                  <label style={fieldStyles.label}>Profile</label>
                  <select
                    value={selectedProfile}
                    onChange={(e) => setSelectedProfile(e.target.value)}
                    style={{
                      ...fieldStyles.input,
                      color: selectedProfile ? "#f1f5f9" : "#64748b",
                      cursor: "pointer",
                    }}
                    {...focusHandlers(accent)}
                  >
                    <option value="">Select profile…</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id} style={{ background: "#1e293b" }}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </div>

                {isOpenAi && (
                  <div>
                    <label style={fieldStyles.label}>Template</label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      style={{ ...fieldStyles.input, cursor: "pointer" }}
                      {...focusHandlers(accent)}
                    >
                      {templates.map((template) => (
                        <option key={template.id} value={template.id} style={{ background: "#1e293b" }}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {!isOpenAi && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "rgba(167, 139, 250, 0.08)",
                    border: "1px solid rgba(167, 139, 250, 0.2)",
                    fontSize: "13px",
                    color: "#c4b5fd",
                    lineHeight: "1.5",
                  }}
                >
                  ChatGPT mode uses a fixed ATS template. CSS is applied automatically — paste only the body content from the <code style={{ color: "#ddd6fe" }}>```html</code> code block.
                </div>
              )}

              {/* Job title + company */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={fieldStyles.label}>{isOpenAi ? "Job Title" : "CV Title"}</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder={
                      isOpenAi
                        ? "e.g. Software Engineer"
                        : "Optional — leave blank to infer from JD"
                    }
                    style={{ ...fieldStyles.input, color: jobTitle ? "#f1f5f9" : "#64748b" }}
                    {...focusHandlers(accent)}
                  />
                </div>
                <div>
                  <label style={fieldStyles.label}>Target Company</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="For PDF filename only"
                    style={{ ...fieldStyles.input, color: companyName ? "#f1f5f9" : "#64748b" }}
                    {...focusHandlers(accent)}
                  />
                </div>
              </div>

              {/* JD */}
              <div>
                <label style={fieldStyles.label}>Job Description</label>
                <textarea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste the full job description…"
                  rows={isOpenAi ? 10 : 8}
                  style={{ ...fieldStyles.textarea, minHeight: isOpenAi ? "200px" : "160px" }}
                  {...focusHandlers(accent)}
                />
              </div>

              {/* Mode-specific actions */}
              {isOpenAi ? (
                <button
                  type="button"
                  onClick={generateOpenAiPdf}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "17px 24px",
                    fontSize: "16px",
                    fontWeight: "600",
                    fontFamily: "inherit",
                    color: loading ? "#64748b" : "#0a0f1c",
                    background: loading
                      ? "rgba(51, 65, 85, 0.5)"
                      : `linear-gradient(135deg, ${accent} 0%, ${accentSecondary} 100%)`,
                    border: "none",
                    borderRadius: "12px",
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: loading ? "none" : `0 8px 32px ${accent}40`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                  }}
                >
                  {loading ? <Spinner /> : "→"}
                  {loading ? "Generating…" : "Generate Tailored Resume"}
                </button>
              ) : (
                <>
                  <div
                    style={{
                      padding: "20px",
                      borderRadius: "16px",
                      background: "rgba(30, 41, 59, 0.35)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <StepBadge n={1} accent={accent} />
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: "700", color: "#e2e8f0" }}>Copy prompt to ChatGPT</div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          Builds rules + profile + JD + HTML template, then copies to clipboard
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={copyChatGptPrompt}
                      disabled={loading}
                      style={{
                        width: "100%",
                        padding: "15px 20px",
                        fontSize: "15px",
                        fontWeight: "600",
                        fontFamily: "inherit",
                        color: loading ? "#64748b" : "#f8fafc",
                        background: loading
                          ? "rgba(51, 65, 85, 0.5)"
                          : "linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)",
                        border: "none",
                        borderRadius: "11px",
                        cursor: loading ? "not-allowed" : "pointer",
                        boxShadow: loading ? "none" : "0 6px 24px rgba(124, 58, 237, 0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      {copyState === "loading" ? (
                        <Spinner light />
                      ) : copyState === "copied" ? (
                        "✓ Copied"
                      ) : (
                        "📋 Copy ChatGPT Prompt"
                      )}
                    </button>
                  </div>

                  <div
                    style={{
                      padding: "20px",
                      borderRadius: "16px",
                      background: "rgba(30, 41, 59, 0.35)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <StepBadge n={2} accent={accent} />
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: "700", color: "#e2e8f0" }}>Paste HTML & export PDF</div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          Paste the <code style={{ color: "#c4b5fd" }}>```html</code> code block (body content only — CSS is merged automatically)
                        </div>
                      </div>
                    </div>
                    <textarea
                      value={pastedHtml}
                      onChange={(e) => setPastedHtml(e.target.value)}
                      placeholder="```html&#10;<div class=&quot;name&quot;>…</div>&#10;…"
                      rows={12}
                      style={{
                        ...fieldStyles.textarea,
                        minHeight: "220px",
                        fontSize: "12px",
                      }}
                      {...focusHandlers("#a78bfa")}
                    />
                    <button
                      type="button"
                      onClick={generateFromHtml}
                      disabled={loading}
                      style={{
                        width: "100%",
                        padding: "15px 20px",
                        fontSize: "15px",
                        fontWeight: "600",
                        fontFamily: "inherit",
                        color: loading ? "#64748b" : "#0a0f1c",
                        background: loading
                          ? "rgba(51, 65, 85, 0.5)"
                          : `linear-gradient(135deg, ${accent} 0%, ${accentSecondary} 100%)`,
                        border: "none",
                        borderRadius: "11px",
                        cursor: loading ? "not-allowed" : "pointer",
                        boxShadow: loading ? "none" : `0 6px 24px ${accent}40`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      {loading ? <Spinner /> : "📄"}
                      {loading ? "Creating PDF…" : "Generate PDF from HTML"}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Footer stats */}
            <div
              style={{
                marginTop: "28px",
                padding: "18px",
                background: "rgba(30, 41, 59, 0.28)",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "12px",
                  textAlign: "center",
                }}
              >
                <Stat icon="🎯" title="ATS Optimized" sub="Keyword aligned" />
                <Stat icon={isOpenAi ? "⚡" : "💬"} title={isOpenAi ? "OpenAI API" : "ChatGPT Manual"} sub={isOpenAi ? "Fully automated" : "You run the model"} />
                <Stat icon="📄" title={isOpenAi ? "14 Templates" : "Body + CSS merge"} sub={isOpenAi ? "Professional styles" : "Shorter ChatGPT output"} />
              </div>
            </div>
          </div>
        </div>

        {toast && (
          <div
            style={{
              position: "fixed",
              bottom: "28px",
              left: "50%",
              transform: "translateX(-50%)",
              padding: "12px 20px",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "500",
              color: toast.type === "error" ? "#fecaca" : "#ecfdf5",
              background: toast.type === "error" ? "rgba(127, 29, 29, 0.92)" : "rgba(6, 78, 59, 0.92)",
              border: `1px solid ${toast.type === "error" ? "#fca5a5" : "#6ee7b7"}44`,
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
              zIndex: 100,
              maxWidth: "90vw",
              textAlign: "center",
            }}
          >
            {toast.message}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}

function Spinner({ light }) {
  return (
    <span
      style={{
        width: "18px",
        height: "18px",
        border: "2px solid transparent",
        borderTopColor: light ? "#e9d5ff" : "#64748b",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
        display: "inline-block",
      }}
    />
  );
}

function StepBadge({ n, accent }) {
  return (
    <div
      style={{
        width: "28px",
        height: "28px",
        borderRadius: "8px",
        background: `${accent}22`,
        border: `1px solid ${accent}55`,
        color: accent,
        fontSize: "13px",
        fontWeight: "800",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {n}
    </div>
  );
}

function Stat({ icon, title, sub }) {
  return (
    <div>
      <div style={{ fontSize: "22px", marginBottom: "6px" }}>{icon}</div>
      <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600" }}>{title}</div>
      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{sub}</div>
    </div>
  );
}
