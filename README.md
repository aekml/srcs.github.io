# 🚀 Generic Data Explorer Engine

A lightning-fast, highly reusable frontend application built with vanilla JavaScript, HTML, and CSS. Originally designed for a complex corporate directory, this application uses a **Generic Data Engine** that separates the data logic from the rendering logic.

You can use this app to browse, search, filter, select, and export huge datasets (like directories, product catalogs, or movie databases) straight from the browser—no backend or build tools required.

---

## ✨ Features

- **Decoupled Architecture**: Swap the dataset and UI entirely by updating a single `CONFIG` block in `app.js`.
- **Lightning Fast Search**: Uses a precomputed index and a debounced search function for lag-free text searching across tens of thousands of records.
- **Dynamic Filters**: Sidebar pill filters are auto-generated from your dataset, sortable, and support internal quick-search.
- **Smart DOM Rendering**: Uses a slice/limit render strategy (e.g., drawing only the first 250 items) to prevent browser lock-ups while keeping the full dataset in memory.
- **Rich Selection Mechanics**: 
  - Click to select/deselect individual cards.
  - **Shift + Click** for range selection.
  - **Ctrl + A** (or Cmd + A) to select all *visible* filtered matches safely.
  - **Esc** to clear search and filters quickly.
- **One-Click Export**: Download all filtered results as a safely-escaped `.csv` file instantly via the browser.
- **Copy to Clipboard**: Extract identifiers (like emails or IDs) of all selected items in one click.

---

## 🛠️ Quick Start & Setup

Because this app uses the Javascript `fetch()` API to load local JSON files, opening `index.html` directly from your file system (e.g., `file:///C:/.../index.html`) will usually result in a CORS error.

1. **Download the files** to a folder.
2. **Start a local web server** in that folder. 
   - *Using Python:* Run `python -m http.server 8000` (or `python3 -m http.server 8000`).
   - *Using VS Code:* Install the "Live Server" extension and click "Go Live".
   - *Using Node:* Run `npx serve`.
3. **Open your browser** to `http://localhost:8000`.

---

## 🏗️ Required HTML Elements

If you are building your own UI from scratch, the Generic Engine expects certain element IDs to exist in your HTML. If you omit a button (like `clearBtn`), the engine will safely ignore it, but core elements are required.

**Core Elements:**
- `<div id="cardContainer"></div>` : Where the generated cards are injected.
- `<input id="searchInput">` : The main search box.
- `<span id="resultCount"></span>` : Text displaying the match count.

**Filter Elements (IDs defined in CONFIG):**
- `<div id="regionFilters"></div>` : Container for the first filter pills.
- `<input id="regionSearch">` : Input to quick-search the first filter pills.

**Action Buttons (Optional but recommended):**
- `<button id="clearSearchBtn"></button>` : Clears the main search box.
- `<button id="copyBtn"></button>` : Copies the configured IDs (e.g., emails) of selected cards.
- `<button id="clearBtn"></button>` : Clears all selections.
- `<button id="exportCsvBtn"></button>` : Triggers the CSV export.
- `<div id="copiedMsg"></div>` : A toast message element shown when copying to clipboard.

---

## ⚙️ How to Reuse for a New Dataset

To reuse this application for a different project, you **only need to change the `CONFIG` object** at the top of `app.js`.

Here is an example `CONFIG` for a **Movie Database**:

```javascript
const CONFIG = {
  // 1. Data Source
  dataUrl: "movies.json",

  // 2. Selection Identifier (What gets copied/tracked when selecting a card)
  getSelectionId: (item) => item.id,

  // 3. Search Index (Combine all searchable fields into one lowercase string)
  getSearchText: (item) => [
    item.title, item.director, item.year, item.genre, item.language 
  ].join(" ").toLowerCase(),

  // 4. Sidebar Filters
  filters: [
    {
      name: "genre",                                 // Internal state name
      domListId: "regionFilters",                    // HTML ID to mount the pills
      domSearchId: "regionSearch",                   // HTML ID for the pill search input
      extractValue: (item) => item.genre,            // Which field to group by
      sortFn: (a, b) => a.localeCompare(b)           // Sort alphabetically
    },
    {
      name: "language",
      domListId: "designationFilters",
      domSearchId: "designationSearch",
      extractValue: (item) => item.language,
      sortFn: (a, b) => a.localeCompare(b)
    }
  ],

  // 5. CSV Export Mapping
  csvExport: {
    filenamePrefix: "movie_database",
    columns: [
      { header: "ID", getValue: d => d.id },
      { header: "Title", getValue: d => d.title },
      { header: "Director", getValue: d => d.director },
      { header: "Year", getValue: d => d.year },
      { header: "Genre", getValue: d => d.genre }
    ]
  },

  // 6. HTML Card Template
  // IMPORTANT: The outermost wrapper MUST include data-index="${index}" and data-id="${selectionId}"
  renderCard: (item, index, isSelected, selectionId) => `
    <div class="card ${isSelected ? "selected" : ""}" data-index="${index}" data-id="${selectionId}">
      <input type="checkbox" ${isSelected ? "checked" : ""} tabindex="-1" />
      <div class="name">${item.title}</div>
      <div class="meta"><i class="fa-solid fa-video"></i> ${item.director}</div>
      <div class="meta"><i class="fa-solid fa-calendar"></i> ${item.year} • ${item.language}</div>
      <!-- Add a specific copy target using data-copy -->
      <div class="meta">
         <span>ID: ${item.id}</span>
         <i class="fa-regular fa-copy copy-icon" data-copy="${item.id}"></i>
      </div>
    </div>
  `
};
```

---

## ⚡ Performance Optimizations Explained

How does this app handle 18,000+ objects without a virtual DOM framework like React?

1. **Precomputed Strings**: On load, `app.js` runs a `.map()` to generate a `_search` string property on every record. During search, the app simply runs `_search.includes(query)` instead of safely extracting, concatenating, and lowercasing 10 different nested properties on every keystroke.
2. **Event Delegation**: Instead of adding `addEventListener("click")` to 10,000 individual cards, a single lightweight listener sits on the `#cardContainer`. When a click bubbles up, it checks if it originated from a card or a copy button.
3. **Render Limiting**: `state.renderLimit` acts as a safeguard. If a dataset has 18,000 matches, the browser will freeze if forced to paint 18,000 DOM nodes. The engine limits HTML rendering to the first 250 items, but keeps all 18,000 in memory so CSV exports and stats remain perfectly accurate.
4. **Debounced Input**: The search bar waits for the user to pause typing for 180 milliseconds before executing a search cycle, vastly reducing CPU load.

---

## 🐛 Troubleshooting

- **Cards aren't selecting when clicked:** Make sure your `renderCard` template includes `data-index="${index}"` and `data-id="${selectionId}"` on the outermost `<div class="card">`.
- **CSV button does nothing:** Ensure your dataset isn't completely filtered out, and check that the `id` of your button matches `exportCsvBtn`.
- **Checkboxes inside pills aren't working:** The engine expects `createPills()` to generate `<input type="checkbox" value="..." hidden>`. If you customize the pill HTML, do not remove the hidden checkbox.
