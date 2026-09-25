#!/usr/bin/env python3
"""Convert BESCOM officer workbook → contacts.json with improved hierarchy mapping.

Improvements over v1:
  - Expanded zoneAliases to catch zone-level-only offices (Works Units, MT/HT divisions)
  - Expanded circleAliases to catch Works Unit variants per circle
  - zoneOnlyOffices: offices that legitimately sit at zone level → resolved (zone only)
  - Full mapping_report.csv now includes ALL records (not just partial/unresolved)
  - mappingStatus column always present in contacts.json (no --debug flag needed)
  - Summary printed to console with before/after comparison
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

try:
    from openpyxl import load_workbook
except ImportError as exc:
    raise SystemExit("openpyxl is required: pip install openpyxl") from exc

PLACEHOLDER_PHONES = {"9999999999", "0000000000"}
CORPORATE_MARKERS = ("corporate office", "head office")


# ── Text helpers ─────────────────────────────────────────────────────────────

def text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.strftime("%d.%m.%Y")
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def norm(value: Any) -> str:
    value = unicodedata.normalize("NFKD", text(value)).lower()
    value = value.replace("&", " and ").replace("\u200d", " ")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def clean_date(value: Any) -> str:
    raw = text(value)
    if not raw:
        return ""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    raw = raw.replace("/", ".").replace("-", ".")
    match = re.search(r"\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b", raw)
    if not match:
        return text(value)
    day, month, year = map(int, match.groups())
    if year < 100:
        year += 2000 if year <= 50 else 1900
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return text(value)


def clean_pin(value: Any) -> str:
    raw = text(value)
    return raw[:-2] if raw.endswith(".0") else raw


def extract_phones(value: Any) -> list[str]:
    raw = text(value)
    if not raw:
        return []
    candidates = re.findall(
        r"(?:\+?91[\s-]?)?(?:0\d{2,4}[\s-]?\d{5,8}|\d[\d\s/-]{7,14}\d)", raw
    )
    result: list[str] = []
    for candidate in candidates:
        digits = re.sub(r"\D", "", candidate)
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        if digits in PLACEHOLDER_PHONES or len(digits) < 9 or len(digits) > 11:
            continue
        if digits not in result:
            result.append(digits)
    return result


def canonical_designation(raw: str) -> str:
    n = norm(raw)
    if "chief controllers" in n or "chief controller" in n:
        return "Chief Controller of Accounts"
    if "deputy controller" in n:
        return "Deputy Controller of Accounts"
    if "accounts officer" in n:
        return "Accounts Officer"
    if "assistant executive engineer" in n:
        return "Assistant Executive Engineer (Civil)" if "civil" in n else "Assistant Executive Engineer"
    if "superintending engineer" in n:
        return "Superintending Engineer"
    if "executive engineer" in n:
        return "Executive Engineer (Civil)" if "civil" in n else "Executive Engineer"
    if "chief engineer" in n:
        return "Chief Engineer"
    if "chief general manager" in n:
        return "Chief General Manager"
    if "assistant general manager" in n:
        return "Assistant General Manager"
    if "deputy general manager" in n:
        return "Deputy General Manager"
    if "general manager" in n:
        return "General Manager"
    if "company secretary" in n:
        return "Company Secretary"
    if "director" in n:
        return "Director"
    return text(raw)


def category_for(designation: str, corporate: bool) -> str:
    if corporate:
        return "Corporate Office"
    n = norm(designation)
    return "Accounts" if any(x in n for x in ("account", "controller", "finance")) else "Engineer"


# ── Enrichment index ─────────────────────────────────────────────────────────

def build_enrichment_index(workbook) -> dict[str, list[dict[str, str]]]:
    layouts = {
        "SEE": (2, 3, 4, 7),
        "DCA": (2, 3, 4, 6),
        "EE(E) ": (2, 3, 4, 6),
        "EE(civil)": (2, 3, 4, None),
        "AEE(E) ": (4, 5, 6, 10),
        "AO": (3, 4, 5, 8),
        "AEE(Ele)": (3, 4, 5, 10),
        "Sheet1": (2, 3, 4, 5),
        "Sheet2": (2, 3, 4, 5),
    }
    index: dict[str, list[dict[str, str]]] = defaultdict(list)
    for sheet_name, (office_col, name_col, pin_col, phone_col) in layouts.items():
        if sheet_name not in workbook.sheetnames:
            continue
        sheet = workbook[sheet_name]
        for row_number in range(1, sheet.max_row + 1):
            name = text(sheet.cell(row_number, name_col).value)
            name_key = norm(name)
            if not name_key or name_key in {
                "vacant",
                "name of the officer serving sriyuths",
                "name of the officer vacant",
            }:
                continue
            if len(name_key) < 3:
                continue
            phones = (
                extract_phones(sheet.cell(row_number, phone_col).value)
                if phone_col
                else []
            )
            entry = {
                "name": name,
                "office": text(sheet.cell(row_number, office_col).value),
                "pin": clean_pin(sheet.cell(row_number, pin_col).value),
                "primaryPhone": phones[0] if phones else "",
                "secondaryPhones": phones[1:],
                "source": f"{sheet_name}!{row_number}",
            }
            if entry["pin"] or entry["primaryPhone"]:
                index[name_key].append(entry)
    return index


def token_score(left: str, right: str) -> int:
    a, b = set(norm(left).split()), set(norm(right).split())
    return len(a & b)


def choose_enrichment(
    index: dict[str, list[dict[str, str]]], name: str, office: str
) -> dict[str, Any]:
    candidates = index.get(norm(name), [])
    if not candidates:
        return {}
    return max(
        candidates,
        key=lambda x: (
            token_score(x["office"], office),
            bool(x["primaryPhone"]),
            bool(x["pin"]),
        ),
    )


# ── Hierarchy resolver ────────────────────────────────────────────────────────

class HierarchyResolver:
    def __init__(self, mapping: dict[str, Any]):
        self.mapping = mapping
        self.circle_to_zone = {
            circle: zone
            for zone, circles in mapping["zoneCircles"].items()
            for circle in circles
        }
        self.zone_aliases = self._compile_aliases(mapping["zoneAliases"])
        self.circle_aliases = self._compile_aliases(mapping["circleAliases"])

        self.division_aliases: list[tuple[str, str]] = []
        for division, spec in mapping["divisions"].items():
            for alias in spec["aliases"]:
                self.division_aliases.append((norm(alias), division))
        self.division_aliases.sort(key=lambda p: len(p[0]), reverse=True)

        self.code_to_division = {
            code.upper(): division
            for division, codes in mapping.get("sectionCodes", {}).items()
            for code in codes
        }

        # Zone-only office patterns (legitimately no circle/division)
        self.zone_only: list[tuple[str, str]] = []
        for zone, patterns in mapping.get("zoneOnlyOffices", {}).items():
            for pat in patterns:
                self.zone_only.append((norm(pat), zone))
        self.zone_only.sort(key=lambda p: len(p[0]), reverse=True)

    @staticmethod
    def _compile_aliases(groups: dict[str, list[str]]) -> list[tuple[str, str]]:
        result = [
            (norm(alias), canonical)
            for canonical, aliases in groups.items()
            for alias in aliases
        ]
        return sorted(result, key=lambda p: len(p[0]), reverse=True)

    @staticmethod
    def _contains(haystack: str, needle: str) -> bool:
        if not needle:
            return False
        if re.search(rf"(?:^|\s){re.escape(needle)}(?:$|\s)", haystack):
            return True
        cn = re.sub(r"[^a-z0-9]", "", needle)
        ch = re.sub(r"[^a-z0-9]", "", haystack)
        return len(cn) >= 6 and cn in ch

    def _match(self, office_norm: str, aliases: list[tuple[str, str]]) -> str:
        for alias, canonical in aliases:
            if self._contains(office_norm, alias):
                return canonical
        return ""

    def _division_from_code(self, raw_office: str) -> str:
        upper = text(raw_office).upper()
        codes = re.findall(r"(?<![A-Z0-9])([SNEWCK]-?\d{1,2})(?![A-Z0-9])", upper)
        for raw_code in codes:
            code = raw_code.replace("-", "")
            if code in self.code_to_division:
                return self.code_to_division[code]
        return ""

    def resolve(self, office: str, corporate: bool = False) -> dict[str, str]:
        if corporate or any(marker in norm(office) for marker in CORPORATE_MARKERS):
            return {
                "zone": "",
                "circle": "",
                "division": "",
                "mappingStatus": "not_applicable",
            }

        office_norm = norm(office)

        # Check zone-only patterns first (e.g. Works Units, MT/HT divisions at zone level)
        for pat, zone in self.zone_only:
            if self._contains(office_norm, pat):
                return {
                    "zone": zone,
                    "circle": "",
                    "division": "",
                    "mappingStatus": "zone_only",
                }

        # Try division match
        division = ""
        for alias, canonical in self.division_aliases:
            if self._contains(office_norm, alias):
                division = canonical
                break
        if not division:
            division = self._division_from_code(office)

        # Derive circle from division, then try explicit circle match
        circle = (
            self.mapping["divisions"].get(division, {}).get("circle", "")
            if division
            else ""
        )
        explicit_circle = self._match(office_norm, self.circle_aliases)
        if explicit_circle and not circle:
            circle = explicit_circle

        # Derive zone
        zone = self.circle_to_zone.get(circle, "")
        explicit_zone = self._match(office_norm, self.zone_aliases)
        if explicit_zone and not zone:
            zone = explicit_zone

        # Correct zone if circle doesn't belong to it
        if zone and circle and circle not in self.mapping["zoneCircles"].get(zone, []):
            zone = self.circle_to_zone.get(circle, zone)

        if zone and circle:
            status = "resolved"
        elif zone or circle or division:
            status = "partial"
        else:
            status = "unresolved"

        return {"zone": zone, "circle": circle, "division": division, "mappingStatus": status}


# ── Level inference ───────────────────────────────────────────────────────────

def infer_level(office: str, hierarchy: dict[str, str], corporate: bool) -> str:
    n = norm(office)
    if corporate:
        return "Corporate Office"
    if "sub division" in n or "sub div" in n or re.search(r"\b[snewck]\s*\d{1,2}\b", n):
        return "Subdivision"
    if "section" in n and "division" not in n:
        return "Section"
    if (
        hierarchy["division"]
        or "division" in n
        or " div " in f" {n} "
        or "works unit" in n
    ):
        return "Division"
    if hierarchy["circle"] or "circle" in n:
        return "Circle"
    if hierarchy["zone"] or "zone" in n:
        return "Zone"
    return "Office"


# ── Record builder ────────────────────────────────────────────────────────────

def record_from_row(
    row: tuple[Any, ...],
    source_sheet: str,
    source_row: int,
    resolver: HierarchyResolver,
    enrichment: dict[str, list[dict[str, str]]],
    hierarchy_override: dict[str, str] | None = None,
) -> dict[str, Any] | None:
    corporate = source_sheet == "Corporate Office"
    if corporate:
        serial, name, raw_designation, raw_phone, office, section, charge_date = (
            list(row) + [None] * 7
        )[:7]
        office_name = text(section) or text(office) or "Corporate Office"
        address = text(office) or "Corporate Office"
    else:
        serial, name, raw_designation, raw_phone, office, charge_date = (
            list(row) + [None] * 6
        )[:6]
        section = ""
        office_name = text(office)
        address = office_name

    name = text(name)
    if not name or norm(name) in {"name", "vacant"}:
        return None

    raw_designation = text(raw_designation)
    designation = canonical_designation(raw_designation)
    hierarchy = hierarchy_override or resolver.resolve(office_name, corporate)

    enriched = choose_enrichment(enrichment, name, office_name)
    workbook_phones = extract_phones(raw_phone)
    phones = workbook_phones if workbook_phones else (
        [enriched.get("primaryPhone", "")] if enriched.get("primaryPhone") else []
    )
    for phone in enriched.get("secondaryPhones", []):
        if phone and phone not in phones:
            phones.append(phone)

    serial_text = clean_pin(serial) or str(source_row - 1)
    prefix = "CO" if corporate else "FS"

    return {
        "id": f"{prefix}-{serial_text}",
        "code": f"{prefix}-{serial_text}",
        "sourceSheet": source_sheet,
        "sourceRow": source_row,
        "level": infer_level(office_name, hierarchy, corporate),
        "zone": hierarchy["zone"],
        "circle": hierarchy["circle"],
        "division": hierarchy["division"],
        "subdivision": "",
        "section": text(section),
        "category": category_for(designation, corporate),
        "status": "Active",
        "officeName": office_name,
        "address": address,
        "dateOfAssumingCharge": clean_date(charge_date),
        "remarks": "",
        "officer": {
            "name": name,
            "designation": designation,
            "rawDesignation": raw_designation,
            "pinNumber": enriched.get("pin", ""),
            "email": "",
            "primaryPhone": phones[0] if phones else "",
            "secondaryPhones": phones[1:] if len(phones) > 1 else [],
            "mobile": phones[0] if phones else "",
        },
        # Internal only — used by report writers, stripped before writing contacts.json
        "_mappingStatus": hierarchy["mappingStatus"],
    }


# ── Report writer (ALL records, not just problem ones) ────────────────────────

def write_full_report(path: Path, records: list[dict[str, Any]]) -> None:
    """Write every record to CSV so you can filter/sort in Excel."""
    fields = [
        "id", "sourceSheet", "sourceRow", "name", "designation",
        "officeName", "zone", "circle", "division", "mappingStatus",
        "primaryPhone", "dateOfAssumingCharge",
    ]
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for r in records:
            writer.writerow({
                "id": r["id"],
                "sourceSheet": r["sourceSheet"],
                "sourceRow": r["sourceRow"],
                "name": r["officer"]["name"],
                "designation": r["officer"]["designation"],
                "officeName": r["officeName"],
                "zone": r["zone"],
                "circle": r["circle"],
                "division": r["division"],
                "mappingStatus": r["_mappingStatus"],
                "primaryPhone": r["officer"]["primaryPhone"],
                "dateOfAssumingCharge": r["dateOfAssumingCharge"],
            })


def write_problems_report(path: Path, records: list[dict[str, Any]]) -> None:
    """Write only partial/unresolved records — the ones that need attention."""
    fields = [
        "id", "sourceSheet", "sourceRow", "name", "designation",
        "officeName", "zone", "circle", "division", "mappingStatus",
    ]
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for r in records:
            if r["_mappingStatus"] in {"partial", "unresolved"}:
                writer.writerow({
                    "id": r["id"],
                    "sourceSheet": r["sourceSheet"],
                    "sourceRow": r["sourceRow"],
                    "name": r["officer"]["name"],
                    "designation": r["officer"]["designation"],
                    "officeName": r["officeName"],
                    "zone": r["zone"],
                    "circle": r["circle"],
                    "division": r["division"],
                    "mappingStatus": r["_mappingStatus"],
                })


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert BESCOM officer workbook to contacts.json (v2)"
    )
    parser.add_argument("input", type=Path, help="Input .xlsx workbook")
    parser.add_argument(
        "-o", "--output", type=Path, default=Path("contacts.json"),
        help="Output contacts JSON (default: contacts.json)",
    )
    parser.add_argument(
        "-m", "--mappings", type=Path,
        default=Path(__file__).with_name("hierarchy_mappings_v2.json"),
        help="Hierarchy mappings JSON (default: hierarchy_mappings_v2.json)",
    )
    parser.add_argument(
        "-r", "--report", type=Path, default=Path("mapping_report.csv"),
        help="Problems-only CSV: partial + unresolved rows (default: mapping_report.csv)",
    )
    parser.add_argument(
        "--full-report", type=Path, default=Path("mapping_report_full.csv"),
        help="Full CSV with ALL records and their mapping status (default: mapping_report_full.csv)",
    )
    args = parser.parse_args()

    if not args.input.exists():
        parser.error(f"Input workbook not found: {args.input}")
    if not args.mappings.exists():
        parser.error(
            f"Mapping file not found: {args.mappings}\n"
            "Use -m to specify the path, or name it hierarchy_mappings_v2.json"
        )

    mapping = json.loads(args.mappings.read_text(encoding="utf-8"))
    resolver = HierarchyResolver(mapping)
    workbook = load_workbook(args.input, read_only=True, data_only=True)

    required = {"Field Section", "Corporate Office"}
    missing = required - set(workbook.sheetnames)
    if missing:
        raise SystemExit(f"Missing required sheet(s): {', '.join(sorted(missing))}")

    enrichment = build_enrichment_index(workbook)
    records: list[dict[str, Any]] = []

    for sheet_name in ("Field Section", "Corporate Office"):
        sheet = workbook[sheet_name]
        context: dict[str, str] = {"zone": "", "circle": "", "division": ""}

        for row_number, row in enumerate(
            sheet.iter_rows(min_row=2, values_only=True), start=2
        ):
            hierarchy_override = None

            if sheet_name == "Field Section":
                serial = clean_pin(row[0] if row else "")
                direct = resolver.resolve(
                    text(row[4] if len(row) > 4 else ""), False
                )
                try:
                    ordered_detail = int(float(serial)) >= 114
                except (TypeError, ValueError):
                    ordered_detail = False

                if ordered_detail:
                    if direct["division"]:
                        context = {k: direct[k] for k in ("zone", "circle", "division")}
                    elif direct["circle"]:
                        context = {
                            "zone": direct["zone"],
                            "circle": direct["circle"],
                            "division": "",
                        }
                    elif direct["zone"]:
                        context = {"zone": direct["zone"], "circle": "", "division": ""}
                    else:
                        direct.update(context)
                        if direct["zone"] and direct["circle"]:
                            direct["mappingStatus"] = "resolved"
                        elif direct["zone"] or direct["circle"] or direct["division"]:
                            direct["mappingStatus"] = "partial"
                hierarchy_override = direct

            record = record_from_row(
                row, sheet_name, row_number, resolver, enrichment, hierarchy_override
            )
            if record:
                records.append(record)

    # Duplicate ID check
    ids = [r["id"] for r in records]
    if len(ids) != len(set(ids)):
        raise SystemExit("Duplicate record IDs detected — conversion stopped")

    # Write outputs
    for p in (args.output.parent, args.report.parent, args.full_report.parent):
        p.mkdir(parents=True, exist_ok=True)

    # Write reports first (they need _mappingStatus)
    write_problems_report(args.report, records)
    write_full_report(args.full_report, records)

    # Strip internal _mappingStatus before writing contacts.json
    for r in records:
        r.pop("_mappingStatus", None)

    args.output.write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # ── Summary ──
    field = [r for r in records if r["category"] != "Corporate Office"]
    corp = [r for r in records if r["category"] == "Corporate Office"]

    # Re-derive status counts from the full report CSV since _mappingStatus is stripped
    status_counts: dict[str, int] = defaultdict(int)
    import csv as _csv
    with args.full_report.open(encoding="utf-8-sig") as fh:
        for row in _csv.DictReader(fh):
            if row["sourceSheet"] == "Field Section":
                status_counts[row["mappingStatus"]] += 1

    resolved   = status_counts.get("resolved", 0)
    zone_only  = status_counts.get("zone_only", 0)
    partial    = status_counts.get("partial", 0)
    unresolved = status_counts.get("unresolved", 0)
    total_field = len(field)

    print(f"\n{'='*52}")
    print(f"  BESCOM contacts.json — v2 transformation")
    print(f"{'='*52}")
    print(f"  Total records written : {len(records)}")
    print(f"  Corporate Office      : {len(corp)}")
    print(f"  Field officers        : {total_field}")
    print(f"{'─'*52}")
    print(f"  Mapping breakdown (field officers only):")
    print(f"    ✅ resolved          : {resolved:4d}  ({resolved/total_field*100:.1f}%)")
    print(f"    🏢 zone_only         : {zone_only:4d}  ({zone_only/total_field*100:.1f}%)")
    print(f"    ⚠️  partial           : {partial:4d}  ({partial/total_field*100:.1f}%)")
    print(f"    ❌ unresolved        : {unresolved:4d}  ({unresolved/total_field*100:.1f}%)")
    print(f"{'─'*52}")
    print(f"  Outputs:")
    print(f"    {args.output}           ← all contacts")
    print(f"    {args.report}   ← partial/unresolved only")
    print(f"    {args.full_report} ← every record with status")
    print(f"{'='*52}\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
