# Trend Naija – The Gist Desk

Static site for trendnaija.com, hosted on Cloudflare Pages.

- Stories live in `data/stories.json`, newest first. The first story is always the Top gist (lead), so a new post goes at the very top of the list; photos in `img/` (Wikimedia Commons only, credited).
- A story with `"confirmed": true` (owner checked it himself) carries no "Reported" label even with one source.
- `node build.js` regenerates `index.html`, the about/contact/privacy/terms pages, `sitemap.xml`, `robots.txt` and `style.css` (from `src/style.css`).
- Cloudflare Pages settings: no build command, output directory `/`.
