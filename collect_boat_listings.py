"""
Collect Boat Listings from Edge Browsing History
=================================================

Scans your Microsoft Edge browsing history for pages whose URL contains "yacht", "boat",
or "sail" (matching any domain name or path, e.g. yachtworld.com, yachtsalesco.com,
trademe.co.nz/.../yachts/..., a sailing forum, etc.), records all of them, then attempts
to fetch the individual listing-detail pages it recognises and extract structured data
(make, model, year, price, location, full text) into a local SQLite database.

Nothing is sent anywhere - everything stays in a local SQLite file next to this script
(boat_listings.sqlite by default). Re-run this script anytime to pick up newly browsed
pages; already-fetched listings are skipped unless you pass --refresh.

Some sites (notably YachtWorld) actively block automated requests with bot-protection
(Cloudflare/Akamai challenges, HTTP 403). This script does not attempt to bypass that -
those listings are still recorded with their URL/title/visit metadata, just without a
successful content fetch, so you can view them yourself in a browser instead.

Usage:
    python collect_boat_listings.py                  # normal run
    python collect_boat_listings.py --max-fetch 150   # fetch more listings this run
    python collect_boat_listings.py --refresh         # re-fetch everything again
    python collect_boat_listings.py --db my.sqlite    # use a different database file
"""

import argparse
import datetime
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit, urlunsplit

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.path.join(SCRIPT_DIR, "boat_listings.sqlite")

KEYWORDS = ["yacht", "boat", "sail"]

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Known individual-listing-detail URL shapes. Search/filter/index pages on the same sites
# are intentionally excluded - those list many boats and would need different handling.
LISTING_PATTERNS = [
    ("yachtworld", re.compile(r"yachtworld\.com/yacht/[\w-]+-\d{5,}/?$", re.I)),
    ("trademe", re.compile(r"trademe\.co\.nz/.*/listing/(\d+)", re.I)),
    ("yachtsalesco", re.compile(r"yachtsalesco\.com/boats/[\w-]+/[\w-]+/[\w-]+/?$", re.I)),
    ("boattrader", re.compile(r"boattrader\.com/boat/[\w-]+-\d+/?$", re.I)),
    ("sailboatlistings", re.compile(r"sailboatlistings\.com/.+/\d+", re.I)),
]

# Sites with known, strong anti-bot protection - recorded but never auto-fetched, so we
# don't bang against (and don't try to bypass) their bot defences on every run.
BLOCKED_SITE_LABELS = {"yachtworld"}

KNOWN_MAKES = [
    "fountaine pajot", "lagoon", "leopard", "bali", "nautitech", "catana", "outremer",
    "privilege", "neel", "seawind", "gunboat", "dolphin", "broadblue", "balance", "hh",
    "voyage", "admiral", "dazcat", "prout", "antares", "dean", "royal cape", "excess", "rapido",
]

PRICE_RE = re.compile(
    r"(?:[$£€]\s?\d[\d,]*(?:\.\d{1,2})?)"
    r"|(?:\b\d[\d,]*(?:\.\d{1,2})?\s?(?:USD|NZD|AUD|GBP|EUR|CAD)\b)"
    r"|(?:\b(?:USD|NZD|AUD|GBP|EUR|CAD)\s?\d[\d,]*(?:\.\d{1,2})?\b)",
    re.I,
)


def log(msg):
    print(msg, flush=True)


# ---------------------------------------------------------------------------
# Step 1: read Edge's own History SQLite database(s)
# ---------------------------------------------------------------------------
def chrome_time_to_iso(value):
    if not value:
        return None
    try:
        dt = datetime.datetime(1601, 1, 1) + datetime.timedelta(microseconds=value)
        return dt.isoformat(sep=" ", timespec="seconds")
    except Exception:
        return None


def find_edge_profiles():
    edge_root = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "Edge", "User Data")
    if not os.path.isdir(edge_root):
        return []
    profiles = []
    for name in os.listdir(edge_root):
        hist = os.path.join(edge_root, name, "History")
        if os.path.isfile(hist):
            profiles.append((name, hist))
    return profiles


def read_edge_history_matches():
    """Copies each Edge profile's History db (to dodge the file lock while Edge is open)
    and returns every visited URL whose text contains one of KEYWORDS."""
    profiles = find_edge_profiles()
    if not profiles:
        log("No Edge 'User Data' profiles found - is Edge installed for this Windows user?")
        return []

    matches = []
    with tempfile.TemporaryDirectory(prefix="edge_hist_") as tmp_dir:
        for profile_name, hist_path in profiles:
            tmp_copy = os.path.join(tmp_dir, f"History_{profile_name.replace(' ', '_')}")
            try:
                shutil.copy2(hist_path, tmp_copy)
            except Exception as e:
                log(f"  Skipping profile '{profile_name}' ({e})")
                continue
            try:
                con = sqlite3.connect(tmp_copy)
                cur = con.cursor()
                cur.execute("SELECT url, title, visit_count, last_visit_time FROM urls")
                rows = cur.fetchall()
                con.close()
            except Exception as e:
                log(f"  Could not read history for '{profile_name}' ({e})")
                continue
            for url, title, visit_count, last_visit_time in rows:
                lu = url.lower()
                hit = next((k for k in KEYWORDS if k in lu), None)
                if hit:
                    matches.append({
                        "profile": profile_name,
                        "url": url,
                        "title": title or "",
                        "visit_count": visit_count or 0,
                        "last_visit_at": chrome_time_to_iso(last_visit_time),
                        "matched_keyword": hit,
                    })
    return matches


def base_url(url):
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, p.path, p.query, ""))


def dedupe_matches(matches):
    deduped = {}
    for m in matches:
        b = base_url(m["url"])
        if b not in deduped:
            deduped[b] = {**m, "url": b}
        else:
            deduped[b]["visit_count"] += m["visit_count"]
            if m["last_visit_at"] and (not deduped[b]["last_visit_at"] or m["last_visit_at"] > deduped[b]["last_visit_at"]):
                deduped[b]["last_visit_at"] = m["last_visit_at"]
    return list(deduped.values())


# ---------------------------------------------------------------------------
# Step 2: classify which browsed URLs look like individual listing pages
# ---------------------------------------------------------------------------
def classify_listing(url):
    for site, pattern in LISTING_PATTERNS:
        if pattern.search(url):
            return site
    return None


def listing_key(site, url):
    if site == "yachtworld":
        m = re.search(r"-(\d{5,})/?$", url)
        return f"yachtworld:{m.group(1)}" if m else f"yachtworld:{url}"
    if site == "trademe":
        m = re.search(r"/listing/(\d+)", url)
        return f"trademe:{m.group(1)}" if m else f"trademe:{url}"
    return f"{site}:{urlsplit(url).path}"


# ---------------------------------------------------------------------------
# Step 3: fetch + extract structured fields from a listing page
# ---------------------------------------------------------------------------
def parse_money(amount_str):
    digits = re.sub(r"[^\d.]", "", amount_str)
    try:
        return float(digits) if digits else None
    except ValueError:
        return None


def extract_price(text):
    m = re.search(r"price\s*[:\-]?\s*((?:[$£€]|USD|NZD|AUD|GBP|EUR|CAD)\s?\d[\d,]*(?:\.\d{1,2})?)", text, re.I)
    if m:
        return m.group(1)
    for mm in PRICE_RE.finditer(text):
        val = parse_money(mm.group(0))
        if val and val >= 10000:
            return mm.group(0)
    return None


def extract_currency(amount_str):
    if not amount_str:
        return None
    m = re.search(r"[$£€]|USD|NZD|AUD|GBP|EUR|CAD", amount_str, re.I)
    if not m:
        return None
    sym = m.group(0)
    return {"$": "USD", "£": "GBP", "€": "EUR"}.get(sym, sym.upper())


def extract_make_model_year(text):
    s = re.sub(r"[-_/]+", " ", text).strip().lower()
    year_m = re.search(r"\b(19|20)\d{2}\b", s)
    year = int(year_m.group(0)) if year_m else None
    for mk in KNOWN_MAKES:
        idx = s.find(mk)
        if idx == -1:
            continue
        rest = s[idx + len(mk):].strip().split()
        model_tokens = []
        for tok in rest[:4]:
            if re.fullmatch(r"\d{5,}", tok):
                break
            model_tokens.append(tok)
        model = " ".join(model_tokens).strip()
        return mk.title(), (model.title() if model else None), year
    return None, None, year


def fetch_url(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(), resp.headers.get_content_charset() or "utf-8"


def html_to_text(html_bytes, charset):
    html = html_bytes.decode(charset, errors="replace")
    if BeautifulSoup is not None:
        soup = BeautifulSoup(html, "lxml" if _has_lxml() else "html.parser")
        for tag in soup(["script", "style", "noscript", "template"]):
            tag.decompose()
        title = soup.title.get_text(strip=True) if soup.title else ""
        text = soup.get_text("\n")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{2,}", "\n", text)
        return title, text.strip()
    # Minimal fallback if bs4 isn't available: strip tags with a regex.
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    title_m = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
    title = re.sub(r"\s+", " ", title_m.group(1)).strip() if title_m else ""
    return title, text


def _has_lxml():
    try:
        import lxml  # noqa: F401
        return True
    except ImportError:
        return False


def fetch_and_extract(site, url):
    try:
        html_bytes, charset = fetch_url(url)
    except urllib.error.HTTPError as e:
        return {"fetch_status": "blocked" if e.code in (403, 429) else "error",
                "fetch_error": f"HTTP {e.code}"}
    except Exception as e:
        return {"fetch_status": "error", "fetch_error": f"{type(e).__name__}: {e}"}

    title, text = html_to_text(html_bytes, charset)
    make, model, year = extract_make_model_year(url + " " + title)
    price_text = extract_price(text)

    # Some sites (e.g. TradeMe) render their listing content client-side with JavaScript -
    # a plain HTTP GET only returns the near-empty app shell. Flag that distinctly rather
    # than claiming a successful, content-free fetch.
    if len(text) < 250:
        return {
            "fetch_status": "empty",
            "fetch_error": "Page returned very little text - it may require JavaScript to render "
                            "(open it in a browser and use the app's paste-import instead).",
            "title": title, "raw_text": text[:8000],
        }

    return {
        "fetch_status": "ok",
        "fetch_error": None,
        "title": title,
        "make": make,
        "model": model,
        "year": year,
        "price_text": price_text,
        "price_value": parse_money(price_text) if price_text else None,
        "currency": extract_currency(price_text),
        "raw_text": text[:8000],
    }


# ---------------------------------------------------------------------------
# Step 4: SQLite storage
# ---------------------------------------------------------------------------
def init_db(db_path):
    con = sqlite3.connect(db_path)
    con.executescript("""
        CREATE TABLE IF NOT EXISTS browsed_urls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT UNIQUE NOT NULL,
            domain TEXT,
            title TEXT,
            visit_count INTEGER,
            last_visit_at TEXT,
            matched_keyword TEXT,
            profile TEXT,
            is_listing_candidate INTEGER DEFAULT 0,
            listing_site TEXT,
            first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_key TEXT UNIQUE NOT NULL,
            site TEXT,
            url TEXT,
            title TEXT,
            make TEXT,
            model TEXT,
            year INTEGER,
            price_text TEXT,
            price_value REAL,
            currency TEXT,
            raw_text TEXT,
            fetch_status TEXT,
            fetch_error TEXT,
            fetched_at TEXT
        );
    """)
    con.commit()
    return con


def upsert_browsed_urls(con, rows):
    for r in rows:
        domain = urlsplit(r["url"]).netloc
        site = classify_listing(r["url"])
        con.execute("""
            INSERT INTO browsed_urls (url, domain, title, visit_count, last_visit_at, matched_keyword, profile, is_listing_candidate, listing_site, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(url) DO UPDATE SET
                title=excluded.title, visit_count=excluded.visit_count,
                last_visit_at=excluded.last_visit_at, profile=excluded.profile,
                is_listing_candidate=excluded.is_listing_candidate,
                listing_site=excluded.listing_site, updated_at=CURRENT_TIMESTAMP
        """, (r["url"], domain, r["title"], r["visit_count"], r["last_visit_at"],
              r["matched_keyword"], r["profile"], 1 if site else 0, site))
    con.commit()


def get_pending_listing_candidates(con, refresh):
    cur = con.execute("SELECT url, listing_site FROM browsed_urls WHERE is_listing_candidate = 1")
    candidates = cur.fetchall()
    pending = []
    for url, site in candidates:
        if site in BLOCKED_SITE_LABELS and not refresh:
            # Still worth recording a 'blocked' placeholder once, so it shows up in `listings`.
            key = listing_key(site, url)
            existing = con.execute("SELECT fetch_status FROM listings WHERE listing_key = ?", (key,)).fetchone()
            if existing:
                continue
            pending.append((url, site, key, "blocked_preknown"))
            continue
        key = listing_key(site, url)
        if not refresh:
            existing = con.execute("SELECT fetch_status FROM listings WHERE listing_key = ? AND fetch_status = 'ok'", (key,)).fetchone()
            if existing:
                continue
        pending.append((url, site, key, "fetch"))
    return pending


def save_listing(con, key, site, url, data):
    con.execute("""
        INSERT INTO listings (listing_key, site, url, title, make, model, year, price_text, price_value, currency, raw_text, fetch_status, fetch_error, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(listing_key) DO UPDATE SET
            title=excluded.title, make=excluded.make, model=excluded.model, year=excluded.year,
            price_text=excluded.price_text, price_value=excluded.price_value, currency=excluded.currency,
            raw_text=excluded.raw_text, fetch_status=excluded.fetch_status, fetch_error=excluded.fetch_error,
            fetched_at=CURRENT_TIMESTAMP
    """, (key, site, url,
          data.get("title"), data.get("make"), data.get("model"), data.get("year"),
          data.get("price_text"), data.get("price_value"), data.get("currency"),
          data.get("raw_text"), data["fetch_status"], data.get("fetch_error")))
    con.commit()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--db", default=DEFAULT_DB_PATH, help="Path to the SQLite database file")
    parser.add_argument("--max-fetch", type=int, default=80, help="Max listing pages to fetch this run")
    parser.add_argument("--delay", type=float, default=1.2, help="Seconds to wait between fetches")
    parser.add_argument("--refresh", action="store_true", help="Re-fetch listings already marked 'ok'")
    args = parser.parse_args()

    log("Reading Edge browsing history...")
    matches = read_edge_history_matches()
    deduped = dedupe_matches(matches)
    keyword_list = ", ".join(f"'{k}'" for k in KEYWORDS)
    log(f"Found {len(matches)} matching visits, {len(deduped)} distinct URLs containing "
        f"{keyword_list}.")

    con = init_db(args.db)
    upsert_browsed_urls(con, deduped)

    pending = get_pending_listing_candidates(con, args.refresh)
    to_fetch = [p for p in pending if p[3] == "fetch"][:args.max_fetch]
    to_mark_blocked = [p for p in pending if p[3] == "blocked_preknown"]

    log(f"{sum(1 for _, s, _, _ in pending if True)} listing-detail candidates total "
        f"({len(to_fetch)} to fetch now, {len(to_mark_blocked)} known-blocked sites recorded without fetching).")

    for url, site, key, _ in to_mark_blocked:
        save_listing(con, key, site, url, {
            "fetch_status": "blocked",
            "fetch_error": f"{site} uses bot-protection that blocks automated requests; open it in your browser instead.",
        })

    ok_count = blocked_count = error_count = 0
    for i, (url, site, key, _) in enumerate(to_fetch, 1):
        log(f"[{i}/{len(to_fetch)}] Fetching ({site}): {url}")
        data = fetch_and_extract(site, url)
        save_listing(con, key, site, url, data)
        if data["fetch_status"] == "ok":
            ok_count += 1
            price_bit = f" - {data.get('price_text')}" if data.get("price_text") else ""
            log(f"    OK: {data.get('make') or ''} {data.get('model') or ''} {data.get('year') or ''}{price_bit}")
        elif data["fetch_status"] == "blocked":
            blocked_count += 1
            log(f"    Blocked: {data.get('fetch_error')}")
        else:
            error_count += 1
            log(f"    Error: {data.get('fetch_error')}")
        if i < len(to_fetch):
            time.sleep(args.delay)

    total_browsed = con.execute("SELECT COUNT(*) FROM browsed_urls").fetchone()[0]
    total_listings = con.execute("SELECT COUNT(*) FROM listings").fetchone()[0]
    total_ok = con.execute("SELECT COUNT(*) FROM listings WHERE fetch_status='ok'").fetchone()[0]
    total_blocked = con.execute("SELECT COUNT(*) FROM listings WHERE fetch_status='blocked'").fetchone()[0]

    log("")
    log("=" * 60)
    log(f"Database: {args.db}")
    log(f"Total browsed URLs recorded: {total_browsed}")
    log(f"Total listing records: {total_listings}  (ok: {total_ok}, blocked: {total_blocked})")
    log(f"This run: {ok_count} fetched ok, {blocked_count} blocked, {error_count} errors")
    log("=" * 60)
    con.close()


if __name__ == "__main__":
    sys.exit(main())
