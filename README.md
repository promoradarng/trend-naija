# Trend Naija – The Gist Desk

Static site for trendnaija.com, hosted on Cloudflare Pages.

- Stories live in `data/stories.json`; photos in `img/` (Wikimedia Commons only, credited).
- `node build.js` regenerates `index.html`, the about/contact/privacy/terms pages, `sitemap.xml`, `robots.txt` and `style.css` (from `src/style.css`).
- Cloudflare Pages settings: no build command, output directory `/`.
