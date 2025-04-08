const express = require("express");
const app = express();
const path = require("path");
const langdetect = require("langdetect");
const ejsMate = require("ejs-mate");
const fs = require("fs");
const { exec, spawn } = require("child_process");
const { getTranscript, listTranscripts } = require("youtube-transcript-api");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/public")));

const puppeteer = require("puppeteer");

// PDF DOWNLOAD
app.post("/download-pdf", async (req, res) => {
  const summary = decodeURIComponent(req.body.summaryContent || "");
  const htmlFormatted = summary
  .replace(/^### (.*$)/gim, '<h3>$1</h3>')
  .replace(/^## (.*$)/gim, '<h2>$1</h2>')
  .replace(/\*\*(.+?)\*\*/gim, '<strong>$1</strong>')
  .replace(/^\*{1}(.+?)\*{1}$/gim, '<strong>$1</strong>')
  .replace(/^- (.+)$/gim, '<li>$1</li>')
  .replace(/\n{2,}/g, '</p><p>')  // paragraph break
  .replace(/\n/g, ' ');           // prevent <br> clutter

  const html = `
    <html>
      <head>
        <style>
          body {
  font-family: Arial, sans-serif;
  padding: 20px;
  font-size: 15px;
  line-height: 1.4;
}

p {
  margin-bottom: 10px;
}

li {
  margin-bottom: 4px;
}

          h2, h3 {
            color: #2c3e50;
            margin-top: 20px;
          }
          p {
            margin-bottom: 15px;
          }
          li {
            margin-bottom: 8px;
          }
          ul {
            padding-left: 20px;
          }
        </style>
      </head>
      <body>
      ${htmlFormatted}

      </body>
    </html>
  `;

  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=summary.pdf");
    res.send(pdfBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).send("PDF generation failed.");
  }
});

// YOUTUBE VIDEO ID EXTRACTOR
function extractVideoId(url) {
    const regex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/;
    const match = url.match(regex);
    if (!match) {
        throw new Error("Invalid YouTube URL");
    }
    return match[1];
}

// ROUTES
app.get("/", (req, res) => {
  res.render("listings/index");
});

app.get("/dashboard", (req, res) => {
  res.redirect("/");
});

app.get("/about", (req, res) => {
  res.render("listings/about");
});

app.get("/contact", (req, res) => {
  res.render("listings/contact");
});
app.post("/getTranscript", async (req, res) => {
  const youtubeUrl = req.body.url;
  const videoId = extractVideoId(youtubeUrl);
  const summaryLang = req.body.summaryLang; // get language selection

  if (!videoId) {
    return res.status(400).send("Invalid YouTube URL");
  }

  const pythonPath = "C:\\Users\\niles\\AppData\\Local\\Programs\\Python\\Python313\\python.exe";

  exec(`${pythonPath} transcript.py ${videoId}`, { timeout: 15000 }, (error, stdout, stderr) => {
    if (error) {
      console.error("Transcript error:", stderr);
      return res.render("listings/summary", {
        summary: "Transcript failed. Try again.",
        detectedLanguage: "unknown"
      });
    }

    let result;
    try {
      result = JSON.parse(stdout);
    } catch (err) {
      console.error("JSON Parse Error:", err);
      return res.render("listings/summary", {
        summary: "Invalid response from transcript.",
        detectedLanguage: "unknown"
      });
    }

    if (result.error) {
      return res.render("listings/summary", {
        summary: "Transcript could not be fetched.",
        detectedLanguage: "unknown"
      });
    }

    const summarizer = spawn(pythonPath, ['summarize.py']);
    let summaryOut = '';
    let summaryErr = '';

    summarizer.stdout.on('data', (data) => {
      summaryOut += data.toString();
    });

    summarizer.stderr.on('data', (data) => {
      summaryErr += data.toString();
    });

    summarizer.on('close', (code) => {
      if (code !== 0) {
        console.error("Summarizer error:", summaryErr);
        return res.render("listings/summary", {
          summary: "Gemini failed to summarize. Please try again later.",
          detectedLanguage: result.language
        });
      }

      res.render("listings/summary", {
        summary: summaryOut,
        detectedLanguage: result.language
      });
    });

    // 🔄 DYNAMIC LANGUAGE PROMPT
    let prompt = `
You are an expert in extracting *insightful, structured, and well-presented notes* from a YouTube video transcript. Below is the transcript of the video:

### *Transcript:*
${result.text}

---

## *Your Task:*
Generate a *detailed, well-structured, and engaging summary* from this transcript in ${
      summaryLang === "hinglish"
        ? "Hinglish (Hindi written in Roman English script)"
        : "English"
    }, covering everything from *basics to advanced* concepts in an easy-to-understand and interesting way. 

The summary should be so *clear, engaging, and insightful* that even a beginner can follow along, while still providing value to advanced learners.

### *Formatting Guidelines:*
- *Use structured headings and subheadings* (##, ###) to make it easy to navigate.
- *Break down complex concepts into simple explanations* before diving into deeper insights.
- *Use bold text for key concepts* to highlight important points.
- *Include real-world applications and examples* to make the content relatable.
- *Use bullet points (-) and numbered lists (1., 2., 3.)* for clarity.
- *Provide formulas, technical terms, and methodologies* with easy explanations.
- *Ensure proper spacing and formatting* for readability.
- *Make it engaging!* The tone should feel natural, as if an expert is explaining things in a way that keeps the reader hooked.

### *Topic-Specific Adaptation:*
- *Science & Engineering:* Explain fundamental principles, laws, and real-world applications.
- *Mathematics & Data Science:* Break down formulas, techniques, and problem-solving methods.
- *Business & Finance:* Summarize strategies, trends, and key financial principles.
- *Technology & AI:* Explain algorithms, coding practices, and architectures.
- *History & Social Sciences:* Give historical overviews and societal impacts.
- *Self-Improvement & Psychology:* Extract actionable insights and mindset shifts.
- *Health & Fitness:* Summarize routines, diet plans, and scientific concepts.
- *Entertainment & Media:* Analyze storytelling techniques and artistic themes.

---

## *Important Rules:*
- if the provided content has no transcripts then give a polite error that either you didn’t provide a correct URL or the provided video is not in a supported language.
- *Greet the user naturally* in first person (e.g., "Let's dive into this topic!" or "Here's a clear breakdown for you.").
- *Do NOT mention that this summary is based on a transcript.*
- *Ensure the response is detailed, structured, and visually appealing* (without unnecessary emojis or awkward characters).
- if required, use proper comparisons using tables.
- *Cover everything from basics to advanced concepts in a progressive manner.*
`;

    summarizer.stdin.write(prompt);
    summarizer.stdin.end();
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
