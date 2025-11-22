// Average reading speed (words per minute)
const WPM = 220;

// Get elements
const inputTextEl = document.getElementById("inputText");
const summarizeBtn = document.getElementById("summarizeBtn");
const summaryLengthEl = document.getElementById("summaryLength");
const originalTimeEl = document.getElementById("originalTime");
const summaryTimeEl = document.getElementById("summaryTime");
const summaryListEl = document.getElementById("summaryList");
const copyBtn = document.getElementById("copyBtn");
const copyStatusEl = document.getElementById("copyStatus");

// PDF elements
const pdfInputEl = document.getElementById("pdfInput");
const pdfStatusEl = document.getElementById("pdfStatus");

// If you are using CDN, you do NOT need this block.
// If you use local files, uncomment and ensure paths match:
// if (window["pdfjsLib"]) {
//   pdfjsLib.GlobalWorkerOptions.workerSrc = "libs/pdf.worker.js";
// }

// ---------- Helpers ----------

// Limit how much text we summarize (to avoid huge PDFs)
function limitText(text, maxWords = 2000) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ");
}

// Clean noisy PDF text a bit
function cleanPdfText(text) {
  return text
    .replace(/\s+/g, " ")         // collapse multiple spaces/newlines
    .replace(/Page \d+/gi, "")    // remove "Page 1", "Page 2", etc.
    .replace(/\s{2,}/g, " ")      // extra spaces
    .trim();
}

// ---------- 1. Reading time ----------

function getReadingTime(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const minutes = Math.ceil(words.length / WPM) || 0;
  return minutes;
}

// ---------- 2. Very simple summarizer (extractive) ----------

function summarizeText(text, lengthOption) {
  // Split into sentences
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .filter(s => s.trim().length > 0);

  if (sentences.length === 0) return [];

  // Decide how many sentences based on length choice
  let ratio;
  if (lengthOption === "short") ratio = 0.1;      // more aggressive short mode
  else if (lengthOption === "long") ratio = 0.6;
  else ratio = 0.3;                               // medium

  const targetCount = Math.max(1, Math.round(sentences.length * ratio));

  // Build word frequency for scoring
  const stopwords = new Set([
    "the","is","am","are","a","an","of","to","and","in","on","for","with","that",
    "this","it","as","at","by","from","or","be","was","were","will","would",
    "can","could","has","have","had","we","you","they","he","she","i"
  ]);

  const wordFreq = {};
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w && !stopwords.has(w));

  words.forEach(w => {
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  });

  // Score each sentence
  const sentenceScores = sentences.map((sentence, idx) => {
    const sWords = sentence
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);

    let score = 0;
    sWords.forEach(w => {
      if (wordFreq[w]) score += wordFreq[w];
    });

    return { index: idx, sentence, score };
  });

  // Sort by score and take top N
  sentenceScores.sort((a, b) => b.score - a.score);
  const selected = sentenceScores
    .slice(0, targetCount)
    .sort((a, b) => a.index - b.index);

  return selected.map(s => s.sentence);
}

// ---------- 3. Keyword extraction for highlighting ----------

function getTopKeywords(text, limit = 5) {
  const stopwords = new Set([
    "the","is","am","are","a","an","of","to","and","in","on","for","with","that",
    "this","it","as","at","by","from","or","be","was","were","will","would",
    "can","could","has","have","had","we","you","they","he","she","i"
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w && !stopwords.has(w));

  const freq = {};
  words.forEach(w => {
    freq[w] = (freq[w] || 0) + 1;
  });

  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);

  return sorted;
}

function highlightSentence(sentence, keywords) {
  let result = sentence;
  keywords.forEach(word => {
    const regex = new RegExp(`\\b(${word})\\b`, "gi");
    result = result.replace(regex, `<span class="keyword">$1</span>`);
  });
  return result;
}

// ---------- 4. Main summarize button logic ----------

summarizeBtn.addEventListener("click", () => {
  let text = inputTextEl.value.trim();

  if (!text) {
    alert("Please paste some text or load a PDF first.");
    return;
  }

  // Limit text size for PDFs so summary isn't insanely long
  text = limitText(text, 2000);

  // Reading time for original
  const originalMinutes = getReadingTime(text);
  originalTimeEl.textContent = originalMinutes;

  // Get summary sentences
  const lengthOption = summaryLengthEl.value;
  const summarySentences = summarizeText(text, lengthOption);

  // Get keywords from full (limited) text for highlighting
  const keywords = getTopKeywords(text, 6);

  // Clear old summary
  summaryListEl.innerHTML = "";

  // Build list items
  const summaryTextCombined = summarySentences.join(" ");
  summarySentences.forEach(s => {
    const li = document.createElement("li");
    li.innerHTML = highlightSentence(s, keywords);
    summaryListEl.appendChild(li);
  });

  // Reading time for summary
  const summaryMinutes = getReadingTime(summaryTextCombined);
  summaryTimeEl.textContent = summaryMinutes;

  copyStatusEl.textContent = "";
});

// ---------- 5. Copy bullets ----------

copyBtn.addEventListener("click", async () => {
  const items = summaryListEl.querySelectorAll("li");
  if (items.length === 0) {
    copyStatusEl.textContent = "No summary to copy.";
    return;
  }

  const plainBullets = Array.from(items).map(li =>
    li.textContent.trim()
  );

  try {
    await navigator.clipboard.writeText(plainBullets.join("\n• "));
    copyStatusEl.textContent = "Copied!";
  } catch (err) {
    copyStatusEl.textContent = "Copy failed.";
  }
});

// ---------- 6. PDF → text (PDF.js) ----------

// If you're using the CDN version of PDF.js with a `pdfjsLib` global,
// `getDocument` and `getPage(...).getTextContent()` work like this.[web:71][web:76]

async function extractTextFromPdf(file) {
  pdfStatusEl.textContent = "Reading PDF...";
  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += strings.join(" ") + "\n\n";
  }

  // Clean up common PDF noise
  fullText = cleanPdfText(fullText);

  pdfStatusEl.textContent = "PDF loaded ✓";
  return fullText;
}

pdfInputEl.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.type !== "application/pdf") {
    pdfStatusEl.textContent = "Please select a PDF file.";
    return;
  }

  try {
    const text = await extractTextFromPdf(file);
    inputTextEl.value = text;
  } catch (err) {
    console.error(err);
    pdfStatusEl.textContent = "Failed to read PDF.";
  }
});
