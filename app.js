/* ============ GENERIC STATE ============ */
let data = [];
let selectedIds = new Set();
let lastClickedIndex = null;

/* ============ DOM REFS ============ */
const container = document.getElementById("cardContainer");
const searchInput = document.getElementById("searchInput");
const resultCount = document.getElementById("resultCount");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const copiedMsg = document.getElementById("copiedMsg");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const appRoot = document.querySelector(".app");
const emptyState = document.getElementById("emptyState");
const filtersRoot = document.getElementById("filtersRoot");   // sidebar container for dynamic filter sections

/* ============ UTIL: dot-path getter ============ */
function getVal(obj, path) {
    return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

/* ============ INITIAL LOAD ============ */
fetch(AppConfig.dataUrl)
    .then(res => res.json())
    .then(json => {
        data = json;
        buildFilterSections();
        render();
    });

/* ============ DYNAMIC FILTER UI BUILD ============ */
const activeFilterValues = {};   // { filterKey: Set(values) }

function buildFilterSections() {
    filtersRoot.innerHTML = "";
    AppConfig.filters.forEach(filterDef => {
        activeFilterValues[filterDef.key] = new Set();

        const section = document.createElement("div");
        section.className = "filter-section";

        const heading = document.createElement("h4");
        heading.textContent = filterDef.label;
        section.appendChild(heading);

        const searchBox = document.createElement("input");
        searchBox.className = "filter-search";
        searchBox.placeholder = filterDef.searchPlaceholder || `Search ${filterDef.label}...`;
        section.appendChild(searchBox);

        const pillsDiv = document.createElement("div");
        pillsDiv.className = "filter-list pills";
        section.appendChild(pillsDiv);

        filtersRoot.appendChild(section);

        const values = getSortedFilterValues(filterDef);
        createPills(pillsDiv, values, filterDef.key);

        searchBox.addEventListener("input", () => filterPills(searchBox, pillsDiv));
    });
}

function getSortedFilterValues(filterDef) {
    const values = [...new Set(data.map(d => getVal(d, filterDef.key)))];

    if (Array.isArray(filterDef.sortOrder)) {
        return values.sort((a, b) => {
            const ai = filterDef.sortOrder.indexOf(a);
            const bi = filterDef.sortOrder.indexOf(b);
            if (ai !== -1 && bi !== -1) return ai - bi;
            if (ai !== -1) return -1;
            if (bi !== -1) return 1;
            return a.localeCompare(b);
        });
    }
    return values.sort();
}

function createPills(container, values, filterKey) {
    container.innerHTML = "";
    values.forEach(v => {
        const label = document.createElement("label");
        label.className = "pill";
        label.innerHTML = `<input type="checkbox" value="${v}" hidden> ${v}`;

        const checkbox = label.querySelector("input");

        label.addEventListener("click", () => {
            checkbox.checked = !checkbox.checked;
            label.classList.toggle("active", checkbox.checked);

            if (checkbox.checked) activeFilterValues[filterKey].add(v);
            else activeFilterValues[filterKey].delete(v);

            render();
        });

        container.appendChild(label);
    });
}

function filterPills(searchInputEl, pillsContainer) {
    const term = searchInputEl.value.toLowerCase();
    pillsContainer.querySelectorAll(".pill").forEach(pill => {
        pill.style.display = pill.textContent.toLowerCase().includes(term) ? "flex" : "none";
    });
}

/* ============ FILTERING ============ */
function getFilteredData() {
    const search = searchInput.value.toLowerCase();

    return data.filter(item => {
        const textMatch = !search || AppConfig.searchFields.some(f => {
            const v = getVal(item, f);
            return v && String(v).toLowerCase().includes(search);
        });

        const filterMatch = AppConfig.filters.every(fd => {
            const activeSet = activeFilterValues[fd.key];
            return !activeSet.size || activeSet.has(getVal(item, fd.key));
        });

        return textMatch && filterMatch;
    });
}

/* ============ RENDER ============ */
function render() {
    const filtered = getFilteredData();
    resultCount.innerText = `${filtered.length} results`;

    container.innerHTML = "";

    if (!filtered.length) {
        if (emptyState) emptyState.style.display = "block";
        return;
    }
    if (emptyState) emptyState.style.display = "none";

    filtered.forEach((item, index) => {
        container.appendChild(buildCard(item, index));
    });
}

function buildCard(item, index) {
    const id = getVal(item, AppConfig.idField);
    const cfg = AppConfig.card;

    const card = document.createElement("div");
    card.className = "card";
    if (selectedIds.has(id)) card.classList.add("selected");

    const rawTitle = getVal(item, cfg.avatarField) || "";
    const initials = rawTitle.split(" ").map(n => n[0]).join("");

    const rowsHtml = cfg.rows.map(row => {
        const val = getVal(item, row.field);
        if (!val) return "";

        if (row.type === "phone") {
            const digits = String(val).replace(/\D/g, "");
            const wa = row.whatsapp
                ? `<a href="https://wa.me/${digits}" target="_blank"><i class="fa-brands fa-whatsapp whatsapp"></i></a>`
                : "";
            return `<div class="meta"><i class="${row.icon}"></i><a href="tel:${val}">${val}</a>${wa}</div>`;
        }

        if (row.copy) {
            return `
                <div class="meta email-row">
                    <span><i class="${row.icon}"></i> ${val}</span>
                    <i class="fa-regular fa-copy copy-icon" data-copy="${val}"></i>
                </div>`;
        }

        return `<div class="meta"><i class="${row.icon}"></i> ${val}</div>`;
    }).join("");

    card.innerHTML = `
        <input type="checkbox" ${selectedIds.has(id) ? "checked" : ""}>
        <div class="avatar">${initials}</div>
        <div class="name">${getVal(item, cfg.titleField) || ""}</div>
        <div class="designation">${getVal(item, cfg.subtitleField) || ""}</div>
        ${rowsHtml}
    `;

    card.addEventListener("click", e => {
        if (e.target.closest(".copy-icon") || e.target.tagName === "A" || e.target.tagName === "INPUT") return;
        toggleSelection(id, index, e.shiftKey);
    });

    const copyIcon = card.querySelector(".copy-icon");
    if (copyIcon) {
        copyIcon.addEventListener("click", e => {
            e.stopPropagation();
            navigator.clipboard.writeText(copyIcon.dataset.copy);
            showCopied();
        });
    }

    return card;
}

/* ============ SELECTION ============ */
function toggleSelection(id, index, shiftKey) {
    const filtered = getFilteredData();

    if (shiftKey && lastClickedIndex !== null) {
        const start = Math.min(index, lastClickedIndex);
        const end = Math.max(index, lastClickedIndex);
        for (let i = start; i <= end; i++) {
            selectedIds.add(getVal(filtered[i], AppConfig.idField));
        }
    } else {
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
    }

    lastClickedIndex = index;
    render();
}

function showCopied() {
    copiedMsg.style.display = "block";
    setTimeout(() => copiedMsg.style.display = "none", 1500);
}

/* ============ ACTIONS ============ */
copyBtn.addEventListener("click", () => {
    if (!selectedIds.size) return;
    navigator.clipboard.writeText([...selectedIds].join(";"));
    showCopied();
});

clearBtn.addEventListener("click", () => {
    selectedIds.clear();
    render();
});

clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchBtn.classList.remove("show");
    searchInput.focus();
    render();
});

searchInput.addEventListener("input", () => {
    clearSearchBtn.classList.toggle("show", searchInput.value.length > 0);
    render();
});

/* ============ SIDEBAR (mobile) ============ */
function openSidebar() {
    appRoot.classList.add("sidebar-open");
    sidebarBackdrop.classList.add("show");
}
function closeSidebar() {
    appRoot.classList.remove("sidebar-open");
    sidebarBackdrop.classList.remove("show");
}
sidebarToggle?.addEventListener("click", () => {
    appRoot.classList.contains("sidebar-open") ? closeSidebar() : openSidebar();
});
sidebarBackdrop?.addEventListener("click", closeSidebar);

/* ============ KEYBOARD SHORTCUTS ============ */
document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        searchInput.value = "";
        clearSearchBtn.classList.remove("show");
        render();
        closeSidebar();
    } else if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        getFilteredData().forEach(d => selectedIds.add(getVal(d, AppConfig.idField)));
        render();
    }
});