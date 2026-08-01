let data = [];
let selectedEmails = new Set();
let lastClickedIndex = null;

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
const clearSearchBtn =   document.getElementById("clearSearchBtn");
// NEW:
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const appRoot = document.querySelector(".app");
const emptyState = document.getElementById("emptyState");

/* DESIGNATION ORDER (Hierarchy) */
const designationOrder = [
    "Assistant Engineer",
    "Assistant Executive Engineer",
    "Executive Engineer",
    "Superintending Engineer",
    "Chief Engineer"
];

fetch("contacts.json")
    .then(res => res.json())
    .then(json => {
        data = json;
        initFilters();
        render();
    });

function createPills(container, values) {

    container.innerHTML = "";

    values.forEach(v => {
        const label = document.createElement("label");
        label.className = "pill";

        label.innerHTML = `
            <input type="checkbox" value="${v}" hidden>
            ${v}
        `;

        const checkbox = label.querySelector("input");

        label.addEventListener("click", () => {
            checkbox.checked = !checkbox.checked;
            label.classList.toggle("active", checkbox.checked);
            render();
        });

        container.appendChild(label);
    });
}

function initFilters() {
    const regions =
        [...new Set(data.map(d => d.zone))].sort();

    const designations =
    [...new Set(data.map(d => d.officer.designation))]
        .sort((a, b) => {

            const ai = designationOrder.indexOf(a);
            const bi = designationOrder.indexOf(b);

            /* known hierarchy first */
            if (ai !== -1 && bi !== -1)
                return ai - bi;

            /* known before unknown */
            if (ai !== -1) return -1;
            if (bi !== -1) return 1;

            /* fallback alphabetical */
            return a.localeCompare(b);
        });

    createPills(regionFilters, regions);
    createPills(designationFilters, designations);
}

function getActiveFilters(container) {
    return [...container.querySelectorAll("input")]
        .filter(i => i.checked)
        .map(i => i.value);
}

function getFilteredData(){

    const search = searchInput.value.toLowerCase();
    const activeRegions = getActiveFilters(regionFilters);
    const activeDesignations = getActiveFilters(designationFilters);

    return data.filter(d => {

        const textMatch =
            d.officer.name.toLowerCase().includes(search) ||
            d.officer.email.toLowerCase().includes(search) ||
            d.officer.mobile.includes(search) ||
            d.officeName.toLowerCase().includes(search) ||
            d.officer.designation.toLowerCase().includes(search);

        const regionMatch =
            !activeRegions.length || activeRegions.includes(d.zone);

        const designationMatch =
            !activeDesignations.length ||
            activeDesignations.includes(d.officer.designation);

        return textMatch && regionMatch && designationMatch;
    });
}

function render() {
    const search = searchInput.value.toLowerCase();
    const activeRegions = getActiveFilters(regionFilters);
    const activeDesignations = getActiveFilters(designationFilters);

/*    const filtered = data.filter(d => {
        const textMatch =
            d.officer.name.toLowerCase().includes(search) ||
            d.officer.email.toLowerCase().includes(search) ||
            d.officer.mobile.includes(search) ||
            d.officeName.toLowerCase().includes(search) ||
            d.officer.designation.toLowerCase().includes(search);

        const regionMatch =
            !activeRegions.length || activeRegions.includes(d.zone);

        const designationMatch =
            !activeDesignations.length ||
            activeDesignations.includes(d.officer.designation);

        return textMatch && regionMatch && designationMatch;
    });*/
	
	const filtered = getFilteredData();

    resultCount.innerText = `${filtered.length} results`;
        // Empty state handling
    if (!filtered.length) {
        container.innerHTML = "";
        if (emptyState) emptyState.style.display = "block";
        return;
    } else if (emptyState) {
        emptyState.style.display = "none";
    }
    container.innerHTML = "";

    filtered.forEach((o, index) => {
        const card = document.createElement("div");
        card.className = "card";
        if (selectedEmails.has(o.officer.email))
            card.classList.add("selected");

        const initials = o.officer.name.split(" ")
            .map(n => n[0]).join("");

        card.innerHTML = `
            <input type="checkbox"
                ${selectedEmails.has(o.officer.email) ? "checked" : ""}>
            <div class="avatar">${initials}</div>
            <div class="name">${o.officer.name}</div>
            <div class="designation">${o.officer.designation}</div>

            <div class="meta">
                <i class="fa-solid fa-building"></i>
                ${o.officeName}
            </div>

            <div class="meta email-row">
                <span>
                    <i class="fa-solid fa-envelope"></i>
                    ${o.officer.email}
                </span>
                <i class="fa-regular fa-copy copy-icon"></i>
            </div>

            <div class="meta">
                <i class="fa-solid fa-phone"></i>
                <a href="tel:${o.officer.mobile}">${o.officer.mobile}</a>
                <a href="https://wa.me/${o.officer.mobile.replace(/\D/g,'')}" target="_blank">
                    <i class="fa-brands fa-whatsapp whatsapp"></i>
                </a>
            </div>
        `;

        card.addEventListener("click", e => {

			if (e.target.closest(".copy-icon") ||
				e.target.tagName === "A" ||
				e.target.tagName === "INPUT")
				return;

			toggleSelection(
				o.officer.email,
				index,
				e.shiftKey
			);
		});

        card.querySelector(".copy-icon")
            .addEventListener("click", e => {
                e.stopPropagation();
                navigator.clipboard.writeText(o.officer.email);
                showCopied();
            });

        container.appendChild(card);
    });
}

function toggleSelection(email, index, shiftKey) {

    const filtered = getFilteredData();

    /* SHIFT RANGE SELECT */
    if (shiftKey && lastClickedIndex !== null) {

        const start = Math.min(index, lastClickedIndex);
        const end   = Math.max(index, lastClickedIndex);

        for (let i = start; i <= end; i++) {
            selectedEmails.add(filtered[i].officer.email);
        }

    } else {

        if (selectedEmails.has(email))
            selectedEmails.delete(email);
        else
            selectedEmails.add(email);
    }

    lastClickedIndex = index;

    render();
}

function showCopied() {
    copiedMsg.style.display = "block";
    setTimeout(() => copiedMsg.style.display = "none", 1500);
}

function filterPills(searchInput, container) {

    const term = searchInput.value.toLowerCase();

    container.querySelectorAll(".pill").forEach(pill => {
        const text = pill.textContent.toLowerCase();

        pill.style.display =
            text.includes(term) ? "flex" : "none";
    });
}

copyBtn.addEventListener("click", () => {
    if (!selectedEmails.size) return;
    navigator.clipboard.writeText(
        [...selectedEmails].join(";")
    );
    showCopied();
});

clearBtn.addEventListener("click", () => {
    selectedEmails.clear();
    render();
});

regionSearch.addEventListener("input", () =>
    filterPills(regionSearch, regionFilters)
);

designationSearch.addEventListener("input", () =>
    filterPills(designationSearch, designationFilters)
);

clearSearchBtn.addEventListener("click", () => {

    searchInput.value = "";
    clearSearchBtn.classList.remove("show");

    searchInput.focus();
    render();
});

searchInput.addEventListener("input", () => {

    clearSearchBtn.classList.toggle(
        "show",
        searchInput.value.length > 0
    );

    render();
});
regionFilters.addEventListener("change", render);
designationFilters.addEventListener("change", render);

document.addEventListener("keydown", e => {
	
	if(e.key === "Escape"){
        searchInput.value="";
        clearSearchBtn.classList.remove("show");
        render();
        closeSidebar();  // NEW: close sidebar if open
    }
	
    else if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        getFilteredData().forEach(d =>
			selectedEmails.add(d.officer.email));
        render();
    }
});

function openSidebar() {
    if (!appRoot) return;
    appRoot.classList.add("sidebar-open");
    if (sidebarBackdrop) sidebarBackdrop.classList.add("show");
}

function closeSidebar() {
    if (!appRoot) return;
    appRoot.classList.remove("sidebar-open");
    if (sidebarBackdrop) sidebarBackdrop.classList.remove("show");
}

if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
        if (appRoot.classList.contains("sidebar-open")) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });
}

if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", () => {
        closeSidebar();
    });
}