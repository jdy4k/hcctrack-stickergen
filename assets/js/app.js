/* HCC Sticker Sheet Generator -- CSV in, PDF out, all in the browser. */

const REQUIRED = ["name", "group", "sex", "event", "heat"];

const docHead = `
\\documentclass{article}
\\usepackage{geometry}
\\usepackage[utf8]{inputenc}

\\geometry{
    right=0.5cm,
    left=0.5cm,
    top=1.2cm,
    bottom=1.2cm,
}

\\setlength{\\parindent}{0pt}

\\newcommand{\\makeEntry}[5]{%
    \\begin{minipage}[b][2.5cm][t]{6.66cm}
        \\offinterlineskip
  \t\t  \\vspace*{\\fill}
\t\t    \\hspace*{\\fill}
        \\begin{tabular}{@{}p{4cm}@{}@{}p{2cm}@{}}
            #1 \\\\
            #2 & #3 \\\\
            #4 & #5 \\\\
        \\end{tabular}
        \\vspace*{\\fill}
\t\t    \\hspace*{\\fill}
    \\end{minipage}%
}

\\newcounter{stickerCount}
\\setcounter{stickerCount}{0}

\\newcommand{\\addSticker}[5]{%
    \\makeEntry{#1}{#2}{#3}{#4}{#5}%
    \\stepcounter{stickerCount}%
    \\ifnum\\value{stickerCount}=3
        \\\\ \\setcounter{stickerCount}{0}%
    \\else
      \\hspace{0.25cm}%
    \\fi
}

\\begin{document}
\\pagenumbering{gobble}
\\Large
\\sffamily
\\setlength{\\tabcolsep}{0pt}
`;

const docFoot = `\n\\end{document}\n`;

const escapeLatex = (v) =>
  String(v ?? "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");

const buildLatex = (rows) =>
  docHead +
  rows
    .map(
      (r) =>
        `\\addSticker{${escapeLatex(r.name)}}{${escapeLatex(r.group)}}{${escapeLatex(r.sex)}}{${escapeLatex(r.event)}}{${escapeLatex(r.heat)}}`
    )
    .join("\n") +
  docFoot;

const fileInput = document.getElementById("file-input");
const generateBtn = document.getElementById("generate-btn");
const statusEl = document.getElementById("status");
const downloadLink = document.getElementById("download-link");
const logEl = document.getElementById("log");

let rows = null;
let filename = "stickers";
let engine = null;

const setStatus = (msg, isError) => {
  statusEl.textContent = msg || "";
  statusEl.className = isError ? "error" : "";
};

fileInput.addEventListener("change", () => {
  setStatus("");
  logEl.hidden = true;
  downloadLink.hidden = true;
  generateBtn.disabled = true;
  rows = null;

  const file = fileInput.files[0];
  if (!file) return;
  filename = file.name.replace(/\.csv$/i, "");

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: ({ data, meta }) => {
      const missing = REQUIRED.filter((c) => !(meta.fields || []).includes(c));
      if (missing.length) return setStatus("Missing column(s): " + missing.join(", "), true);
      if (!data.length) return setStatus("CSV has no data rows.", true);
      rows = data;
      generateBtn.disabled = false;
      setStatus("Loaded " + rows.length + " row(s).");
    },
    error: (err) => setStatus("Could not read CSV: " + err.message, true),
  });
});

generateBtn.addEventListener("click", async () => {
  if (!rows) return;
  setStatus("Compiling...");
  logEl.hidden = true;
  downloadLink.hidden = true;
  generateBtn.disabled = true;

  try {
    if (!engine) {
      engine = new PdfTeXEngine();
      await engine.loadEngine();
    }
    engine.writeMemFSFile("main.tex", buildLatex(rows));
    engine.setEngineMainFile("main.tex");

    const result = await engine.compileLaTeX();
    if (result.status !== 0 || !result.pdf) {
      logEl.textContent = result.log || "(no log)";
      logEl.hidden = false;
      throw new Error("LaTeX compilation failed.");
    }

    downloadLink.href = URL.createObjectURL(
      new Blob([result.pdf], { type: "application/pdf" })
    );
    downloadLink.download = filename + ".pdf";
    downloadLink.hidden = false;
    setStatus("Done.");
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    generateBtn.disabled = !rows;
  }
});
