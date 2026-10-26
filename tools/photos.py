#!/usr/bin/env python3
"""Photo helper for Trend Naija hourly updates.

  python3 tools/photos.py missing
      List the newest stories that have no img, imgs or embed.
  python3 tools/photos.py find <story-id> "<search words>" [stock]
      Download up to 6 free-licence candidates from Wikimedia Commons into /tmp/tn-photos/<story-id>/
      and print their licence and creator. Add "stock" for generic stand-in photos.
      Then VIEW each candidate image (Read tool) before choosing.
  python3 tools/photos.py pick <story-id> <number> "<alt text>"
      Resize the chosen candidate into img/<story-id>.jpg and set img, alt and credit
      in data/stories.json. Then run `node build.js`.

Rules: for a named person, only pick a photo that clearly shows that exact person.
Stand-ins must not show an identifiable person who could be mistaken for someone in the story.
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "stories.json")
TMP = "/tmp/tn-photos"
UA = {"User-Agent": "TrendNaija/1.0 (https://trendnaija.com; hello@trendnaija.com)"}
LIC = {"cc0": "CC0", "pdm": "Public domain", "by": "CC BY", "by-sa": "CC BY-SA"}


def get(url, timeout=30):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()


def load():
    raw = open(DATA, encoding="utf-8").read()
    return raw, json.loads(raw)


def save(raw, d):
    open(DATA, "w", encoding="utf-8").write(json.dumps(d, indent=1, ensure_ascii=False) + ("\n" if raw.endswith("\n") else ""))


def missing():
    _, d = load()
    for s in d["stories"][:40]:
        if not (s.get("img") or s.get("imgs") or s.get("embed")):
            print(f'{s["id"]}  |  {s["h"]}')


def get_retry(url, timeout=15):
    for i in range(6):
        try:
            return get(url, timeout)
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == 5:
                raise
            time.sleep(5)


def find(sid, q, stock=False):
    """Search Wikimedia Commons directly (fast, ~1s). Openverse is often too slow and times out."""
    import html, re
    p = {"action": "query", "format": "json", "generator": "search", "gsrsearch": q + " filetype:bitmap",
         "gsrnamespace": "6", "gsrlimit": "20", "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": "640"}
    try:
        r = json.loads(get_retry("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p)))
    except Exception as e:
        print(f"Commons search failed ({e}). Try again in a minute, or try other words.")
        return
    pages = sorted(r.get("query", {}).get("pages", {}).values(), key=lambda x: x["index"])
    out = os.path.join(TMP, sid)
    os.makedirs(out, exist_ok=True)
    meta, n = [], 0
    for pg in pages:
        if n >= 6:
            break
        ii = pg["imageinfo"][0]
        em = ii.get("extmetadata", {})
        lic = em.get("LicenseShortName", {}).get("value", "")
        if not re.search(r"^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)", lic, re.I):
            continue
        try:
            data = get_retry(ii["thumburl"], 15)
        except Exception:
            continue
        fn = os.path.join(out, f"{n}.jpg")
        open(fn, "wb").write(data)
        artist = re.sub("<[^>]+>", "", html.unescape(em.get("Artist", {}).get("value", "Unknown"))).split("\n")[0].strip()[:60] or "Unknown"
        credit = f"{'Stock image' if stock else 'Photo'}: {artist} / Wikimedia Commons, {lic}"
        meta.append({"n": n, "file": fn, "credit": credit, "title": pg["title"], "page": ii["descriptionurl"]})
        print(f'{n}: {fn}  |  {pg["title"]}  |  {credit}')
        n += 1
        time.sleep(0.5)
    json.dump(meta, open(os.path.join(out, "meta.json"), "w"))
    if not meta:
        print("No candidates found. Try other search words (e.g. the person's name only), or a stock stand-in with: find <id> \"<subject>\" stock")


def pick(sid, num, alt):
    from PIL import Image
    meta = json.load(open(os.path.join(TMP, sid, "meta.json")))
    m = next(x for x in meta if x["n"] == int(num))
    im = Image.open(m["file"]).convert("RGB")
    im.thumbnail((640, 640))
    rel = f"img/{sid}.jpg"
    out = os.path.join(ROOT, rel)
    q = 82
    while True:
        im.save(out, quality=q, optimize=True, progressive=True)
        if os.path.getsize(out) < 60000 or q < 50:
            break
        q -= 6
    raw, d = load()
    s = next(x for x in d["stories"] if x["id"] == sid)
    if s.get("owner"):
        sys.exit("Owner story: keep the owner's photo.")
    s["img"], s["alt"], s["credit"] = rel, alt, m["credit"]
    save(raw, d)
    print(f"Set {rel}  ({m['credit']})  source page: {m['page']}")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] == "missing":
        missing()
    elif a[0] == "find" and len(a) >= 3:
        find(a[1], a[2], len(a) > 3 and a[3] == "stock")
    elif a[0] == "pick" and len(a) == 4:
        pick(a[1], a[2], a[3])
    else:
        print(__doc__)
