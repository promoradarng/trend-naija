# Trend Naija – The Gist Desk

Static site for trendnaija.com, hosted on Cloudflare Pages.

- Stories live in `data/stories.json`, newest first. The first story is always the Top gist (lead), so a new post goes at the very top of the list; photos in `img/`, always with a credit line.
- Every story has `"at"`, the UTC time it went up (e.g. `"2026-10-24T19:05Z"`), shown under the headline in UK time. `node build.js` stamps any story without one with the current time, so new posts get it automatically; never change or remove an existing `at`.
- A story with `"confirmed": true` (owner checked it himself) carries no "Reported" label even with one source.
- `node build.js` regenerates `index.html`, the about/contact/privacy/terms pages, `sitemap.xml`, `robots.txt` and `style.css` (from `src/style.css`).
- Cloudflare Pages settings: no build command, output directory `/`.

## Photos and social media embeds

**Photo step for every update (do this before committing):** run `python3 tools/photos.py missing` to list the newest stories without a picture. For each one, run `python3 tools/photos.py find <id> "<person's full name>"` (or `find <id> "<subject>" stock` for a generic stand-in), view the downloaded candidates, and if one clearly fits run `python3 tools/photos.py pick <id> <number> "<alt text>"`. This takes a minute per story; do it for every new story where a person or subject is named. If no candidate clearly shows the right person, leave the story without a photo.

Every story should have a picture where possible. Use the first of these that exists, and never copy a photo from a newspaper, blog or someone else's social media post into `img/`:

1. **The owner's own photo** (stories with `"owner": true`).
2. **Social media embed**: when a story is about a public post by a celebrity, creator, politician or official account on Instagram, X/Twitter, TikTok, YouTube or Facebook, set `"embed"` to the URL of that original post (e.g. `https://www.instagram.com/p/ABC123/`, `https://x.com/user/status/123`, `https://www.tiktok.com/@user/video/123`). The site shows the real post, with its photo or video, via the platform's own embed. Take the URL from the post itself or from the source article (blogs usually embed it); only use a public post on the person's or organisation's own account, never a re-upload by a blog. `embed` is shown only when the story has no `img`.
3. **Official photo**: photos published by governments or official bodies under a free licence, e.g. US federal government photos (DHS, ICE, White House, State Department — public domain) and UK government images under the Open Government Licence. Openverse (below) with `source=flickr` and `license=pdm,cc0` finds many official Flickr photostreams.
4. **Wikimedia Commons** photo of the named person or place (Public domain, CC0, CC BY or CC BY-SA).
5. **Stand-in (stock) photo**: when nothing above exists, a free generic photo that fits the subject (a passport, an airport, a courtroom, a microphone, a police car, a football). Search Openverse, which needs no key:
   `curl -A "TrendNaija/1.0" "https://api.openverse.org/v1/images/?q=<subject>&license_type=commercial&page_size=10"`
   Use only results whose `license` is `cc0`, `pdm`, `by` or `by-sa`. Never use a stand-in that shows an identifiable person who could be mistaken for someone in the story.

View (Read) every downloaded image before using it. Save as `img/<id>.jpg`, about 640px wide, JPEG under ~60 KB. Set `alt` and `credit`, e.g. `"Photo: <creator> / <source>, <licence>"`; for a stand-in add "(stock image)", e.g. `"Stock image: <creator> / Flickr, CC BY 2.0"`.
