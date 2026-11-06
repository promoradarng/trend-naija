// Posts the owner's newly added Trend Naija stories to the Facebook Page.
// Run by .github/workflows/facebook.yml after each push to main.
// Needs repo secrets FB_PAGE_ID and FB_PAGE_TOKEN (a long-lived Page access token).
const fs = require("fs");
const { execSync } = require("child_process");

const SITE = "https://trendnaija.com";
const { FB_PAGE_ID, FB_PAGE_TOKEN, BEFORE_SHA } = process.env;
if (!FB_PAGE_ID || !FB_PAGE_TOKEN) { console.log("No Facebook secrets set, skipping."); process.exit(0); }

const now = JSON.parse(fs.readFileSync("data/stories.json", "utf8")).stories;
let oldIds = new Set();
try {
  const old = JSON.parse(execSync(`git show ${BEFORE_SHA}:data/stories.json`, { maxBuffer: 1 << 28 }).toString()).stories;
  oldIds = new Set(old.map(s => s.id));
} catch (e) { console.log("No previous version to compare, skipping."); process.exit(0); }

const fresh = now.filter(s => s.owner && !oldIds.has(s.id));
if (!fresh.length) { console.log("No new owner stories."); process.exit(0); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

function message(s) {
  const body = s.body || [];
  const i = body.findIndex(b => /^##\s*over to you/i.test(b));
  const ask = i >= 0 && body[i + 1] ? body[i + 1] : "What do you think? Tell us in the comments.";
  return `${s.h}\n\n${s.p}\n\n${ask}\n\nFull story: ${SITE}/gist/${encodeURIComponent(s.id)}/`;
}

(async () => {
  for (const s of fresh.reverse()) {
    const link = `${SITE}/gist/${encodeURIComponent(s.id)}/`;
    // wait for the site to finish deploying the page so Facebook sees the photo and headline
    for (let t = 0; t < 20; t++) {
      const r = await fetch(link).catch(() => null);
      if (r && r.ok) break;
      await sleep(15000);
    }
    await fetch(`https://graph.facebook.com/v21.0/?id=${encodeURIComponent(link)}&scrape=true&access_token=${FB_PAGE_TOKEN}`, { method: "POST" }).catch(() => {});
    const res = await fetch(`https://graph.facebook.com/v21.0/${FB_PAGE_ID}/feed`, {
      method: "POST",
      body: new URLSearchParams({ message: message(s), link, access_token: FB_PAGE_TOKEN }),
    });
    const out = await res.json();
    if (!res.ok) { console.error("Facebook error for", s.id, JSON.stringify(out)); process.exitCode = 1; }
    else console.log("Posted", s.id, out.id);
  }
})();
