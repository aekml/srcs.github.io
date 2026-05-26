/* ==========================================================================
   1. APP CONFIGURATION (DATA-SPECIFIC LOGIC)
   Change this section to reuse the app for completely different datasets.
   ========================================================================== */

const designationOrder = [
  "Assistant Engineer", "Assistant Executive Engineer", "Executive Engineer",
  "Superintending Engineer", "Chief Engineer", "Zone Officer", "Circle Officer",
  "Division Officer", "Subdivision Officer", "Section Officer"
];

const CONFIG = {
  // Data Source
  dataUrl: "contacts.json",

  // What unique ID represents a selected item?
  getSelectionId: (item) => item.officer?.email,

  // String builder for the global text search
  getSearchText: (item) => [
    item.id, item.code, item.level, item.zone, item.officeName, item.address,
    item.officer?.name, item.officer?.designation, item.officer?.email, item.officer?.mobile
  ].join(" ").toLowerCase(),

  // Sidebar Filters definition
  filters: [
    {
      name: "region", // Internal state name
      domListId: "regionFilters", // HTML ID of the pills container
      domSearchId: "regionSearch", // HTML ID of the pill search box
      extractValue: (item) => item.zone, // How to get the filter value from data
      sortFn: (a, b) => a.localeCompare(b) // Alphabetical sort
    },
    {
      name: "designation",
      domListId: "designationFilters",
      domSearchId: "designationSearch",
      extractValue: (item) => item.officer?.designation,
      sortFn: (a, b) => { // Custom hierarchy sort
        const ai = designationOrder.indexOf(a);
        const bi = designationOrder.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b);
      }
    }
  ],

  // CSV Export definition
  csvExport: {
    filenamePrefix: "bescom_contacts",
    columns: [
      { header: "ID", getValue: d => d.id },
      { header: "Code", getValue: d => d.code },
      { header: "Name", getValue: d => d.officer?.name },
      { header: "Designation", getValue: d => d.officer?.designation },
      { header: "Email", getValue: d => d.officer?.email },
      { header: "Mobile", getValue: d => d.officer?.mobile },
      { header: "Office Name", getValue: d => d.officeName },
      { header: "Level", getValue: d => d.level },
      { header: "Zone", getValue: d => d.zone },
      { header: "Address", getValue: d => d.address }
    ]
  },

  // HTML Template for a single card
  // MUST include: `data-index="${index}"` and `data-id="${selectionId}"` on the .card wrapper
  renderCard: (item, index, isSelected, selectionId) => {
    const initials = (item.officer?.name || "").split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 3);
    const email = item.officer?.email || "";
    
    return `
      <div class="card ${isSelected ? "selected" : ""}" data-index="${index}" data-id="${selectionId}">
        <input type="checkbox" ${isSelected ? "checked" : ""} tabindex="-1" />
        <div class="avatar">${initials}</div>
        <div class="name">${item.officer?.name || "Unknown"}</div>
        <div class="designation">${item.officer?.designation || ""}</div>
        <div class="meta"><i class="fa-solid fa-building"></i> ${item.officeName || ""}</div>
        <div class="meta"><i class="fa-solid fa-location-dot"></i> ${item.zone || ""} • ${item.level || ""}</div>
        <div class="meta email-row">
          <span><i class="fa-solid fa-envelope"></i> ${email}</span>
          <i class="fa-regular fa-copy copy-icon" data-copy="${email}"></i>
        </div>
        <div class="meta">
          <i class="fa-solid fa-phone"></i>
          <a href="tel:${item.officer?.mobile}">${item.officer?.mobile || ""}</a>
          <a href="https://wa.me/${(item.officer?.mobile || "").replace(/\D/g, "")}" target="_blank" rel="noopener noreferrer">
            <i class="fa-brands fa-whatsapp whatsapp"></i>
          </a>
        </div>
      </div>
    `;
  }
};


/* ==========================================================================
   2. GENERIC DATA ENGINE (DATA-AGNOSTIC)
   This logic doesn't care if it's processing engineers, books, or products.
   ========================================================================== */

let data = [];
let filteredData = [];
let selectedItems = new Set();
let lastClickedIndex = null;

// Core DOM Elements
const container = document.getElementById("cardContainer");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const resultCount = document.getElementById("resultCount");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const copiedMsg = document.getElementById("copiedMsg");

// App State
const state = {
  search: "",
  activeFilters: {}, // Populated dynamically from CONFIG
  renderLimit: 250
};

// Initialize State
CONFIG.filters.forEach(f => {
  state.activeFilters[f.name] = new Set();
});

// Boot the App
fetch(CONFIG.dataUrl)
  .then(res => res.json())
  .then(json => {
    data = json.map((d, i) => ({
      ...d,
      _rowIndex: i,
      _search: CONFIG.getSearchText(d)
    }));

    initFilters();
    render();
  });

// Setup dynamic filters
function initFilters() {
  CONFIG.filters.forEach(f => {
    const values = [...new Set(data.map(f.extractValue))].filter(Boolean);
    if (f.sortFn) values.sort(f.sortFn);

    const listEl = document.getElementById(f.domListId);
    if (listEl) createPills(listEl, values, f.name);

    const searchEl = document.getElementById(f.domSearchId);
    if (searchEl) {
      searchEl.addEventListener("input", () => {
        const term = searchEl.value.toLowerCase().trim();
        listEl.querySelectorAll(".pill").forEach(pill => {
          pill.style.display = pill.textContent.toLowerCase().includes(term) ? "flex" : "none";
        });
      });
    }
  });
}

function createPills(containerEl, values, filterName) {
  containerEl.innerHTML = "";
  values.forEach(v => {
    const label = document.createElement("label");
    label.className = "pill";
    label.innerHTML = `<input type="checkbox" value="${v}" hidden> ${v}`;
    const checkbox = label.querySelector("input");

    label.addEventListener("click", (e) => {
      if (e.target === checkbox) return; 
      checkbox.checked = !checkbox.checked;
      label.classList.toggle("active", checkbox.checked);

      if (checkbox.checked) state.activeFilters[filterName].add(v);
      else state.activeFilters[filterName].delete(v);

      render();
    });
    containerEl.appendChild(label);
  });
}

// Universal filter function
function getFilteredData() {
  const q = state.search;
  return data.filter(d => {
    // 1. Text Search Check
    if (q && !d._search.includes(q)) return false;

    // 2. Loop through all configured category filters
    for (const f of CONFIG.filters) {
      const activeSet = state.activeFilters[f.name];
      if (activeSet.size > 0 && !activeSet.has(f.extractValue(d))) {
        return false;
      }
    }
    return true;
  });
}

function render() {
  filteredData = getFilteredData();
  const visible = filteredData.slice(0, state.renderLimit);
  
  resultCount.textContent = filteredData.length > state.renderLimit
      ? `${filteredData.length} results • showing first ${state.renderLimit}`
      : `${filteredData.length} results`;

  container.innerHTML = visible.map((item, index) => {
    const selectionId = CONFIG.getSelectionId(item);
    const isSelected = selectedItems.has(selectionId);
    return CONFIG.renderCard(item, index, isSelected, selectionId);
  }).join("");
}

// Range Selection engine
function toggleSelection(selectionId, index, shiftKey) {
  if (!selectionId) return;

  if (shiftKey && lastClickedIndex !== null) {
    const start = Math.min(index, lastClickedIndex);
    const end = Math.max(index, lastClickedIndex);
    for (let i = start; i <= end; i++) {
      const sId = CONFIG.getSelectionId(filteredData[i]);
      if (sId) selectedItems.add(sId);
    }
  } else {
    if (selectedItems.has(selectionId)) selectedItems.delete(selectionId);
    else selectedItems.add(selectionId);
    lastClickedIndex = index;
  }
  render();
}

function showCopied() {
  copiedMsg.style.display = "block";
  setTimeout(() => copiedMsg.style.display = "none", 1200);
}

// Debounce Utility
function debounce(fn, delay = 180) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

/* --- EVENT LISTENERS --- */

// Card Grid delegation
container.addEventListener("click", e => {
  const copyEl = e.target.closest("[data-copy]");
  if (copyEl) {
    e.stopPropagation();
    navigator.clipboard.writeText(copyEl.dataset.copy);
    showCopied();
    return;
  }

  const card = e.target.closest(".card");
  if (!card) return;
  if (e.target.closest("a") || (e.target.tagName === "INPUT" && e.target.tagName !== "INPUT")) return;
  
  toggleSelection(card.dataset.id, Number(card.dataset.index), e.shiftKey);
});

// Search functionality
searchInput.addEventListener("input", debounce(e => {
  state.search = e.target.value.trim().toLowerCase();
  clearSearchBtn.classList.toggle("show", state.search.length > 0);
  lastClickedIndex = null;
  render();
}, 180));

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  state.search = "";
  clearSearchBtn.classList.remove("show");
  searchInput.focus();
  render();
});

// Selection actions
if (copyBtn) {
  copyBtn.addEventListener("click", () => {
    if (!selectedItems.size) return;
    navigator.clipboard.writeText([...selectedItems].join(", "));
    showCopied();
  });
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    selectedItems.clear();
    lastClickedIndex = null;
    render();
  });
}

// Generic CSV Export
if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", () => {
    if (!filteredData || filteredData.length === 0) {
      alert("No data to export.");
      return;
    }

    const headers = CONFIG.csvExport.columns.map(c => c.header);
    const csvRows = [headers.join(",")];

    filteredData.forEach(d => {
      const row = CONFIG.csvExport.columns.map(c => {
        const val = c.getValue(d) || "";
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(row.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    
    link.href = url;
    link.download = `${CONFIG.csvExport.filenamePrefix}_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}

// Keyboard actions
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    searchInput.value = "";
    state.search = "";
    clearSearchBtn.classList.remove("show");
    render();
  } else if (e.ctrlKey && e.key.toLowerCase() === "a") {
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    e.preventDefault();
    const visible = filteredData.slice(0, state.renderLimit);
    visible.forEach(d => {
      const sId = CONFIG.getSelectionId(d);
      if (sId) selectedItems.add(sId);
    });
    render();
  }
});