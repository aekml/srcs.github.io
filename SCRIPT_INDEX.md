# Script Index

**Project:** Contact Directory
**Baseline:** Draft R1 — PIN identity + read-only service history
**Status:** Review package; not a production commit
**Last updated:** 2026-08-04

## Runtime entry point

| File | Purpose | Depends on |
|---|---|---|
| `contact-directory.html` | Static application shell, directory controls, card mount, responsive service-history dialog. | `style.css`, Font Awesome CDN, `config.js`, `history-timeline.js`, `app.js` |

## Configuration and data

| File | Purpose | Key contract |
|---|---|---|
| `config.js` | Declares data URLs, fields, filters, card content, and history mappings. | `AppConfig.idField` is `officer.pin` |
| `contacts.json` | Read-only directory source data. | Every item requires a unique `officer.pin`; email remains at `officer.email` |
| `service-history.json` | Read-only service-history source data. | `itemId` must exactly match a contact PIN |

## Application logic

| File | Purpose | Public/critical behavior |
|---|---|---|
| `app.js` | Loads contacts, builds filters, searches, renders cards, manages selection and copy actions. | `selectedIds` stores PINs; bulk copy resolves those PINs back to `officer.email` |
| `history-timeline.js` | Loads/caches service history and controls the profile-history dialog. | `HistoryTimeline.open(item, trigger)` and `HistoryTimeline.close()` |

## Presentation

| File | Purpose | Responsive behavior |
|---|---|---|
| `style.css` | Directory layout, sidebar, cards, modal, timeline, and mobile styles. | Desktop presents an overview timeline; mobile presents a vertical history list |

## Loading order

```html
<script src="config.js"></script>
<script src="history-timeline.js"></script>
<script src="app.js"></script>
```

`config.js` must load first because both runtime modules read `AppConfig`. `history-timeline.js` must load before `app.js` because the card action invokes `HistoryTimeline.open()`. [code_file:140][code_file:143][code_file:139]

## Identity and joins

```text
contacts.json.officer.pin
          │
          ├── AppConfig.idField
          ├── selectedIds
          ├── range selection / select-all
          └── service-history.json.itemId

contacts.json.officer.email
          │
          ├── Card display
          ├── Individual copy action
          ├── Bulk Copy Emails output
          └── Email search
```

## Local review

Serve the directory through a static web server; browser file URLs can block JSON `fetch()` requests. Open `contact-directory.html` once the server is running. [code_file:138]
