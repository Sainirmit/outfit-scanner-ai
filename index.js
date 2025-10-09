import express from "express";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());

/* ------------------------ 🔍 Helper: Google Search via Serper ------------------------ */
async function searchProductLinks(query) {
  // limit query length to 250 chars
  const cleanQuery = query.replace(/\./g, "").slice(0, 250);

  let response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: `${cleanQuery} buy online India`,
    }),
  });

  let data = await response.json();
  let results = filterBuyableLinks(data.organic || []);

  if (results.length === 0) {
    // fallback: search directly on popular ecommerce sites
    response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: `${cleanQuery} site:myntra.com OR site:ajio.com OR site:tatacliq.com OR site:amazon.in OR site:nykaafashion.com OR site:flipkart.com`,
      }),
    });

    data = await response.json();
    results = filterBuyableLinks(data.organic || []);
  }

  return results.slice(0, 3).map((r) => ({
    title: r.title,
    link: r.link,
    snippet: r.snippet,
  }));
}

/* ------------------------ 🧹 Helper: Filter for "Buyable" URLs ------------------------ */
function filterBuyableLinks(links) {
  const buyableWords = [
    "/product",
    "/shop",
    "/buy",
    "/p/",
    "/store",
    "/collections",
  ];
  const excludeDomains = [
    "pinterest",
    "blogspot",
    "lookbook",
    "vogue",
    "reddit",
    "facebook",
    "instagram",
  ];

  return links.filter((r) => {
    const url = r.link.toLowerCase();
    return (
      !excludeDomains.some((b) => url.includes(b)) &&
      buyableWords.some((word) => url.includes(word))
    );
  });
}

/* ------------------------ 🧠 Helper: Generate Human Search Phrases ------------------------ */
async function analyzeOutfit(imagePath) {
  console.log(`🖼️ Analyzing ${imagePath}...`);
  const imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are a professional fashion image analysis assistant.
Identify every distinct visible clothing or accessory item in the outfit — including tops, bottoms, outerwear, shoes, bags, belts, and jewelry.
Your goal is to describe each item precisely enough that a person could search it on Google or a shopping site and find a very similar product.`,
      },
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
      "item_name": "generic name like tshirt, jeans, jacket, shoes, belt, sunglasses, etc.",
      "search_phrase": "one natural 8–10 word Google-style search sentence describing this exact product including color, fit, neckline, sleeve length, texture/material, visible logo or text, and article type. No punctuation or full stops."
    }
  ]
}

Guidelines:
- Include all clearly visible items (tops, pants, jackets, skirts, dresses, shoes, bags, belts, watches, sunglasses, jewelry, etc.).
- Be specific but concise.
- Keep search_phrase human and natural (how someone would actually type into Google).
- Do not include sizes, brands, or prices.
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
    response_format: { type: "json_object" },
  });

  console.log(`🔍 Raw API Response: ${response.choices[0].message.content}`);

  const jsonResponse = response.choices[0].message.content;
  const parsed = JSON.parse(jsonResponse);
  return parsed.items || [];
}

/* ------------------------ 🚀 Main Route ------------------------ */
app.get("/scan", async (req, res) => {
  try {
    const uploadsDir = path.join(process.cwd(), "uploads");
    const files = fs.readdirSync(uploadsDir);
    if (files.length === 0)
      return res.status(400).send("No images found in uploads folder.");

    const allResults = [];

    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const outfitItems = await analyzeOutfit(filePath);

      const outfitWithLinks = [];
      for (const item of outfitItems) {
        const links = await searchProductLinks(item.search_phrase);
        outfitWithLinks.push({ ...item, links });
      }

      allResults.push({ file, outfit: outfitWithLinks });
    }

    res.json(allResults);
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).send(err.message);
  }
});

/* ------------------------ 🌐 Start Server ------------------------ */
app.listen(3000, () =>
  console.log("✅ Server running on http://localhost:3000")
);
