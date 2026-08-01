const AppConfig = {
    dataUrl: "contacts.json",

    // Unique identifier field (dot notation supported)
    idField: "officer.email",

    // Fields searched by the global text search box
    searchFields: [
        "officer.name",
        "officer.email",
        "officer.mobile",
        "officeName",
        "officer.designation"
    ],

    // Sidebar filters: each becomes a pill-filter section
    filters: [
        {
            key: "zone",
            label: "Zone",
            searchPlaceholder: "Search zone...",
            sortOrder: null              // null = alphabetical
        },
        {
            key: "officer.designation",
            label: "Designation",
            searchPlaceholder: "Search designation...",
            sortOrder: [
                "Junior Engineer",
                "Assistant Engineer",
                "Assistant Executive Engineer",
                "Executive Engineer",
                "Superintending Engineer",
                "Chief Engineer"
            ]
        }
    ],

    // Card rendering: fully declarative, no hardcoded HTML
    card: {
        avatarField: "officer.name",     // used to build initials
        titleField: "officer.name",
        subtitleField: "officer.designation",
        rows: [
            { icon: "fa-solid fa-building", field: "officeName" },
            { icon: "fa-solid fa-envelope", field: "officer.email", copy: true },
            {
                icon: "fa-solid fa-phone",
                field: "officer.mobile",
                type: "phone",
                whatsapp: true
            }
        ]
    }
};