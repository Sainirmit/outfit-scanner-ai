// import puppeteer from "puppeteer-extra";
// import StealthPlugin from "puppeteer-extra-plugin-stealth";

// puppeteer.use(StealthPlugin());

// export async function getGoogleShoppingProducts(query, limit = 10) {
//   const browser = await puppeteer.launch({
//     headless: true,
//     args: ["--no-sandbox", "--disable-setuid-sandbox"],
//   });

//   try {
//     const page = await browser.newPage();
//     await page.setViewport({ width: 1280, height: 800 });
//     await page.setUserAgent(
//       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
//     );

//     const url = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(
//       query
//     )}&hl=en&gl=in`;

//     await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });

//     await page.waitForSelector("div.sh-dgr__grid-result", { timeout: 60000 });

//     let products = [];
//     for (let attempt = 0; attempt < 3; attempt++) {
//       try {
//         products = await page.evaluate((limit) => {
//           const items = [];
//           const cards = document.querySelectorAll("div.sh-dgr__grid-result");
//           for (let i = 0; i < cards.length && i < limit; i++) {
//             const card = cards[i];
//             const title = card.querySelector("h4,h3")?.innerText || "";
//             let link = card.querySelector("a")?.href || "";
//             const imageUrl = card.querySelector("img")?.src || "";
//             const price = card.querySelector("span.a8Pemb")?.innerText || "";

//             if (link.includes("url?q=")) {
//               const match = link.match(/url\?q=(.*?)&/);
//               if (match && match[1]) link = decodeURIComponent(match[1]);
//             }

//             if (title && link) items.push({ title, link, imageUrl, price });
//           }
//           return items;
//         }, limit);

//         if (products.length > 0) break;
//         await page.reload({ waitUntil: "domcontentloaded" });
//         await page.waitForTimeout(3000);
//       } catch {}
//     }

//     await browser.close();
//     return products;
//   } catch (err) {
//     await browser.close();
//     console.error("❌ Puppeteer Google Shopping error:", err.message);
//     return [];
//   }
// }
