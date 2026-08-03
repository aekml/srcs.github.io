# Change Index

**Project:** Contact Directory
**Baseline:** Draft R1 — PIN identity + read-only service history
**Status:** Review package; not a production commit
**Last updated:** 2026-08-04

## Change log

| ID | Date | Status | Change | Impact |
|---|---|---|---|---|
| CD-001 | 2026-08-04 | Implemented for review | Added `officer.pin` to the contact data contract. | Establishes a stable, non-email identifier. |
| CD-002 | 2026-08-04 | Implemented for review | Changed `AppConfig.idField` from `officer.email` to `officer.pin`. | Selection, Shift-range selection, and select-all now operate on PIN values. |
| CD-003 | 2026-08-04 | Implemented for review | Retained `officer.email` as a searchable, displayed, and copyable field. | Existing contact workflows remain email-based. |
| CD-004 | 2026-08-04 | Implemented for review | Corrected bulk Copy Emails to map selected PINs back to contact email addresses. | Prevents PIN values from being copied as email output. |
| CD-005 | 2026-08-04 | Implemented for review | Added PIN to global search and card metadata. | Users can locate and verify a record by PIN. |
| CD-006 | 2026-08-04 | Implemented for review | Added static `service-history.json`. | Enables read-only Release 1 service history without a backend. |
| CD-007 | 2026-08-04 | Implemented for review | Added generic `history-timeline.js` modal controller. | Fetches/caches history data and joins it through PIN. |
| CD-008 | 2026-08-04 | Implemented for review | Added desktop overview and mobile vertical history presentation. | Preserves readability across screen sizes. |
| CD-009 | 2026-08-04 | Implemented for review | Added loading, no-history, and failed-history states. | Covers expected static-data failure and empty conditions. |

## Confirmed decisions

- Release 1 uses static, read-only JSON.
- PIN is the immutable directory identity and service-history join key.
- Email remains separate contact information and must not be overloaded as identity.
- No backend, editing, audit log, or authentication is included in this release. [code_file:138][code_file:140]

## Review constraints

- The package contains a five-contact demonstration fixture, not the complete production contacts dataset.
- The full production `contacts.json` needs a unique, stable `officer.pin` for every item before integration.
- The history sample covers only two PINs; all other contacts intentionally show the no-history state.

## Open discussion items

| ID | Topic | Decision needed before production integration |
|---|---|---|
| O-001 | PIN source | Confirm whether official PINs will be supplied or sequential placeholder PINs should be generated. |
| O-002 | History coverage | Decide which records receive service history in Release 1 and define minimum history fields. |
| O-003 | Timeline detail | Confirm whether the current native overview is sufficient or a third-party timeline library is required. |
| O-004 | Profile access | Confirm whether history opens only through `View history` or also by card click. |
| O-005 | PIN visibility | Confirm whether PIN should remain visible on every card or only in the profile dialog. |

## Approval workflow

1. Discuss a change using its `CD-*` or `O-*` identifier.
2. Mark it Approved, Revise, Deferred, or Rejected.
3. Update the review package only after agreement.
4. Commit only after an explicit `code-commit` instruction.
