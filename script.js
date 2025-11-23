const inputText = document.getElementById("inputText");
const summarizeBtn = document.getElementById("summarizeBtn");
const summaryList = document.getElementById("summaryList");
const summaryLength = document.getElementById("summaryLength");
const originalTime = document.getElementById("originalTime");
const summaryTime = document.getElementById("summaryTime");
const copyBtn = document.getElementById("copyBtn");
const copyStatus = document.getElementById("copyStatus");
const fileInput = document.getElementById("fileInput");
const fileText = document.getElementById("fileText");
const spinner = document.getElementById("loadingSpinner");

function getReadingTime(text) {
  const wpm = 220;
  const words = text.trim().split(/s+/).length;
  return text.trim() ? Math.ceil(words / wpm) : 0;
}

function getKeywords(text) {
  const stopWords = new Set([
    "the","and","that","this","with","from","were","have","has","but","not","you","your","for","which","about","while","where","will","shall","they","these","there","would","could","should","their","then","been","what",
  ]);
  const words = text.toLowerCase().replace(/[^a-z0-9s]/g, "").split(/s+/);
  const freq = {};
  words.forEach((w) => {
    if (!stopWords.has(w) && w.length > 4) {
      freq[w] = (freq[w] || 0) + 1;
    }
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map((x) => x[0]);
}

function highlight(sentence, keywords) {
  let s = sentence;
  for (let k of keywords) {
    s = s.replace(new RegExp(`\\b${k}\\b`, "gi"), `<span class="keyword">${k}</span>`);
  }
  return s;
}

function summarize(text, mode) {
  const sentences = text.match(/[^.!?]+[.!?]/g) || [text];
  const keywords = getKeywords(text);
  if (mode === "points") {
    return sentences.filter((s) => keywords.some((k) => s.toLowerCase().includes(k))).slice(0, 10);
  }
  const freq = {};
  let words = text.toLowerCase().replace(/[^a-z0-9s]/g, "").split(/s+/);
  words.forEach((w) => (freq[w] = (freq[w] || 0) + 1));
  let scored = sentences.map((s, i) => {
    let score = 0;
    s.toLowerCase()
      .split(/s+/)
      .forEach((word) => {
        score += freq[word] || 0;
      });
    return { s, score, i };
  });
  let multiplier = { short: 0.15, medium: 0.25, long: 0.5 };
  let count = Math.max(2, Math.round(sentences.length * multiplier[mode]));
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

function renderSummary(list, originalText) {
  summaryList.innerHTML = "";
  const keywords = getKeywords(originalText);
  list.forEach((sentence) => {
    const li = document.createElement("li");
    li.innerHTML = highlight(sentence, keywords);
    summaryList.appendChild(li);
  });
  summaryTime.textContent = getReadingTime(list.join(" "));
}

summarizeBtn.addEventListener("click", () => {
  const text = inputText.value.trim();
  if (!text) return;
  spinner.classList.remove("hidden");
  setTimeout(() => {
    const list = summarize(text, summaryLength.value);
    originalTime.textContent = getReadingTime(text);
    renderSummary(list, text);
    spinner.classList.add("hidden");
  }, 160);
});

copyBtn.addEventListener("click", () => {
  const bullets = [...summaryList.querySelectorAll("li")].map((li) => "• " + li.innerText);
  navigator.clipboard.writeText(bullets.join(""));
  copyStatus.textContent = "Copied ✔";
  setTimeout(() => (copyStatus.textContent = ""), 1700);
});

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  fileText.textContent = file.name;
  spinner.classList.remove("hidden");
  try {
    if (file.name.toLowerCase().endsWith(".pdf")) {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((it) => it.str).join(" ") + "";
      }
      inputText.value = text.trim();
    } else if (file.name.toLowerCase().endsWith(".docx")) {
      if (window.mammoth) {
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        inputText.value = result.value || "Could not extract text (check file format).";
      } else {
        inputText.value = "DOCX support not initialized.";
      }
    } else {
      inputText.value = "Unsupported file format.";
    }
  } catch (err) {
    inputText.value = "File reading failed: " + err.message;
  }
  spinner.classList.add("hidden");
});

document.getElementById("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  document.getElementById("themeToggle").textContent = document.body.classList.contains("dark") ? "🌙" : "🌞";
});

const swatches = document.querySelectorAll(".color-swatch");
swatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    document.body.classList.remove("theme-red", "theme-green", "theme-purple");
    if (swatch.dataset.theme) {
      document.body.classList.add(swatch.dataset.theme);
    }
    swatches.forEach((s) => s.classList.remove("active"));
    swatch.classList.add("active");
  });
});
