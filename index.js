import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Utility: convert image file → base64
function imageToBase64(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString("base64");
}

// ✅ Function to generate outfit keywords
async function generateSearchPhrase(base64Image) {
  console.log("🧠 Generating search phrase using GPT...");

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini", // Visual model
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this outfit and return a short list of 3–5 search keywords for e-commerce use (e.g., 'white crop top', 'beige wide leg pants', 'chunky sneakers').",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
            },
          },
        ],
      },
    ],
  });

  return response.choices[0].message.content;
}

// ✅ Test endpoint (uses local image)
app.get("/testscan", async (req, res) => {
  try {
    const imagePath = path.join(process.cwd(), "uploads", "outfit.png");

    if (!fs.existsSync(imagePath)) {
      return res
        .status(404)
        .json({ error: "❌ outfit.png not found in uploads/" });
    }

    console.log("🖼️ Using test file:", imagePath);

    const base64Image = imageToBase64(imagePath);

    // Generate search phrase
    const searchPhrase = await generateSearchPhrase(base64Image);

    console.log("✨ GPT Output:", searchPhrase);

    res.json({
      message: "✅ Test scan complete",
      generated_keywords: searchPhrase,
    });
  } catch (error) {
    console.error("❌ Error in /testscan:", error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
