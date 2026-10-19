"""Create and query a persistent, sourced USD equipment-price catalogue."""

import argparse
import json
import re
import sqlite3
import subprocess
from contextlib import closing
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DEFAULT_DB = ROOT / "equipment_prices.sqlite3"
SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY,
    model TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    match_pattern TEXT NOT NULL,
    match_flags TEXT NOT NULL,
    requires_pattern TEXT,
    requires_flags TEXT,
    review_only INTEGER NOT NULL CHECK(review_only IN (0,1)),
    configuration_notes TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS exchange_rates (
    currency TEXT NOT NULL,
    rate_date TEXT NOT NULL,
    usd_per_unit TEXT NOT NULL CHECK(CAST(usd_per_unit AS REAL) > 0),
    source_url TEXT NOT NULL,
    PRIMARY KEY(currency, rate_date)
);
CREATE TABLE IF NOT EXISTS price_quotes (
    id INTEGER PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),
    amount TEXT NOT NULL CHECK(CAST(amount AS REAL) > 0),
    currency TEXT NOT NULL,
    usd_cents INTEGER NOT NULL CHECK(usd_cents > 0),
    checked_date TEXT NOT NULL,
    fx_date TEXT NOT NULL,
    source_url TEXT NOT NULL CHECK(source_url LIKE 'http%://%'),
    price_basis TEXT NOT NULL DEFAULT 'new replacement, per unit; shipping and installation excluded; tax basis see notes',
    FOREIGN KEY(currency, fx_date) REFERENCES exchange_rates(currency, rate_date),
    UNIQUE(equipment_id, source_url, checked_date, currency)
);
CREATE TABLE IF NOT EXISTS evidence_sources (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK(kind IN ('pdf_inventory','owner_report','supplier_research')),
    title TEXT NOT NULL,
    boat_model TEXT,
    source_url TEXT,
    accessed_date TEXT NOT NULL,
    notes TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS equipment_evidence (
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),
    source_id TEXT NOT NULL REFERENCES evidence_sources(id),
    relation TEXT NOT NULL DEFAULT 'identified item or selected replacement basis, not verified fitment',
    PRIMARY KEY(equipment_id, source_id)
);
CREATE TABLE IF NOT EXISTS research_requirements (
    model TEXT PRIMARY KEY,
    match_pattern TEXT NOT NULL,
    match_flags TEXT NOT NULL,
    reason TEXT NOT NULL,
    source_url TEXT
);
CREATE VIEW IF NOT EXISTS latest_equipment_prices_usd AS
SELECT e.id AS equipment_id, e.model, e.category, e.review_only,
       e.configuration_notes, p.id AS quote_id, p.amount AS original_amount,
       p.currency AS original_currency, p.usd_cents, p.usd_cents / 100.0 AS price_usd,
       p.checked_date, p.source_url, p.price_basis, p.fx_date,
       x.usd_per_unit, x.source_url AS fx_source_url
FROM equipment e
JOIN price_quotes p ON p.equipment_id = e.id
JOIN exchange_rates x ON x.currency = p.currency AND x.rate_date = p.fx_date
WHERE p.id = (
    SELECT p2.id FROM price_quotes p2 WHERE p2.equipment_id = e.id
    ORDER BY p2.checked_date DESC, p2.id DESC LIMIT 1
);
CREATE INDEX IF NOT EXISTS quotes_by_equipment_date ON price_quotes(equipment_id, checked_date DESC);
PRAGMA user_version = 1;
"""


def category_for(model: str) -> str:
    for pattern, category in [
        (r"MPPT", "Solar & Power Mgmt"),
        (r"Victron", "Electrical & Batteries"),
        (r"Fortress|Ultra", "Anchor & Windlass"),
        (r"Johnson|Whale", "Plumbing & Pumps"),
        (r"Volvo", "Engines & Drivetrain"),
        (r"PLB|bosun", "Safety & Liferaft"),
        (r"Schenker", "Watermaker"),
        (r"Highfield", "Tender & Outboard"),
    ]:
        if re.search(pattern, model, re.I):
            return category
    return "Electronics & Nav"


def read_seed() -> dict[str, Any]:
    script = """
    require('./equipment-pricing.js');
    const p = globalThis.EQUIPMENT_PRICING;
    const encode = r => ({...r, pattern:r.pattern.source, flags:r.pattern.flags,
      requires:r.requires?.source, requiresFlags:r.requires?.flags});
    process.stdout.write(JSON.stringify({checkedDate:p.checkedDate,fx:p.fx,
      references:p.references.map(encode),researchNotes:p.researchNotes.map(encode)}));
    """
    result = subprocess.run(["node", "-e", script], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def seed_database(path: Path = DEFAULT_DB, seed: dict[str, Any] | None = None) -> dict[str, int]:
    """Idempotently add researched snapshots; never delete existing quotes/evidence."""
    data = seed if seed is not None else read_seed()
    evidence = json.loads((ROOT / "equipment-price-sources.json").read_text(encoding="utf-8"))
    date.fromisoformat(data["checkedDate"])
    date.fromisoformat(data["fx"]["date"])
    models = {ref["model"] for ref in data["references"]}
    if models - evidence["products"].keys():
        raise ValueError("Every seeded product needs PDF, owner-report or supplier evidence.")
    with closing(sqlite3.connect(path)) as conn, conn:
        conn.executescript(SCHEMA)
        for currency, per_usd in data["fx"]["perUSD"].items():
            rate = Decimal(1) / Decimal(str(per_usd))
            conn.execute("INSERT OR IGNORE INTO exchange_rates VALUES (?,?,?,?)",
                         (currency, data["fx"]["date"], str(rate), data["fx"]["source"]))
        for source in evidence["sources"]:
            conn.execute(
                "INSERT OR IGNORE INTO evidence_sources VALUES (?,?,?,?,?,?,?)",
                (source["id"], source["kind"], source["title"], source["boatModel"],
                 source["url"], "2026-10-17", source["notes"]),
            )
        for ref in data["references"]:
            amount = Decimal(str(ref["amount"]))
            if not amount.is_finite() or amount <= 0 or not re.match(r"^https?://", ref["url"]):
                raise ValueError(f"Invalid sourced price: {ref['model']}")
            conn.execute(
                """INSERT OR IGNORE INTO equipment
                (model,category,match_pattern,match_flags,requires_pattern,requires_flags,review_only,configuration_notes)
                VALUES (?,?,?,?,?,?,?,?)""",
                (ref["model"], category_for(ref["model"]), ref["pattern"], ref["flags"],
                 ref.get("requires"), ref.get("requiresFlags"), int(ref.get("reviewOnly", False)), ref.get("note", "")),
            )
            equipment_id = conn.execute("SELECT id FROM equipment WHERE model=?", (ref["model"],)).fetchone()[0]
            rate = conn.execute(
                "SELECT usd_per_unit FROM exchange_rates WHERE currency=? AND rate_date=?",
                (ref["currency"], data["fx"]["date"]),
            ).fetchone()
            if rate is None:
                raise ValueError(f"Missing FX for {ref['currency']}")
            cents = int((amount * Decimal(rate[0]) * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))
            conn.execute(
                """INSERT OR IGNORE INTO price_quotes
                (equipment_id,amount,currency,usd_cents,checked_date,fx_date,source_url)
                VALUES (?,?,?,?,?,?,?)""",
                (equipment_id, str(amount), ref["currency"], cents, data["checkedDate"], data["fx"]["date"], ref["url"]),
            )
            for source_id in evidence["products"][ref["model"]]:
                conn.execute("INSERT OR IGNORE INTO equipment_evidence(equipment_id,source_id) VALUES (?,?)",
                             (equipment_id, source_id))
        for note in data["researchNotes"]:
            conn.execute("INSERT OR IGNORE INTO research_requirements VALUES (?,?,?,?,?)",
                         (note["model"], note["pattern"], note["flags"], note["note"], note.get("url")))
        counts = {table: conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
                  for table in ("equipment", "price_quotes", "evidence_sources", "equipment_evidence", "research_requirements")}
    return counts


def read_catalogue(path: Path = DEFAULT_DB, search: str = "") -> dict[str, Any]:
    """Read only: an unavailable database must not silently become an empty one."""
    with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """SELECT v.*, e.match_pattern,e.match_flags,e.requires_pattern,e.requires_flags
            FROM latest_equipment_prices_usd v JOIN equipment e ON e.id=v.equipment_id
            WHERE instr(lower(v.model || ' ' || v.category), lower(?)) > 0 ORDER BY v.model""", (search,),
        ).fetchall()
        references: list[dict[str, Any]] = []
        for row in rows:
            sources = conn.execute(
                """SELECT s.*, ee.relation FROM equipment_evidence ee
                JOIN evidence_sources s ON s.id=ee.source_id WHERE ee.equipment_id=? ORDER BY s.id""",
                (row["equipment_id"],),
            ).fetchall()
            references.append({
                "id": row["equipment_id"], "model": row["model"], "category": row["category"],
                "pattern": row["match_pattern"], "flags": row["match_flags"],
                "requires": row["requires_pattern"], "requiresFlags": row["requires_flags"],
                "reviewOnly": bool(row["review_only"]), "note": row["configuration_notes"],
                "amount": float(row["original_amount"]), "currency": row["original_currency"],
                "usd": row["price_usd"], "url": row["source_url"], "checkedDate": row["checked_date"],
                "fxDate": row["fx_date"], "fxRate": float(row["usd_per_unit"]), "fxSource": row["fx_source_url"],
                "priceBasis": row["price_basis"], "evidence": [dict(source) for source in sources],
            })
        requirements = [dict(row) for row in conn.execute("SELECT * FROM research_requirements ORDER BY model")]
    return {"database": path.name, "currency": "USD", "references": references, "researchRequirements": requirements}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--search", help="Read catalogue matching a model/category; does not seed or modify it.")
    args = parser.parse_args()
    if args.search is not None:
        print(json.dumps(read_catalogue(args.db, args.search), indent=2))
    else:
        print(json.dumps({"database": str(args.db), **seed_database(args.db)}, indent=2))


if __name__ == "__main__":
    main()
