import express from "express";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import axios from "axios";

dotenv.config();

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
app.use(express.json());

// ---------- Helper: Google Shopping via Serper (India-specific) ----------
async function searchGoogleShopping(query) {
  try {
    const response = await axios.post(
      "https://google.serper.dev/shopping",
      {
        q: query,
        gl: "in",
        hl: "en",
      },
      {
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const items = response.data.shopping || [];
    return items.slice(0, 5).map((item) => ({
      title: item.title,
      price: item.price,
      source: item.source,
      link: item.link,
    }));
  } catch (err) {
    console.error("❌ Serper API error:", err.message);
    return [];
  }
}

// ---------- OpenAI Outfit Analysis with Gender ----------
async function analyzeOutfit(imagePath) {
  console.log(`🧥 Analyzing ${imagePath}...`);

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found at: ${imagePath}`);
  }

  const imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
Analyze this outfit image and return JSON strictly in this format:

{
  "items": [
    {
      "gender": "male or female or unisex",
      "item_name": "generic name like tshirt, jeans, jacket, shoes, belt, sunglasses, etc.",
      "search_phrase": "one natural 8–10 word Google-style search sentence describing this exact product including gender, color, fit, neckline, sleeve length, texture/material, visible logo or text, and article type. No punctuation or full stops"
    }
  ]
}

Guidelines:
- Include all clearly visible items (tops, pants, jackets, skirts, dresses, shoes, bags, belts, watches, sunglasses, jewelry, etc.).
- Be specific but concise.
- Keep search_phrase human and natural (how someone would actually type into Google).
- Return only valid JSON — no extra text, commentary, or markdown.
`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
  });

  const raw = response.choices[0].message.content;
  // Parse JSON safely
  let parsedItems = [];
  try {
    const parsedJson = JSON.parse(raw);
    parsedItems = parsedJson.items || [];
  } catch (err) {
    console.error("❌ Error parsing OpenAI response:", err.message);
  }

  console.log(`✅ Parsed items: ${parsedItems.length}`);
  return parsedItems;
}

// ---------- Helper: Save results to file ----------
function saveResultsToFile(results) {
  const outputPath = path.join(process.cwd(), "result.txt");

  let content = "🇮🇳 👕 Outfit Analysis Results (India)\n\n";
  results.forEach((r, idx) => {
    content += `#${idx + 1}. ${r.gender || "Unisex"} - ${r.item_name}\n`;
    if (r.shopping.length > 0) {
      r.shopping.forEach((prod, i) => {
        content += `   ${i + 1}) ${prod.title}\n`;
        content += `      💰 Price: ${prod.price || "N/A"}\n`;
        content += `      🛍️ Source: ${prod.source || "Unknown"}\n`;
        content += `      🔗 Link: ${prod.link}\n\n`;
      });
    } else {
      content += "   ⚠️ No Indian products found.\n\n";
    }
  });

  fs.writeFileSync(outputPath, content, "utf-8"); // overwrite file
  console.log(`📝 Results saved to: ${outputPath}`);
}

// ---------- Main API ----------
app.post("/scan", async (req, res) => {
  try {
    const imagePath = path.join(process.cwd(), "uploads/outfit.png");
    const items = await analyzeOutfit(imagePath);

    const results = [];
    for (const item of items) {
      console.log(`🔍 Searching in India for: ${item.search_phrase}`);
      const searchResults = await searchGoogleShopping(item.search_phrase);
      results.push({ ...item, shopping: searchResults });
    }

    saveResultsToFile(results);

    res.json({
      success: true,
      message: "Outfit analyzed and saved to result.txt ✅",
      file: "result.txt",
    });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- Root Route ----------
app.get("/", (req, res) => {
  res.send(
    "<h2>🧥 Outfit Scanner API (India) with Gender is running! Use POST /scan</h2>"
  );
});

// ---------- Start Server ----------
app.listen(3000, () =>
  console.log("✅ Server running on http://localhost:3000")
);
