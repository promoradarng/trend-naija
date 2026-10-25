#!/usr/bin/env python3
"""Photo helper for Trend Naija hourly updates.

  python3 tools/photos.py missing
      List the newest stories that have no img, imgs or embed.
  python3 tools/photos.py find <story-id> "<search words>" [stock]
      Download up to 6 free-licence candidates from Openverse into /tmp/tn-photos/<story-id>/
      and print their licence and creator. Add "stock" for generic stand-in photos.
      Then VIEW each candidate image (Read tool) before choosing.
  python3 tools/photos.py pick <story-id> <number> "<alt text>"
      Resize the chosen candidate into img/<story-id>.jpg and set img, alt and credit
      in data/stories.json. Then run `node build.js`.

Rules: for a named person, only pick a photo that clearly shows that exact person.
Stand-ins must not show an identifiable person who could be mistaken for someone in the story.
"""
import json, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "stories.json")
TMP = "/tmp/tn-photos"
UA = {"User-Agent": "TrendNaija/1.0 (news photo lookup)"}
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
    for s in d["stories"][:20]:
        if not (s.get("img") or s.get("imgs") or s.get("embed")):
            print(f'{s["id"]}  |  {s["h"]}')


def find(sid, q, stock=False):
    params = {"q": q, "page_size": "12", "license": "cc0,pdm,by,by-sa"}
    if stock:
        params["license_type"] = "commercial"
        del params["license"]
    res = json.loads(get("https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(params)))["results"]
    out = os.path.join(TMP, sid)
    os.makedirs(out, exist_ok=True)
    meta, n = [], 0
    for r in res:
        if n >= 6 or r.get("license") not in LIC:
            continue
        data = None
        for u in (r.get("url"), r.get("thumbnail")):
            try:
                data = get(u)
                if len(data) > 3000:
                    break
            except Exception:
                time.sleep(2)
        if not data:
            continue
        fn = os.path.join(out, f"{n}.jpg")
        open(fn, "wb").write(data)
        src = "Wikimedia Commons" if r.get("source") == "wikimedia" else (r.get("source") or "").title()
        credit = f'Photo: {r.get("creator") or "Unknown"} / {src}, {LIC[r["license"]]} {r.get("license_version") or ""}'.strip()
        if stock:
            credit = "Stock image: " + credit[len("Photo: "):]
        meta.append({"n": n, "file": fn, "credit": credit, "title": r.get("title"), "page": r.get("foreign_landing_url")})
        print(f'{n}: {fn}  |  {r.get("title")}  |  {credit}')
        n += 1
        time.sleep(1)
    json.dump(meta, open(os.path.join(out, "meta.json"), "w"))
    if not meta:
        print("No candidates found. Try other search words, or a stock stand-in with: find <id> \"<subject>\" stock")


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
