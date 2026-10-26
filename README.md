# Trend Naija – The Gist Desk

Static site for trendnaija.com, hosted on Cloudflare Pages.

- Stories live in `data/stories.json`, newest first. The first story is always the Top gist (lead), so a new post goes at the very top of the list; photos in `img/`, always with a credit line.
- Every story has `"at"`, the UTC time it went up (e.g. `"2026-10-24T19:05Z"`), shown under the headline in UK time. `node build.js` stamps any story without one with the current time, so new posts get it automatically; never change or remove an existing `at`.
- Owner photos (stories with `"owner": true`) are shown whole, never cropped; save them at their full shape (640px wide).
- Optional `"body"`: an array of paragraphs with the full text (owner posts). It shows behind a "Read more" button on the front page and in full on the story's own page; `p` stays the short summary.
- A story with `"confirmed": true` (owner checked it himself) carries no "Reported" label even with one source.
- **Archive (nothing is ever lost):** `node build.js` copies every story in `data/stories.json` into `data/archive/<id>.json` and keeps it there for good, with its photo. Dropping a story from `data/stories.json` only takes it off the front page; it keeps its own page and appears on `/archive` (All stories), which visitors can search. Never delete files in `data/archive/`. An archived owner story (`"owner": true`) is never overwritten by a non-owner version, and owner stories stay on the front page for 48 hours after their `at` time even if they are dropped from `data/stories.json`. The front page shows the newest 40 stories by `at` (plus owner stories younger than 48 hours); older ones move off it automatically into the archive, and the next 30 are listed under "Earlier gist" at the bottom of the front page with a "See all stories" button, so nothing disappears without a trace.
- Every story also gets its own page at `/gist/<id>/` (for Google), listed in `sitemap.xml`. Keep story ids stable once published.
- `node build.js` regenerates `index.html`, the `gist/` story pages, the about/contact/privacy/terms pages, `sitemap.xml`, `robots.txt` and `style.css` (from `src/style.css`).
- Cloudflare Pages settings: no build command, output directory `/`.

## Photos and social media embeds

**PHOTO RULES (updated 26 Oct 2026 — the owner has complained twice about stories without pictures):**
- `tools/photos.py find` now searches Wikimedia Commons directly (about 1 second) and retries automatically when rate-limited. Openverse is too slow from the cloud and times out — do not use it.
- Run photo searches ONE AT A TIME, never in parallel (Wikimedia blocks parallel requests with HTTP 429).
- For every new story, search the full name of the main person named; if nothing fits, try the second person named, then reuse a photo already in `img/` of the same person, then a `stock` subject search.
- Safety net: `build.js` shows a credited category stand-in photo from `stock/` (see `stock/stock.json`) for any story with no `img`, `imgs` or `embed`, so nothing ever appears without a picture. Never delete or change `stock/`. A real photo of the named person is always preferred over the stand-in.

**Photo step for every update — MANDATORY, never skip it (the owner has complained about stories without pictures). Do it before committing; every story on the front page should end up with a picture.**
If the person search finds nothing, try `find <id> "<generic subject>" stock` with at least two different subjects (e.g. "wedding rings", "ballot box", "graduation caps", "solar panels", "police car lights", "shopping trolley"), or reuse a licensed photo already in `img/` of the same named person (copy its credit). **Photo step for every update (do this before committing):** run `python3 tools/photos.py missing` to list the newest stories without a picture. For each one, run `python3 tools/photos.py find <id> "<person's full name>"` (or `find <id> "<subject>" stock` for a generic stand-in), view the downloaded candidates, and if one clearly fits run `python3 tools/photos.py pick <id> <number> "<alt text>"`. This takes a minute per story; do it for every new story where a person or subject is named. If no candidate clearly shows the right person, leave the story without a photo.

Every story should have a picture where possible. Use the first of these that exists, and never copy a photo from a newspaper, blog or someone else's social media post into `img/`:

1. **The owner's own photo** (stories with `"owner": true`).
2. **Social media embed**: when a story is about a public post by a celebrity, creator, politician or official account on Instagram, X/Twitter, TikTok, YouTube or Facebook, set `"embed"` to the URL of that original post (e.g. `https://www.instagram.com/p/ABC123/`, `https://x.com/user/status/123`, `https://www.tiktok.com/@user/video/123`). The site shows the real post, with its photo or video, via the platform's own embed. Take the URL from the post itself or from the source article (blogs usually embed it); only use a public post on the person's or organisation's own account, never a re-upload by a blog. `embed` is shown only when the story has no `img`.
3. **Official photo**: photos published by governments or official bodies under a free licence, e.g. US federal government photos (DHS, ICE, White House, State Department — public domain) and UK government images under the Open Government Licence. Openverse (below) with `source=flickr` and `license=pdm,cc0` finds many official Flickr photostreams.
4. **Wikimedia Commons** photo of the named person or place (Public domain, CC0, CC BY or CC BY-SA).
5. **Stand-in (stock) photo**: when nothing above exists, a free generic photo that fits the subject (a passport, an airport, a courtroom, a microphone, a police car, a football). Search Openverse, which needs no key:
   `curl -A "TrendNaija/1.0" "https://api.openverse.org/v1/images/?q=<subject>&license_type=commercial&page_size=10"`
   Use only results whose `license` is `cc0`, `pdm`, `by` or `by-sa`. Never use a stand-in that shows an identifiable person who could be mistaken for someone in the story.

View (Read) every downloaded image before using it. Save as `img/<id>.jpg`, about 640px wide, JPEG under ~60 KB. Set `alt` and `credit`, e.g. `"Photo: <creator> / <source>, <licence>"`; for a stand-in add "(stock image)", e.g. `"Stock image: <creator> / Flickr, CC BY 2.0"`.
