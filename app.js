/* ==========================================================================
   BESCOM CONTACT DIRECTORY — GENERIC CONFIG-DRIVEN APP
   Requires config.js to load before app.js.
   ========================================================================== */

let data = [];
let filteredData = [];
let selectedIds = new Set();
let lastClickedIndex = null;

const activeFilterValues = {};
const filterViews = {};

const container = document.getElementById("cardContainer");
const searchInput = document.getElementById("searchInput");
const resultCount = document.getElementById("resultCount");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const copiedMsg = document.getElementById("copiedMsg");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const appRoot = document.querySelector(".app");
const sidebar = document.querySelector(".sidebar");
const emptyState = document.getElementById("emptyState");
const filtersRoot = document.getElementById("filtersRoot");

/* --------------------------------------------------------------------------
   Safe value resolution
   -------------------------------------------------------------------------- */

function getVal(obj, path) {
    if (!obj || typeof path !== "string" || !path.trim()) return undefined;
    return path.split(".").reduce((value, key) => value?.[key], obj);
}

function isPresent(value) {
    return value !== undefined && value !== null && String(value).trim() !== "";
}

function resolveDefinitionValue(item, definition) {
    if (!definition) return undefined;

    if (typeof definition.value === "function") {
        return definition.value(item);
    }

    if (Array.isArray(definition.fields)) {
        const joined = definition.fields
            .map(path => getVal(item, path))
            .filter(isPresent)
            .join(definition.separator || " ");
        if (joined) return joined;
        return definition.fallbackField
            ? getVal(item, definition.fallbackField)
            : undefined;
    }

    const primary = getVal(item, definition.field || definition.key);
    if (isPresent(primary)) return primary;

    return definition.fallbackField
        ? getVal(item, definition.fallbackField)
        : primary;
}

function getFilterValue(item, filterDef) {
    return resolveDefinitionValue(item, filterDef);
}

function getRecordId(item, index = 0) {
    return getVal(item, AppConfig.idField)
        || item?.officer?.pinNumber
        || item?.officer?.email
        || item?.id
        || `row-${index}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

/* --------------------------------------------------------------------------
   Initial load
   -------------------------------------------------------------------------- */

if (!window.AppConfig && typeof AppConfig === "undefined") {
    throw new Error("AppConfig is unavailable. Load config.js before app.js.");
}

fetch(AppConfig.dataUrl)
    .then(response => {
        if (!response.ok) throw new Error(`Unable to load ${AppConfig.dataUrl}: HTTP ${response.status}`);
        return response.json();
    })
    .then(json => {
        data = Array.isArray(json) ? json : [];
        buildFilterSections();
        render();
    })
    .catch(error => {
        console.error(error);
        if (resultCount) resultCount.textContent = "Unable to load contacts";
        if (emptyState) {
            emptyState.style.display = "block";
            const message = emptyState.querySelector("p");
            if (message) message.textContent = "The contact data could not be loaded.";
        }
    });

/* --------------------------------------------------------------------------
   Dynamic filters — dropdown multi-select
   -------------------------------------------------------------------------- */

function buildFilterSections() {
    if (!filtersRoot) return;
    filtersRoot.innerHTML = "";

    AppConfig.filters.forEach(filterDef => {
        activeFilterValues[filterDef.key] = new Set();

        const section = document.createElement("div");
        section.className = "filter-section";
        section.dataset.filterKey = filterDef.key;

        const heading = document.createElement("h4");
        heading.textContent = filterDef.label;
        section.appendChild(heading);

        // Dropdown wrapper
        const dropdown = document.createElement("div");
        dropdown.className = "dd-wrapper";
        dropdown.dataset.filterKey = filterDef.key;

        // Trigger button
        const trigger = document.createElement("button");
        trigger.className = "dd-trigger";
        trigger.type = "button";
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");
        trigger.innerHTML = `<span class="dd-label">All</span><i class="fa-solid fa-chevron-down dd-arrow"></i>`;
        dropdown.appendChild(trigger);

        // Panel
        const panel = document.createElement("div");
        panel.className = "dd-panel";
        panel.setAttribute("role", "listbox");
        panel.setAttribute("aria-multiselectable", "true");

        // Search inside panel
        if (filterDef.search !== false) {
            const searchBox = document.createElement("input");
            searchBox.className = "dd-search";
            searchBox.placeholder = filterDef.searchPlaceholder || `Search ${filterDef.label.toLowerCase()}...`;
            searchBox.setAttribute("aria-label", searchBox.placeholder);
            panel.appendChild(searchBox);

            searchBox.addEventListener("input", () => {
                filterViews[filterDef.key].searchTerm = searchBox.value.trim().toLowerCase();
                updateOptionVisibility(filterDef.key);
            });
        }

        const optionsList = document.createElement("div");
        optionsList.className = "dd-options";
        panel.appendChild(optionsList);
        dropdown.appendChild(panel);
        section.appendChild(dropdown);
        filtersRoot.appendChild(section);

        filterViews[filterDef.key] = {
            definition: filterDef,
            section,
            trigger,
            panel,
            optionsList,
            searchTerm: ""
        };

        // Toggle open/close
        trigger.addEventListener("click", e => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains("open");
            closeAllDropdowns();
            if (!isOpen) {
                dropdown.classList.add("open");
                trigger.setAttribute("aria-expanded", "true");
                panel.querySelector(".dd-search")?.focus();
            }
        });

        // Stop ALL clicks inside panel from bubbling to document closer
        panel.addEventListener("click", e => e.stopPropagation());

        buildOptions(filterDef.key);
    });

    // Close dropdowns when clicking outside
    document.addEventListener("click", () => closeAllDropdowns());
    applyCascades();
}

function rebuildAllOptions(changedFilterKey) {
    // Rebuild option lists for every filter except the one just changed,
    // so they reflect only values available in the now-filtered dataset.
    AppConfig.filters.forEach(filterDef => {
        if (filterDef.key === changedFilterKey) return;
        const view = filterViews[filterDef.key];
        if (!view) return;
        const activeSet = activeFilterValues[filterDef.key];
        const newValues = getSortedFilterValues(filterDef);
        view.optionsList.innerHTML = "";
        newValues.forEach(value => {
            const option = document.createElement("label");
            option.className = "dd-option";
            if (activeSet.has(value)) option.classList.add("selected");
            option.dataset.value = String(value);
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = String(value);
            checkbox.checked = activeSet.has(value);
            const span = document.createElement("span");
            span.textContent = String(value);
            option.appendChild(checkbox);
            option.appendChild(span);
            checkbox.addEventListener("change", () => {
                option.classList.toggle("selected", checkbox.checked);
                if (checkbox.checked) activeSet.add(value);
                else activeSet.delete(value);
                updateTriggerLabel(filterDef.key);
                applyCascades(filterDef.key);
                rebuildAllOptions(filterDef.key);
                lastClickedIndex = null;
                render();
            });
            view.optionsList.appendChild(option);
        });
        updateOptionVisibility(filterDef.key);
    });
}

function closeAllDropdowns() {
    document.querySelectorAll(".dd-wrapper.open").forEach(dd => {
        dd.classList.remove("open");
        dd.querySelector(".dd-trigger")?.setAttribute("aria-expanded", "false");
    });
}

function buildOptions(filterKey) {
    const view = filterViews[filterKey];
    if (!view) return;

    const filterDef = view.definition;
    const values = getSortedFilterValues(filterDef);
    view.optionsList.innerHTML = "";

    values.forEach(value => {
        const option = document.createElement("label");
        option.className = "dd-option";
        option.dataset.value = String(value);

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = String(value);

        const span = document.createElement("span");
        span.textContent = String(value);

        option.appendChild(checkbox);
        option.appendChild(span);

        checkbox.addEventListener("change", () => {
            option.classList.toggle("selected", checkbox.checked);
            const activeSet = activeFilterValues[filterKey];
            if (checkbox.checked) activeSet.add(value);
            else activeSet.delete(value);
            updateTriggerLabel(filterKey);
            applyCascades(filterKey);
            rebuildAllOptions(filterKey);
            lastClickedIndex = null;
            render();
        });

        view.optionsList.appendChild(option);
    });
}

function updateTriggerLabel(filterKey) {
    const view = filterViews[filterKey];
    if (!view) return;

    const activeSet = activeFilterValues[filterKey];
    const label = view.trigger.querySelector(".dd-label");

    if (!activeSet.size) {
        label.textContent = "All";
        view.trigger.classList.remove("has-selection");
    } else if (activeSet.size === 1) {
        label.textContent = [...activeSet][0];
        view.trigger.classList.add("has-selection");
    } else {
        label.textContent = `${activeSet.size} selected`;
        view.trigger.classList.add("has-selection");
    }
}

function getSortedFilterValues(filterDef) {
    // Filter data by every OTHER active filter so options only show
    // values available given current selections (cross-filter cascade).
    const sourceData = data.filter(item =>
        AppConfig.filters.every(otherDef => {
            if (otherDef.key === filterDef.key) return true; // skip self
            const activeSet = activeFilterValues[otherDef.key];
            return !activeSet?.size || activeSet.has(getFilterValue(item, otherDef));
        })
    );

    const values = [...new Set(
        sourceData.map(item => getFilterValue(item, filterDef)).filter(isPresent)
    )];

    return values.sort((a, b) => {
        if (Array.isArray(filterDef.sortOrder)) {
            const ai = filterDef.sortOrder.indexOf(a);
            const bi = filterDef.sortOrder.indexOf(b);
            if (ai !== -1 && bi !== -1) return ai - bi;
            if (ai !== -1) return -1;
            if (bi !== -1) return 1;
        }
        return String(a).localeCompare(String(b));
    });
}

function getParentMap(filterDef) {
    if (typeof filterDef.getParent === "function") return null;
    if (typeof filterDef.parentMap === "object") return filterDef.parentMap;
    if (typeof filterDef.parentMap === "string") return AppConfig[filterDef.parentMap] || {};
    return {};
}

function getParentValue(filterDef, childValue) {
    if (typeof filterDef.getParent === "function") return filterDef.getParent(childValue);
    return getParentMap(filterDef)[childValue];
}

function applyCascades(changedFilterKey = null) {
    AppConfig.filters.forEach(filterDef => {
        if (!filterDef.cascadeFrom) return;

        const parentSet = activeFilterValues[filterDef.cascadeFrom] || new Set();
        const childSet = activeFilterValues[filterDef.key] || new Set();
        const view = filterViews[filterDef.key];
        if (!view) return;

        view.optionsList.querySelectorAll(".dd-option").forEach(option => {
            const childValue = option.dataset.value;
            const parentValue = getParentValue(filterDef, childValue);
            const relevant = parentSet.size === 0 || parentSet.has(parentValue);

            option.dataset.cascadeVisible = relevant ? "true" : "false";

            if (!relevant && childSet.has(childValue)) {
                childSet.delete(childValue);
                const checkbox = option.querySelector("input");
                if (checkbox) checkbox.checked = false;
                option.classList.remove("selected");
            }
        });

        updateOptionVisibility(filterDef.key);
        updateTriggerLabel(filterDef.key);
    });

    if (changedFilterKey) updateOptionVisibility(changedFilterKey);
}

function updateOptionVisibility(filterKey) {
    const view = filterViews[filterKey];
    if (!view) return;

    const term = view.searchTerm || "";
    view.optionsList.querySelectorAll(".dd-option").forEach(option => {
        const matchesSearch = !term || option.textContent.toLowerCase().includes(term);
        const matchesCascade = option.dataset.cascadeVisible !== "false";
        option.style.display = matchesSearch && matchesCascade ? "flex" : "none";
    });
}

/* --------------------------------------------------------------------------
   Filtering and rendering
   -------------------------------------------------------------------------- */

function getFilteredData() {
    const search = searchInput?.value.trim().toLowerCase() || "";

    return data.filter(item => {
        const textMatch = !search || AppConfig.searchFields.some(path => {
            const value = getVal(item, path);
            return isPresent(value) && String(value).toLowerCase().includes(search);
        });

        if (!textMatch) return false;

        return AppConfig.filters.every(filterDef => {
            const activeSet = activeFilterValues[filterDef.key];
            return !activeSet?.size || activeSet.has(getFilterValue(item, filterDef));
        });
    });
}

function render() {
    filteredData = getFilteredData();

    if (resultCount) resultCount.textContent = `${filteredData.length} results`;
    if (!container) return;

    container.innerHTML = "";

    if (!filteredData.length) {
        if (emptyState) emptyState.style.display = "block";
        return;
    }

    if (emptyState) emptyState.style.display = "none";

    const fragment = document.createDocumentFragment();
    filteredData.forEach((item, index) => fragment.appendChild(buildCard(item, index)));
    container.appendChild(fragment);
}

function buildCard(item, index) {
    const id = getRecordId(item, index);
    const cfg = AppConfig.card;
    const status = getVal(item, cfg.statusField);
    const isVacant = status === "Vacant";

    const card = document.createElement("div");
    card.className = `card${selectedIds.has(id) ? " selected" : ""}${isVacant ? " vacant" : ""}`;
    card.dataset.id = String(id);
    card.dataset.index = String(index);

    const rawTitle = getVal(item, cfg.avatarField) || "";
    const initials = isVacant
        ? "—"
        : String(rawTitle).split(/\s+/).filter(Boolean).map(part => part[0]).join("").slice(0, 3);

    const title = getVal(item, cfg.titleField) || (isVacant ? "Vacant" : "Unknown");
    const subtitle = getVal(item, cfg.subtitleField) || "";
    const badge = cfg.badgeField ? getVal(item, cfg.badgeField) : null;

    const rowsHtml = (cfg.rows || []).map(row => buildCardRow(item, row)).join("");

    card.innerHTML = `
        <input class="card-select" type="checkbox" ${selectedIds.has(id) ? "checked" : ""} aria-label="Select ${escapeAttribute(title)}">
        <div class="avatar">${escapeHtml(initials)}</div>
        <div class="name">
            ${escapeHtml(title)}
            ${isVacant ? '<span class="vacant-badge">VACANT</span>' : ""}
            ${isPresent(badge) ? `<span class="rank-badge">${escapeHtml(badge)}</span>` : ""}
        </div>
        <div class="designation">${escapeHtml(subtitle)}</div>
        ${rowsHtml}
    `;

    return card;
}

function buildCardRow(item, row) {
    const value = resolveDefinitionValue(item, row);
    if (!isPresent(value)) return "";

    const safeValue = escapeHtml(value);
    const safeAttributeValue = escapeAttribute(value);
    const icon = escapeAttribute(row.icon || "");

    if (row.type === "email") {
        return `
            <div class="meta email-row">
                <span><i class="${icon}"></i> <a href="mailto:${safeAttributeValue}">${safeValue}</a></span>
                ${row.copy ? `<i class="fa-regular fa-copy copy-icon" data-copy="${safeAttributeValue}" role="button" aria-label="Copy email"></i>` : ""}
            </div>`;
    }

    if (row.type === "phone") {
        const digits = String(value).replace(/\D/g, "");
        const whatsappDigits = digits.length === 10 ? `91${digits}` : digits;
        return `
            <div class="meta phone-row">
                <span><i class="${icon}"></i> <a href="tel:${escapeAttribute(digits)}">${safeValue}</a></span>
                ${row.copy ? `<i class="fa-regular fa-copy copy-icon" data-copy="${safeAttributeValue}" role="button" aria-label="Copy phone"></i>` : ""}
                ${row.whatsapp ? `<a href="https://wa.me/${escapeAttribute(whatsappDigits)}" target="_blank" rel="noopener noreferrer" aria-label="Open WhatsApp"><i class="fa-brands fa-whatsapp whatsapp"></i></a>` : ""}
            </div>`;
    }

    if (row.type === "date") {
        const date = new Date(value);
        if (isNaN(date)) return `<div class="meta"><i class="${icon}"></i> ${safeValue}</div>`;
        const formatted = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        const diffDays = Math.floor((new Date() - date) / 86400000);
        const years = Math.floor(diffDays / 365);
        const months = Math.floor((diffDays % 365) / 30);
        let duration = years > 0 ? `${years} yr ` : "";
        duration += months > 0 ? `${months} mo` : "";
        if (!duration) duration = `${diffDays} days`;
        return `<div class="meta"><i class="${icon}"></i> Assumed charge: ${formatted} &nbsp;•&nbsp; ${duration.trim()}</div>`;
    }

    return `<div class="meta"><i class="${icon}"></i> ${safeValue}</div>`;
}

/* --------------------------------------------------------------------------
   Selection and card actions
   -------------------------------------------------------------------------- */

function toggleSelection(id, index, shiftKey = false) {
    if (!isPresent(id)) return;

    if (shiftKey && lastClickedIndex !== null) {
        const start = Math.min(index, lastClickedIndex);
        const end = Math.max(index, lastClickedIndex);
        for (let i = start; i <= end; i += 1) {
            selectedIds.add(getRecordId(filteredData[i], i));
        }
    } else {
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        lastClickedIndex = index;
    }

    render();
}

container?.addEventListener("click", event => {
    const copyTarget = event.target.closest("[data-copy]");
    if (copyTarget) {
        event.stopPropagation();
        navigator.clipboard.writeText(copyTarget.dataset.copy || "").then(showCopied);
        return;
    }

    if (event.target.closest("a")) return;

    const card = event.target.closest(".card");
    if (!card) return;

    event.preventDefault();
    toggleSelection(card.dataset.id, Number(card.dataset.index), event.shiftKey);
});

function showCopied() {
    if (!copiedMsg) return;
    copiedMsg.style.display = "block";
    window.setTimeout(() => { copiedMsg.style.display = "none"; }, 1200);
}

copyBtn?.addEventListener("click", () => {
    const selectedEmails = data
        .filter((item, index) => selectedIds.has(getRecordId(item, index)))
        .map(item => item.officer?.email)
        .filter(isPresent);

    if (!selectedEmails.length) return;
    navigator.clipboard.writeText(selectedEmails.join("; ")).then(showCopied);
});

clearBtn?.addEventListener("click", () => {
    selectedIds.clear();
    lastClickedIndex = null;
    render();
});

/* --------------------------------------------------------------------------
   Search
   -------------------------------------------------------------------------- */

searchInput?.addEventListener("input", () => {
    clearSearchBtn?.classList.toggle("show", searchInput.value.length > 0);
    lastClickedIndex = null;
    render();
});

clearSearchBtn?.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchBtn.classList.remove("show");
    searchInput.focus();
    render();
});

/* --------------------------------------------------------------------------
   CSV export
   -------------------------------------------------------------------------- */

exportCsvBtn?.addEventListener("click", () => {
    if (!filteredData.length || !AppConfig.csvExport?.columns?.length) return;

    const headers = AppConfig.csvExport.columns.map(column => csvEscape(column.header));
    const rows = filteredData.map(item => AppConfig.csvExport.columns.map(column => {
        return csvEscape(resolveDefinitionValue(item, column));
    }));

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `${AppConfig.csvExport.filenamePrefix || "contacts"}_${date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
});

function csvEscape(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

/* --------------------------------------------------------------------------
   Mobile sidebar
   -------------------------------------------------------------------------- */

function openSidebar() {
    appRoot?.classList.add("sidebar-open");
    sidebar?.classList.add("open");
    sidebarBackdrop?.classList.add("show");
    document.body.classList.add("sidebar-open");
    sidebarToggle?.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
    appRoot?.classList.remove("sidebar-open");
    sidebar?.classList.remove("open");
    sidebarBackdrop?.classList.remove("show");
    document.body.classList.remove("sidebar-open");
    sidebarToggle?.setAttribute("aria-expanded", "false");
}

sidebarToggle?.addEventListener("click", () => {
    appRoot?.classList.contains("sidebar-open") ? closeSidebar() : openSidebar();
});

sidebarBackdrop?.addEventListener("click", closeSidebar);

window.addEventListener("resize", () => {
    if (window.innerWidth > 768) closeSidebar();
});

/* --------------------------------------------------------------------------
   Keyboard shortcuts
   -------------------------------------------------------------------------- */

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        if (document.querySelectorAll(".dd-wrapper.open").length) {
            closeAllDropdowns();
            return;
        }

        if (appRoot?.classList.contains("sidebar-open") || sidebar?.classList.contains("open")) {
            closeSidebar();
            return;
        }

        if (searchInput) searchInput.value = "";
        clearSearchBtn?.classList.remove("show");
        render();
        return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
        event.preventDefault();
        filteredData.forEach((item, index) => selectedIds.add(getRecordId(item, index)));
        render();
    }
});