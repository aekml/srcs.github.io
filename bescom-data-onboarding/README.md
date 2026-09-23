# BESCOM workbook conversion utility

This package converts `Field_Section_Compiled_Locked_Format.xlsx` into the `contacts.json` consumed by the directory app.

## Files

- `transformData.py` — repeatable workbook-to-JSON converter.
- `hierarchy_mappings.json` — editable canonical Zone/Circle/Division aliases.
- `contacts.json` — production output generated from the supplied workbook.
- `mapping_report.csv` — field records that are only partially mapped or unresolved.
- `contacts.schema.json` — JSON Schema for the generated output.
- `requirements.txt` — Python dependency.

## Run

```bash
python -m pip install -r requirements.txt
python transformData.py Field_Section_Compiled_Locked_Format.xlsx \
  --output contacts.json \
  --report mapping_report.csv
```

For troubleshooting, add `--debug`. This keeps `mappingStatus` and `enrichmentSource` in each JSON record:

```bash
python transformData.py Field_Section_Compiled_Locked_Format.xlsx \
  --output contacts.debug.json \
  --report mapping_report.csv \
  --debug
```

## Canonical filters

The converter emits these exact, case-sensitive values:

- Zones: `BMAZ SOUTH`, `BMAZ NORTH`, `BRAZ`, `CTAZ`.
- BMAZ SOUTH: `BANGALORE SOUTH`, `BANGALORE WEST`.
- BMAZ NORTH: `BANGALORE NORTH`, `BANGALORE CENTRAL`, `BANGALORE EAST`.
- BRAZ: `BANGALORE RURAL`, `RAMANAGARA`, `KOLAR`.
- CTAZ: `TUMKUR`, `DAVANAGERE`.

Corporate Office records intentionally have blank `zone`, `circle`, and `division` fields.

## Mapping behavior

1. The utility normalizes punctuation, spacing, abbreviations, and case for matching.
2. It resolves known Division and section-code aliases to a Circle and Zone.
3. In the ordered detail portion of `Field Section`, ambiguous rows inherit the most recent hierarchy context.
4. It enriches phone/PIN data from detailed designation sheets when a name and office match is available.
5. Placeholder number `9999999999` is discarded.
6. `mapping_report.csv` lists partial/unresolved field records for manual review.

## Refresh workflow

1. Replace the workbook with the latest version.
2. Run the converter.
3. Review `mapping_report.csv`.
4. Add verified aliases to `hierarchy_mappings.json` when required.
5. Run the converter again and copy `contacts.json` into the app root.

The supplied conversion produced 548 contacts: 387 field contacts and 161 Corporate Office contacts. Of the field contacts, 339 resolve to both Zone and Circle, 35 are Zone-only or otherwise partial, and 13 remain unresolved for manual confirmation.
