#!/usr/bin/env python3
"""Offline XLSX-to-JSON converter for BESCOM contacts.

Usage:
  python transformData.py input.xlsx -o contacts.json

Optional:
  --field-sheet "Field Section" --corporate-sheet "Corporate Office"
"""
import argparse, json, math, re
from datetime import datetime
import pandas as pd

EMAIL_COLUMNS = ["Email", "Email ID", "Email Id", "E-mail", "Official Email", "Official Email ID"]
PHONE_COLUMNS = ["Official Mobile Number", "Official Mobile", "Mobile Number", "Contact No.", "Contact No", "Phone", "Phone Number"]
NAME_COLUMNS = ["Name", "Name of the Officer", "Name of the Officer serving"]
DESIGNATION_COLUMNS = ["Designation", "Workplace, Office Name/Place/Designation"]
PLACE_COLUMNS = ["Place of Working", "Office Name", "Office", "Workplace"]
DATE_COLUMNS = ["Presumed Charge from dd-mm-yyyy", "Date of assuming charge", "Date of Assuming Charge"]
PIN_COLUMNS = ["PIN Number", "PIN No", "PIN"]
PLACEHOLDER_PHONES = {"9999999999", "0000000000"}


def clean(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    return str(value).strip()


def column_value(row, candidates):
    columns = {str(c).strip().casefold(): c for c in row.index}
    for candidate in candidates:
        key = candidate.casefold()
        if key in columns:
            return row.get(columns[key])
    return None


def normalize_email(value):
    value = clean(value).lower()
    return value if value and "@" in value else None


def normalize_phones(value):
    parts = re.split(r"[/,;]", clean(value))
    phones = []
    for part in parts:
        digits = re.sub(r"\D", "", part)
        if len(digits) > 10:
            digits = digits[-10:]
        if len(digits) == 10 and digits not in PLACEHOLDER_PHONES:
            phones.append(digits)
    return (phones[0] if phones else None), phones[1:]


def normalize_date(value):
    text = clean(value)
    if not text:
        return None
    text = text.replace("/", ".").replace("-", ".")
    for fmt in ("%d.%m.%Y", "%d.%m.%y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def rank(designation):
    d = designation.casefold()
    if "company secretary" in d: return "Company Secretary"
    if "director" in d: return "Director"
    if "chief general manager" in d: return "CGM"
    if "deputy general manager" in d: return "DGM"
    if "assistant general manager" in d: return "AGM"
    if "general manager" in d: return "GM"
    return None


def record_from_row(row, record_id, corporate=False):
    name = clean(column_value(row, NAME_COLUMNS))
    designation = clean(column_value(row, DESIGNATION_COLUMNS))
    office = clean(column_value(row, PLACE_COLUMNS))
    email = normalize_email(column_value(row, EMAIL_COLUMNS))
    phone, secondary = normalize_phones(column_value(row, PHONE_COLUMNS))
    pin = clean(column_value(row, PIN_COLUMNS)) or None
    if not (name or designation or office):
        return None
    vacant = not name or name.casefold() == "vacant"
    return {
        "id": record_id,
        "officer": {
            "name": None if vacant else name,
            "designation": designation or None,
            "pinNumber": pin,
            "email": email,
            "primaryPhone": phone,
            "secondaryPhones": secondary
        },
        "status": "Vacant" if vacant else "Active",
        "category": "Corporate Office" if corporate else ("Accounts" if "account" in designation.casefold() else "Engineer"),
        "subCategory": rank(designation) if corporate else None,
        "officeName": office or None,
        "section": clean(column_value(row, ["Section"])) or None,
        "dateOfAssumingCharge": normalize_date(column_value(row, DATE_COLUMNS)),
        "remarks": None
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_xlsx")
    parser.add_argument("-o", "--output", default="contacts.json")
    parser.add_argument("--field-sheet", default="Field Section")
    parser.add_argument("--corporate-sheet", default="Corporate Office")
    args = parser.parse_args()

    records = []
    for sheet, corporate in ((args.field_sheet, False), (args.corporate_sheet, True)):
        frame = pd.read_excel(args.input_xlsx, sheet_name=sheet)
        for _, row in frame.iterrows():
            record = record_from_row(row, f"c{len(records)+1}", corporate)
            if record:
                records.append(record)

    with open(args.output, "w", encoding="utf-8") as out:
        json.dump(records, out, ensure_ascii=False, indent=2)
    print(f"Wrote {len(records)} records to {args.output}")


if __name__ == "__main__":
    main()
