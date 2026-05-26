let data = [];
let filteredData = [];
let selectedEmails = new Set();
let lastClickedIndex = null;

// DOM Elements
const container = document.getElementById("cardContainer");
const searchInput = document.getElementById("searchInput");
const regionFilters = document.getElementById("regionFilters");
const designationFilters = document.getElementById("designationFilters");
const resultCount = document.getElementById("resultCount");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const copiedMsg = document.getElementById("copiedMsg");
const regionSearch = document.getElementById("regionSearch");
const designationSearch = document.getElementById("designationSearch");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");

// App State
const state = {
  search: "",
  activeRegions: new Set(),
  activeDesignations: new Set(),
  renderLimit: 250
};

// Hierarchy sorting
const designationOrder = [
  "Assistant Engineer",
  "Assistant Executive Engineer",
  "Executive Engineer",
  "Superintending Engineer",
  "Chief Engineer",
  "Zone Officer",
  "Circle Officer",
  "Division Officer",
  "Subdivision Officer",
  "Section Officer"
];

// Load and index data
fetch("contacts.json")
  .then(res => res.json())
  .then(json => {
    data = json.map((d, i) => ({
      ...d,
      _rowIndex: i,
      _initials: (d.officer?.name || "")
        .split(" ")
        .filter(Boolean)
        .map(n => n[0])
        .join("")
        .slice(0, 3), // Max 3 initials
      _search: [
        d.id ?? "",
        d.code ?? "",
        d.level ?? "",
        d.zone ?? "",
        d.officeName ?? "",
        d.address ?? "",
        d.officer?.name ?? "",
        d.officer?.designation ?? "",
        d.officer?.email ?? "",
        d.officer?.mobile ?? ""
      ].join(" ").toLowerCase()
    }));

    initFilters();
    render();
  });

// Utility: Debounce function for search
function debounce(fn, delay = 180) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// Render dynamic filter pills
function createPills(containerEl, values, type) {
  containerEl.innerHTML = "";

  values.forEach(v => {
    const label = document.createElement("label");
    label.className = "pill";
    // Fixed: Properly inject the hidden checkbox inside the label
    label.innerHTML = `<input type="checkbox" value="${v}" hidden> ${v}`;

    const checkbox = label.querySelector("input");

    label.addEventListener("click", (e) => {
      // Prevent double-firing from label + input interaction
      if (e.target === checkbox) return; 
      
      checkbox.checked = !checkbox.checked;
      label.classList.toggle("active", checkbox.checked);

      if (type === "region") {
        checkbox.checked ? state.activeRegions.add(v) : state.activeRegions.delete(v);
      } else {
        checkbox.checked ? state.activeDesignations.add(v) : state.activeDesignations.delete(v);
      }

      render();
    });

    containerEl.appendChild(label);
  });
}

// Initialize filters
function initFilters() {
  const regions = [...new Set(data.map(d => d.zone))].filter(Boolean).sort();

  const designations = [...new Set(data.map(d => d.officer?.designation))].filter(Boolean).sort((a, b) => {
    const ai = designationOrder.indexOf(a);
    const bi = designationOrder.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  createPills(regionFilters, regions, "region");
  createPills(designationFilters, designations, "designation");
}

// Filter engine
function getFilteredData() {
  const q = state.search;
  const hasRegionFilter = state.activeRegions.size > 0;
  const hasDesignationFilter = state.activeDesignations.size > 0;

  return data.filter(d => {
    if (q && !d._search.includes(q)) return false;
    if (hasRegionFilter && !state.activeRegions.has(d.zone)) return false;
    if (hasDesignationFilter && !state.activeDesignations.has(d.officer?.designation)) return false;
    return true;
  });
}

// Main Render Loop
function render() {
  filteredData = getFilteredData();

  // Cap DOM elements to prevent lag
  const visible = filteredData.slice(0, state.renderLimit);
  
  resultCount.textContent = filteredData.length > state.renderLimit
      ? `${filteredData.length} results • showing first ${state.renderLimit}`
      : `${filteredData.length} results`;

  container.innerHTML = visible.map((o, index) => {
    const email = o.officer?.email || "";
    const selected = selectedEmails.has(email);

    return `
      <div class="card ${selected ? "selected" : ""}" data-index="${index}" data-email="${email}">
        <input type="checkbox" ${selected ? "checked" : ""} tabindex="-1" />
        <div class="avatar">${o._initials}</div>
        <div class="name">${o.officer?.name || "Unknown"}</div>
        <div class="designation">${o.officer?.designation || ""}</div>
        <div class="meta"><i class="fa-solid fa-building"></i> ${o.officeName || ""}</div>
        <div class="meta"><i class="fa-solid fa-location-dot"></i> ${o.zone || ""} • ${o.level || ""}</div>
        <div class="meta email-row">
          <span><i class="fa-solid fa-envelope"></i> ${email}</span>
          <i class="fa-regular fa-copy copy-icon" data-copy="${email}"></i>
        </div>
        <div class="meta">
          <i class="fa-solid fa-phone"></i>
          <a href="tel:${o.officer?.mobile}">${o.officer?.mobile || ""}</a>
          <a href="https://wa.me/${(o.officer?.mobile || "").replace(/\D/g, "")}" target="_blank" rel="noopener noreferrer">
            <i class="fa-brands fa-whatsapp whatsapp"></i>
          </a>
        </div>
      </div>
    `;
  }).join("");
}

// Selection logic (handles Shift + Click range selection)
function toggleSelection(email, index, shiftKey) {
  if (!email) return;

  if (shiftKey && lastClickedIndex !== null) {
    const start = Math.min(index, lastClickedIndex);
    const end = Math.max(index, lastClickedIndex);
    for (let i = start; i <= end; i++) {
      if (filteredData[i]?.officer?.email) {
        selectedEmails.add(filteredData[i].officer.email);
      }
    }
  } else {
    if (selectedEmails.has(email)) selectedEmails.delete(email);
    else selectedEmails.add(email);
    lastClickedIndex = index;
  }

  render();
}

function showCopied() {
  copiedMsg.style.display = "block";
  setTimeout(() => {
    copiedMsg.style.display = "none";
  }, 1200);
}

// Pill quick-search filter
function filterPills(inputEl, containerEl) {
  const term = inputEl.value.toLowerCase().trim();
  containerEl.querySelectorAll(".pill").forEach(pill => {
    pill.style.display = pill.textContent.toLowerCase().includes(term) ? "flex" : "none";
  });
}

/* --- EVENT LISTENERS --- */

// Card Event Delegation (handles all clicks inside the grid efficiently)
container.addEventListener("click", e => {
  // 1. Handle Copy Icon Click
  const copyEl = e.target.closest("[data-copy]");
  if (copyEl) {
    e.stopPropagation();
    navigator.clipboard.writeText(copyEl.dataset.copy);
    showCopied();
    return;
  }

  // 2. Handle Card Selection Click
  const card = e.target.closest(".card");
  if (!card) return;
  
  // Ignore clicks on links or the checkbox directly to prevent double-firing
  if (e.target.closest("a") || e.target.tagName === "INPUT") {
    // If they clicked the checkbox, we still want to toggle selection,
    // so we let the wrapper handle the logic below, but stop native propagation.
    if (e.target.tagName !== "INPUT") return;
  }

  toggleSelection(card.dataset.email, Number(card.dataset.index), e.shiftKey);
});

// Debounced Search Input
const debouncedSearch = debounce(value => {
  state.search = value.trim().toLowerCase();
  clearSearchBtn.classList.toggle("show", value.length > 0);
  lastClickedIndex = null; // Reset shift-click anchor when search changes
  render();
}, 180);

searchInput.addEventListener("input", e => {
  debouncedSearch(e.target.value);
});

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  state.search = "";
  clearSearchBtn.classList.remove("show");
  searchInput.focus();
  render();
});

copyBtn.addEventListener("click", () => {
  if (!selectedEmails.size) return;
  navigator.clipboard.writeText([...selectedEmails].join(", "));
  showCopied();
});

clearBtn.addEventListener("click", () => {
  selectedEmails.clear();
  lastClickedIndex = null;
  render();
});

// Sidebar Pill Search
regionSearch.addEventListener("input", () => filterPills(regionSearch, regionFilters));
designationSearch.addEventListener("input", () => filterPills(designationSearch, designationFilters));

// Keyboard Shortcuts
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    searchInput.value = "";
    state.search = "";
    clearSearchBtn.classList.remove("show");
    render();
  } else if (e.ctrlKey && e.key.toLowerCase() === "a") {
    // Check if the user is typing in an input field before hijacking Ctrl+A
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    
    e.preventDefault();
    const visible = filteredData.slice(0, state.renderLimit);
    visible.forEach(d => {
      if (d.officer?.email) selectedEmails.add(d.officer.email);
    });
    render();
  }
});

// --- CSV Export Logic ---
exportCsvBtn.addEventListener("click", () => {
  if (!filteredData || filteredData.length === 0) {
    alert("No data to export.");
    return;
  }

  // 1. Define the CSV headers
  const headers = [
    "ID", "Code", "Name", "Designation", "Email", 
    "Mobile", "Office Name", "Level", "Zone", "Address"
  ];

  // 2. Build the CSV string
  const csvRows = [headers.join(",")]; // Add header row

  filteredData.forEach(d => {
    const row = [
      d.id || "",
      d.code || "",
      d.officer?.name || "",
      d.officer?.designation || "",
      d.officer?.email || "",
      d.officer?.mobile || "",
      d.officeName || "",
      d.level || "",
      d.zone || "",
      d.address || ""
    ];

    // Escape quotes and commas inside the fields
    const escapedRow = row.map(val => {
      const str = String(val).replace(/"/g, '""'); // Double up quotes for escaping
      return `"${str}"`; // Wrap every field in quotes
    });

    csvRows.push(escapedRow.join(","));
  });

  const csvString = csvRows.join("\n");

  // 3. Create a Blob and trigger the download
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  
  // Create a clean filename with today's date
  const dateStr = new Date().toISOString().split("T")[0];
  link.setAttribute("download", `bescom_contacts_${dateStr}.csv`);
  
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url); // Clean up memory
});