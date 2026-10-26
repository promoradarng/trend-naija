// Builds the static Trend Naija site from data/stories.json.
// Usage: node build.js   (writes index.html, static pages, sitemap.xml, robots.txt into the repo root)
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;
const SITE = "https://trendnaija.com";
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/stories.json"), "utf8"));
const CATS = data.categories;

// every story carries "at" (UTC time it went up); stamp new ones now and save them back
const nowAt = new Date().toISOString().slice(0, 16) + "Z";
if (data.stories.some(s => !s.at)) {
  data.stories.forEach(s => { if (!s.at) s.at = nowAt; });
  fs.writeFileSync(path.join(ROOT, "data/stories.json"), JSON.stringify(data, null, 1));
}

// Archive: every story ever published is kept in data/archive/<id>.json, so it keeps its own page
// and stays searchable after it leaves the front page. An archived owner story is only replaced by
// an owner version, and owner stories stay on the front page for OWNER_HOURS after they went up.
const ARCH = path.join(ROOT, "data/archive");
const OWNER_HOURS = 48;
fs.mkdirSync(ARCH, { recursive: true });
const archive = new Map(fs.readdirSync(ARCH).filter(f => f.endsWith(".json"))
  .map(f => JSON.parse(fs.readFileSync(path.join(ARCH, f), "utf8"))).map(s => [s.id, s]));
for (const s of data.stories) {
  const old = archive.get(s.id);
  if (old && old.owner && !s.owner) continue;
  const { hot, lead, pg, ...keep } = s;
  const next = { ...keep, at: (old && old.at) || s.at };
  const file = path.join(ARCH, `${s.id}.json`);
  const text = JSON.stringify(next, null, 1);
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) fs.writeFileSync(file, text);
  archive.set(s.id, next);
}
const byNewest = list => list.map((s, i) => [s, i]).sort((a, b) => (b[0].at > a[0].at) - (b[0].at < a[0].at) || a[1] - b[1]).map(x => x[0]);
const onFront = new Set(data.stories.map(s => s.id));
const pinned = [...archive.values()].filter(s => s.owner && !onFront.has(s.id) && Date.now() - Date.parse(s.at) < OWNER_HOURS * 3600e3);
// front page: the newest FRONT_MAX stories (plus owner stories younger than OWNER_HOURS), newest first,
// so each new post goes in at the top (Top gist) and the oldest drop off into the archive
const FRONT_MAX = 40;
const young = s => Date.now() - Date.parse(s.at) < OWNER_HOURS * 3600e3;
const stories = byNewest(data.stories.map(s => (archive.get(s.id).owner && !s.owner) ? { ...archive.get(s.id), hot: s.hot } : s).concat(pinned))
  .filter((s, i) => i < FRONT_MAX || (s.owner && young(s)));
// every story ever published, newest first: story pages, sitemap, archive page and photos
const all = byNewest([...archive.values()]);
const WHEN = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" });
const when = s => `<time class="when" datetime="${esc(s.at)}">${esc(WHEN.format(new Date(s.at)))}</time>`;

const esc = t => String(t ?? "").replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const storyPath = s => `/gist/${encodeURIComponent(s.id)}/`;
const absImg = s => (s.imgs && s.imgs.length) ? `${SITE}/${s.imgs[0]}` : (s.img ? `${SITE}/${s.img}` : "");
const fig = (s, eager) => (s.imgs && s.imgs.length)
  ? `<figure class="ph ph-multi">${s.imgs.map((src, i) => `<img src="/${esc(src)}" alt="${esc((s.alts || [])[i] || s.alt || s.h)}"${eager ? "" : ' loading="lazy"'} width="640" height="640">`).join("")}<figcaption>${esc(s.credit || "")}</figcaption></figure>`
  : s.img
  ? `<figure class="ph${s.owner ? " ph-full" : ""}"><img src="/${esc(s.img)}" alt="${esc(s.alt || s.h)}"${eager ? "" : ' loading="lazy"'} width="640" height="427"><figcaption>${esc(s.credit || "")}</figcaption></figure>`
  : "";
// Social media embeds: a story's "embed" field holds the URL of the original public post.
// Supported: Instagram (post/reel), X/Twitter (status), TikTok (video), YouTube, Facebook (post/video/reel).
const EMBED_USED = new Set();
function embedHtml(url) {
  const u = String(url || "").trim();
  let m;
  if ((m = u.match(/^https:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|tv)\/([A-Za-z0-9_-]+)/))) {
    EMBED_USED.add("instagram");
    const link = `https://www.instagram.com/${m[1]}/${m[2]}/`;
    return `<div class="embed"><blockquote class="instagram-media" data-instgrm-permalink="${esc(link)}" data-instgrm-version="14"><a href="${esc(link)}" target="_blank" rel="noopener">View this post on Instagram</a></blockquote></div>`;
  }
  if ((m = u.match(/^https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\/(\d+)/))) {
    EMBED_USED.add("x");
    const link = `https://twitter.com/${m[1]}/status/${m[2]}`;
    return `<div class="embed"><blockquote class="twitter-tweet" data-dnt="true"><a href="${esc(link)}" target="_blank" rel="noopener">View this post on X</a></blockquote></div>`;
  }
  if ((m = u.match(/^https:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9_.]+)\/video\/(\d+)/))) {
    EMBED_USED.add("tiktok");
    const link = `https://www.tiktok.com/@${m[1]}/video/${m[2]}`;
    return `<div class="embed"><blockquote class="tiktok-embed" cite="${esc(link)}" data-video-id="${m[2]}"><section><a href="${esc(link)}" target="_blank" rel="noopener">View this video on TikTok</a></section></blockquote></div>`;
  }
  if ((m = u.match(/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/))) {
    return `<div class="embed embed-yt"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="YouTube video" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
  }
  if (/^https:\/\/(?:www\.|m\.)?facebook\.com\/[^\s"<>]+$/.test(u) || /^https:\/\/fb\.watch\/[A-Za-z0-9_-]+\/?$/.test(u)) {
    const video = /\/(videos|reel|watch)\b|fb\.watch/.test(u);
    const src = `https://www.facebook.com/plugins/${video ? "video" : "post"}.php?href=${encodeURIComponent(u)}&show_text=true&width=500`;
    return `<div class="embed embed-fb${video ? " embed-fbv" : ""}"><iframe src="${esc(src)}" title="Facebook post" loading="lazy" scrolling="no" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
  }
  return "";
}
const media = (s, eager) => fig(s, eager) || embedHtml(s.embed);
const embedScripts = () => [
  EMBED_USED.has("instagram") ? '<script async src="https://www.instagram.com/embed.js"></script>' : "",
  EMBED_USED.has("x") ? '<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>' : "",
  EMBED_USED.has("tiktok") ? '<script async src="https://www.tiktok.com/embed.js"></script>' : ""
].join("");


function head(title, desc, canonical, opt = {}) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${canonical}">
<meta property="og:site_name" content="Trend Naija">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${canonical}">
<meta property="og:type" content="${opt.article ? "article" : "website"}">${opt.image ? `
<meta property="og:image" content="${esc(opt.image)}">
<meta name="twitter:image" content="${esc(opt.image)}">` : ""}${opt.article ? `
<meta property="article:published_time" content="${esc(opt.article)}">` : ""}
<meta name="robots" content="max-image-preview:large">${opt.ld ? `
<script type="application/ld+json">${JSON.stringify(opt.ld).replace(/</g, "\\u003c")}</script>` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#008751">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Libre+Franklin:wght@500;600;700&display=swap">
<link rel="stylesheet" href="/style.css?v=${Date.now()}">
</head>
<body>`;
}

const nav = `<nav class="topnav" aria-label="Site"><div class="wrap"><a href="/">Home</a><a href="/archive">All stories</a><a href="/about">About</a><a href="/contact">Contact</a></div></nav>`;

function masthead() {
  return `${nav}
<header class="mast">
  <div class="wrap">
    <div class="ears"><span>Naija &amp; Western gist</span><span>News · Celebs · Trends</span></div>
    <h1 class="logo"><a href="/">Trend Naija</a></h1>
    <div class="sublogo">The Gist Desk</div>
    <div class="dateline"><span>${esc(data.date)}</span><span>Lagos · London</span><span id="updated">${esc(data.updated)}</span></div>
  </div>
</header>`;
}

const footer = `<footer>
  <div class="wrap">
    <div><h5>How we cover stories</h5>Every story is checked and written in our own words. "Reported" means a story is still coming from one place, so treat it as gist until more outlets carry it.</div>
    <div><h5>What we cover</h5>2027 elections, Nollywood, music, creators and podcasts, Naija news, politics, viral gist, world news and sport.</div>
    <div><h5>Got gist?</h5>Send us your story tips at <a href="/contact">our contact page</a>. We check every tip before it goes up.</div>
    <div class="footlinks"><a href="/about">About us</a><a href="/contact">Contact</a><a href="/privacy">Privacy policy</a><a href="/terms">Terms of use</a><span>© ${new Date().getFullYear()} Trend Naija</span></div>
  </div>
</footer>
</body>
</html>
`;

// a story with "body" (array of paragraphs) carries its full text behind a "Read more" button
const fullText = s => (s.body || []).length ? `<details class="full"><summary>Read more</summary>${s.body.map(t => `<p>${esc(t)}</p>`).join("")}</details>` : "";

function card(s) {
  const n = s.confirmed ? 2 : (s.n || 1);
  return `<article class="card" data-c="${esc(s.c)}" id="${esc(s.id)}"><div class="meta"><span class="cat">${esc(CATS[s.c] || s.c)}</span>${n > 1 ? "" : '<span class="status">Reported</span>'}</div>
${media(s)}<h4><a href="${storyPath(s)}">${esc(s.h)}</a></h4>${when(s)}<p>${esc(s.p)}</p>${fullText(s)}</article>`;
}

function buildIndex() {
  const lead = stories[0]; // newest story (first in data/stories.json) is always Top gist
  const hot = stories.filter(s => s.hot && s !== lead).sort((a, b) => a.hot - b.hot).slice(0, 6);
  const tick = stories.filter(s => s.hot).sort((a, b) => a.hot - b.hot).map(s => `<span>${esc(s.h)}</span>`).join("");
  const tabs = Object.entries(CATS).map(([k, v]) => `<button type="button" id="tab-${k}" data-k="${k}" aria-pressed="${k === "all"}">${esc(v)}</button>`).join("");
  const river = stories.filter(s => s !== lead).map(card).join("\n");
  // stories that have left the front page stay visible here, newest first, each linking to its own page
  const frontIds = new Set(stories.map(s => s.id));
  const earlier = all.filter(s => !frontIds.has(s.id)).slice(0, 30);
  const desc = "Trend Naija – The Gist Desk: trending Nigerian and Western news, Nollywood and celebrity gist, music, creators, 2027 election updates, viral stories and sport, updated through the day.";
  const html = head("Trend Naija – The Gist Desk | Naija news, gist & trends", desc, "/") + masthead() + `
<div class="ticker" aria-label="In brief"><div class="wrap"><b>In brief</b><div class="track"><div class="track-inner">${tick}${tick}</div></div></div></div>
<main>
  <div class="controls"><div class="wrap">
    <div class="tabs" id="tabs" role="group" aria-label="Category">${tabs}</div>
    <div class="search"><label for="q" style="position:absolute;left:-9999px">Search stories</label><input id="q" type="search" placeholder="Search gist…"></div>
  </div></div>
  <section class="wrap top">
    <article class="lead" id="lead"><div class="kicker">Top gist · ${esc(CATS[lead.c])}</div>${media(lead, true)}<h2><a href="${storyPath(lead)}">${esc(lead.h)}</a></h2>${when(lead)}<p>${esc(lead.p)}</p>${fullText(lead)}${(lead.more || []).length ? `<div class="more">${lead.more.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : ""}</article>
    <aside class="side"><h3>Most talked about</h3><ol class="hot-list">${hot.map(s => `<li><div><a class="hl" href="#${esc(s.id)}">${esc(s.h)}</a><small>${esc(CATS[s.c])}</small></div></li>`).join("")}</ol></aside>
  </section>
  <section class="wrap river" id="river" aria-live="polite">
${river}
${earlier.length ? `</section>
  <section class="wrap earlier" id="older"><h3>Earlier gist</h3><ul class="earlier-list">${earlier.map(s => `<li><a href="${storyPath(s)}">${s.img ? `<img src="/${esc(s.img)}" alt="" loading="lazy" width="96" height="64">` : ""}<span><b>${esc(s.h)}</b><small>${esc(CATS[s.c] || "")}${s.at ? " · " + esc(WHEN.format(new Date(s.at))) : ""}</small></span></a></li>`).join("")}</ul>
  <p class="see-all"><a href="/archive">See all ${all.length} stories →</a></p>
  <section class="wrap river-tail">` : `<p class="allq" id="older"><a href="/archive">Older stories are in All stories →</a></p>`}
<div class="empty" id="empty" hidden>No gist on the front page matches that. Try another category, or search all our past stories below.</div>
<p class="allq" id="allq" hidden><a href="/archive">Search all ${all.length} stories for “<span></span>” →</a></p>
  </section>
</main>
<script>
(function(){
  var cat="all",q="";
  try{var h=location.hash.slice(1);if(document.getElementById("tab-"+h)){cat=h;}}catch(e){}
  var tabs=document.querySelectorAll("#tabs button"),cards=document.querySelectorAll("#river .card"),empty=document.getElementById("empty"),allq=document.getElementById("allq");
  function apply(){var shown=0;cards.forEach(function(c){var ok=(cat==="all"||c.dataset.c===cat)&&(!q||c.textContent.toLowerCase().indexOf(q)>-1);c.hidden=!ok;if(ok)shown++;});empty.hidden=shown>0;allq.hidden=!q;allq.querySelector("span").textContent=q;allq.querySelector("a").href="/archive?q="+encodeURIComponent(q);tabs.forEach(function(b){b.setAttribute("aria-pressed",b.dataset.k===cat)});}
  document.getElementById("tabs").addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;cat=b.dataset.k;try{history.replaceState(null,"",cat==="all"?location.pathname:"#"+cat)}catch(e){}apply();});
  document.getElementById("q").addEventListener("input",function(e){q=e.target.value.trim().toLowerCase();apply();});
  if(cat!=="all")apply();
})();
</script>
` + embedScripts() + footer;
  fs.writeFileSync(path.join(ROOT, "index.html"), html);
}

function page(file, title, desc, body) {
  fs.writeFileSync(path.join(ROOT, file), head(`${title} | Trend Naija`, desc, "/" + file.replace(/\.html$/, "")) + masthead() + `\n<main class="wrap page">\n${body}\n</main>\n` + footer);
}

const CONTACT = "hello@trendnaija.com";
const UPDATED_LEGAL = "23 October 2026";

function buildPages() {
  page("about.html", "About us", "About Trend Naija – The Gist Desk, a Nigerian and Western news, gist and trends digest.", `
<h2>About Trend Naija</h2>
<p>Trend Naija – The Gist Desk brings you the stories everybody is talking about, in one place: Nigerian news and politics, the 2027 elections, Nollywood and celebrity gist, music, creators and podcasts, viral moments, world news and sport.</p>
<p>We follow Nigerian and international news outlets, blogs and social media through the day, check what is being reported, and write short, clear summaries in our own words. We update the site many times a day.</p>
<h3>How we label stories</h3>
<p><strong>Reported</strong> means a story is so far coming from one place, so treat it as gist until more outlets carry it. We use careful language such as "reportedly" for anything not yet confirmed.</p>
<h3>Our standards</h3>
<ul>
<li>We do not publish unproven criminal or sexual allegations against named people.</li>
<li>We cover all political parties and candidates fairly and do not take sides.</li>
<li>We correct mistakes quickly. If you see something wrong, <a href="/contact">tell us</a>.</li>
<li>Photos come from freely licensed sources such as Wikimedia Commons and carry a credit line.</li>
</ul>`);

  page("contact.html", "Contact", "Contact Trend Naija for story tips, corrections, advertising and copyright requests.", `
<h2>Contact us</h2>
<p>Email: <strong>${CONTACT}</strong></p>
<h3>Story tips</h3>
<p>Got gist? Send us what you know, with any links, screenshots or videos. We check every tip before anything goes up, and we never reveal who sent it unless you ask us to.</p>
<h3>Corrections</h3>
<p>If we got something wrong, email us with the headline and what needs fixing. We review every correction request and update stories quickly.</p>
<h3>Copyright and removal requests</h3>
<p>If you believe something on this site uses your work without permission, email us with the details and a link to your original. We will review it and remove it where appropriate.</p>
<h3>Advertising and partnerships</h3>
<p>For advertising, sponsored content or partnerships, email us with "Advertising" in the subject line.</p>`);

  page("privacy.html", "Privacy policy", "How Trend Naija collects, uses and protects information, including cookies and advertising.", `
<h2>Privacy policy</h2>
<p class="muted">Last updated: ${UPDATED_LEGAL}</p>
<p>This policy explains what information Trend Naija ("we", "us") collects when you visit trendnaija.com, and how it is used.</p>
<h3>Information we collect</h3>
<p>We do not ask you to create an account. If you email us, we receive your email address and whatever you include in your message, and we use it only to reply and to act on your request.</p>
<p>Like most websites, our hosting provider automatically records basic technical information such as your IP address, browser type, the pages you visit and the time of your visit. This is used to keep the site secure and working.</p>
<h3>Cookies and advertising</h3>
<p>We may show advertising provided by Google and its partners. Third-party vendors, including Google, use cookies to serve ads based on your previous visits to this and other websites. Google's use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and/or other sites on the internet.</p>
<p>You can opt out of personalised advertising by visiting <a href="https://www.google.com/settings/ads" rel="noopener">Google Ads Settings</a>, or opt out of some third-party vendors' use of cookies for personalised advertising at <a href="https://www.aboutads.info/choices/" rel="noopener">www.aboutads.info</a>. Where the law requires it (for example in the UK and EU), we will ask for your consent before personalised advertising cookies are used.</p>
<p>We may also use privacy-friendly analytics to understand which stories are popular. This information is collected in aggregate.</p>
<h3>Your rights</h3>
<p>Depending on where you live, you may have the right to access, correct or delete personal information we hold about you, and to object to how it is used. To make a request, email ${CONTACT}.</p>
<h3>Children</h3>
<p>This site is not directed at children under 13, and we do not knowingly collect information from them.</p>
<h3>Changes</h3>
<p>We may update this policy from time to time. The date at the top shows when it last changed.</p>
<h3>Contact</h3>
<p>Questions about this policy: ${CONTACT}</p>`);

  page("terms.html", "Terms of use", "The terms that apply when you use Trend Naija.", `
<h2>Terms of use</h2>
<p class="muted">Last updated: ${UPDATED_LEGAL}</p>
<p>By using trendnaija.com you agree to these terms.</p>
<h3>Our content</h3>
<p>Our headlines and summaries are written by Trend Naija. You may share links to our pages, but please do not copy our content in full without permission.</p>
<h3>Accuracy</h3>
<p>We work to make our stories accurate and we label unconfirmed stories as "Reported". News changes quickly, so stories may be incomplete or later turn out to be wrong. Nothing on this site is legal, financial, medical or immigration advice.</p>
<h3>Photos and third-party material</h3>
<p>Photos are used under their stated licences and credited on the page. Trademarks and names belong to their owners. If you believe we have used your work wrongly, contact us at ${CONTACT} and we will review it promptly.</p>
<h3>Links</h3>
<p>We are not responsible for the content of other websites we link to.</p>
<h3>Changes</h3>
<p>We may update these terms at any time. Continued use of the site means you accept the updated terms.</p>
<h3>Contact</h3>
<p>${CONTACT}</p>`);

  page("404.html", "Page not found", "This page could not be found.", `
<h2>Page not found</h2>
<p>That page has moved or never existed. <a href="/">Go to today's gist</a>.</p>`);
}

// one page per story at /gist/<id>/ so Google can index and rank each story
function buildStories() {
  const dir = path.join(ROOT, "gist");
  fs.rmSync(dir, { recursive: true, force: true });
  all.forEach((s, i) => {
    EMBED_USED.clear();
    const url = SITE + storyPath(s);
    const img = absImg(s);
    const desc = String(s.p || "").slice(0, 155).replace(/\s+\S*$/, "") + "…";
    const related = stories.filter(x => x.id !== s.id && x.c === s.c).slice(0, 4);
    const more = related.length < 4 ? related.concat(stories.filter(x => x.id !== s.id && !related.includes(x)).slice(0, 4 - related.length)) : related;
    const ld = {
      "@context": "https://schema.org", "@type": "NewsArticle", headline: s.h.slice(0, 110), description: desc,
      datePublished: s.at, dateModified: s.at, mainEntityOfPage: url, articleSection: CATS[s.c] || s.c,
      image: img ? [img] : undefined,
      author: { "@type": "Organization", name: "Trend Naija", url: SITE },
      publisher: { "@type": "Organization", name: "Trend Naija", url: SITE, logo: { "@type": "ImageObject", url: `${SITE}/favicon.svg` } }
    };
    const n = s.confirmed ? 2 : (s.n || 1);
    const body = `<article class="story-page">
  <p class="crumbs"><a href="/">Home</a> › <a href="/#${esc(s.c)}">${esc(CATS[s.c] || s.c)}</a></p>
  <div class="kicker">${esc(CATS[s.c] || s.c)}</div>${n > 1 ? "" : ' <span class="status">Reported</span>'}
  <h1>${esc(s.h)}</h1>
  ${when(s)}
  ${media(s, true)}
  ${(s.body || []).length ? s.body.map(t => `<p class="story-text">${esc(t)}</p>`).join("\n  ") : `<p class="story-text">${esc(s.p)}</p>`}
  ${(s.more || []).length ? `<ul class="story-more">${s.more.map(m => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
</article>
<section class="story-related"><h3>More gist</h3><div class="river">${more.map(card).join("\n")}</div></section>`;
    fs.mkdirSync(path.join(dir, s.id), { recursive: true });
    fs.writeFileSync(path.join(dir, s.id, "index.html"),
      head(`${s.h} | Trend Naija`, desc, storyPath(s), { article: s.at, image: img, ld }) + masthead() +
      `\n<main class="wrap page">\n${body}\n</main>\n` + embedScripts() + footer);
  });
}

// /archive: every story ever published, searchable, each linking to its own page
function buildArchive() {
  const rows = all.map(s => `<li class="arc" data-c="${esc(s.c)}"><div class="arc-meta">${when(s)}<span>${esc(CATS[s.c] || s.c)}</span></div><a href="${storyPath(s)}">${esc(s.h)}</a><p>${esc(s.p)}</p></li>`).join("\n");
  page("archive.html", "All stories", "Search every story Trend Naija has published: Nigerian news, Nollywood and celebrity gist, music, creators, elections, viral stories and sport.", `
<h2>All stories</h2>
<p class="muted">Every story we have published, newest first. Search by name, topic or headline.</p>
<div class="search arc-search"><label for="aq" style="position:absolute;left:-9999px">Search all stories</label><input id="aq" type="search" placeholder="Search all ${all.length} stories…"></div>
<p class="muted" id="acount"></p>
<ol class="arc-list" id="alist">
${rows}
</ol>
<script>
(function(){
  var items=document.querySelectorAll("#alist .arc"),box=document.getElementById("aq"),count=document.getElementById("acount");
  function apply(){var q=box.value.trim().toLowerCase(),n=0;items.forEach(function(li){var ok=!q||li.textContent.toLowerCase().indexOf(q)>-1;li.hidden=!ok;if(ok)n++;});count.textContent=q?(n+" stor"+(n===1?"y":"ies")+" found"):"";try{history.replaceState(null,"",q?"?q="+encodeURIComponent(q):location.pathname)}catch(e){}}
  try{var q=new URLSearchParams(location.search).get("q");if(q){box.value=q;}}catch(e){}
  box.addEventListener("input",apply);apply();
})();
</script>`);
}

function buildMeta() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = ["/", "/about", "/contact", "/privacy", "/terms"];
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod>${u === "/" ? "<changefreq>hourly</changefreq>" : ""}</url>`).join("\n")}
  <url><loc>${SITE}/archive</loc><lastmod>${today}</lastmod><changefreq>hourly</changefreq></url>
${all.map(s => `  <url><loc>${SITE}${storyPath(s)}</loc><lastmod>${String(s.at || today).slice(0, 10)}</lastmod></url>`).join("\n")}
</urlset>
`);
  fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /data/\nDisallow: /src/\n\nSitemap: ${SITE}/sitemap.xml\n`);
  fs.copyFileSync(path.join(ROOT, "src/style.css"), path.join(ROOT, "style.css"));
}

// remove images no story uses any more
function pruneImages() {
  const used = new Set(all.flatMap(s => [s.img, ...(s.imgs || [])]).filter(Boolean).map(f => path.basename(f)));
  for (const f of fs.readdirSync(path.join(ROOT, "img"))) if (!used.has(f)) fs.unlinkSync(path.join(ROOT, "img", f));
}

pruneImages();
buildIndex();
buildStories();
buildArchive();
buildPages();
buildMeta();
console.log(`Built ${stories.length} stories, ${stories.filter(s => s.img).length} with photos; ${all.length} in the archive.`);
