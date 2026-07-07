export const HTML_TEMPLATE_CSS = `:root{
  --heading: #10233a;
  --text: #2a3b50;
  --muted: #627286;
  --line: #d9e3ed;
  --accent: #1768c2;
  --accent-dark: #0f4c8d;
  --accent-soft: #eef5ff;
  --paper: #fbfdff;
  --surface: #ffffff;
}
*{
  box-sizing: border-box;
}
html,
body{
  margin: 0;
  padding: 0;
  background: #fff;
  color: var(--text);
}
body{
  font-family: "Aptos", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  font-size: 10.95pt;
  line-height: 1.5;
  max-width: 820px;
  margin: 0 auto;
  padding: 26px 24px 30px;
  background: #fff;
}
a{
  color: var(--accent-dark);
  text-decoration: none;
  border-bottom: 1px solid #c9daf0;
}
.name{
  margin: 0;
  font-size: 31pt;
  line-height: 1.02;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--heading);
}
.title{
  display: inline-block;
  margin-top: 8px;
  padding: 5px 12px 6px;
  font-size: 10.6pt;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent-dark);
  background: #fff;
  border: 1px solid #cedef3;
  border-right: 4px solid var(--accent);
}
.contact{
  margin-top: 14px;
  padding: 10px 12px;
  font-size: 10.15pt;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 0 12px 12px 12px;
  background: linear-gradient(90deg, #fff, var(--accent-soft));
}
.section{
  margin-top: 17px;
}
.section-title{
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
  font-size: 9.8pt;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #56687b;
}
.section-title::before{
  content: "";
  width: 24px;
  height: 5px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), #80b4ea);
}
.section-title::after{
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, #bed1e8, transparent);
}
p{
  margin: 0 0 10px;
}
.skills div{
  margin-bottom: 6px;
  padding: 7px 10px;
  border: 1px solid #e1e8f1;
  border-right: 3px solid #cadaf0;
  border-radius: 8px;
  background: var(--surface);
}
.certifications-list{
  padding: 8px 10px;
  border: 1px solid #e1e8f1;
  border-left: 4px solid #bfd4ec;
  border-radius: 8px;
  background: var(--surface);
  font-size: 10.15pt;
  color: var(--text);
  line-height: 1.45;
}
.certification-item{
  margin-bottom: 3px;
}
.certification-item:last-child{
  margin-bottom: 0;
}
.job-project{
  margin: 6px 0 8px;
  padding: 7px 10px;
  font-size: 10.05pt;
  line-height: 1.45;
  color: var(--text);
  border: 1px solid #e3ebf4;
  border-left: 4px solid var(--accent);
  border-radius: 8px;
  background: #f8fbff;
}
.job-project b{
  color: var(--heading);
}
.job{
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid #dde6ef;
}
.job:last-of-type{
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: 0;
}
.job-title{
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  font-weight: 800;
  color: var(--heading);
}
.company{
  color: var(--muted);
  font-style: normal;
  font-weight: 700;
}
.date{
  margin-left: auto;
  white-space: nowrap;
  padding: 2px 8px;
  font-size: 9.2pt;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--accent-dark);
  border: 1px solid #cedef3;
  border-radius: 999px;
  background: #fff;
}
ul{
  margin: 5px 0 0 18px;
  padding: 0;
}
li{
  margin-bottom: 5px;
}
li::marker{
  color: var(--accent);
}
.education{
  padding: 10px 11px;
  border: 1px solid var(--line);
  border-left: 4px solid #bfd4ec;
  border-radius: 10px;
  background: var(--surface);
}
@media (max-width: 700px){
  body{
    padding: 18px 16px 20px;
    font-size: 10.4pt;
    background: #fff;
  }
  .name{
    font-size: 24pt;
  }
  .title{
    font-size: 10.1pt;
    letter-spacing: 0.11em;
  }
  .section-title{
    display: block;
  }
  .section-title::after{
    display: none;
  }
  .job-title{
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
  }
  .date{
    margin-left: 0;
    margin-top: 4px;
  }
}
@media print{
  @page{
    margin: 11mm;
  }
  html,
  body{
    background: #fff;
    color: var(--text);
  }
  *,
  *::before,
  *::after{
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body{
    max-width: none;
    margin: 0;
    padding: 0;
    font-size: 10.2pt;
    line-height: 1.35;
    background: #fff;
  }
  a{
    border-bottom: 0;
  }
  .title{
    background: #fff;
    letter-spacing: 0.03em;
    text-transform: none;
    word-spacing: 0;
  }
  .contact,
  .skills div,
  .certifications-list,
  .job-project,
  .education{
    background: var(--surface);
  }
  .section{
    margin-top: 14px;
  }
  .section-title{
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    letter-spacing: 0.12em;
    color: #546578;
  }
  .section-title::before{
    content: "";
    display: block;
    width: 18px;
    height: 3px;
    flex: 0 0 auto;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--accent), #80b4ea);
  }
  .section-title::after{
    content: "";
    display: block;
    flex: 1;
    height: 1px;
    border-top: 0;
    background: linear-gradient(90deg, #bed1e8, transparent);
  }
  .job{
    margin-bottom: 10px;
    padding-bottom: 8px;
  }
  .job-title{
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    width: 100%;
  }
  .date{
    display: inline-block;
    margin-left: auto;
    white-space: nowrap;
    padding: 2px 8px;
    border: 1px solid #cedef3;
    border-radius: 999px;
    background: #fff;
    font-size: 9.2pt;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--accent-dark);
    text-align: right;
  }
}`;

export function buildHtmlShell(profileName, bodyInner) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${profileName || "Resume"}</title>
<style>
${HTML_TEMPLATE_CSS}
</style>
</head>
<body>
${bodyInner}
</body>
</html>`;
}
