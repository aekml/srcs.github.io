const AppConfig = {
  dataUrl: "contacts.json",
  idField: "officer.pin",
  searchFields: ["officer.pin", "officer.name", "officer.email", "officer.mobile", "officeName", "officer.designation"],
  filters: [
    { key: "zone", label: "Zone", searchPlaceholder: "Search zone...", sortOrder: null },
    { key: "officer.designation", label: "Designation", searchPlaceholder: "Search designation...", sortOrder: ["Junior Engineer", "Assistant Engineer", "Assistant Executive Engineer", "Executive Engineer", "Superintending Engineer", "Chief Engineer"] }
  ],
  card: {
    avatarField: "officer.name", titleField: "officer.name", subtitleField: "officer.designation",
    rows: [
      { icon: "fa-solid fa-building", field: "officeName" },
      { icon: "fa-solid fa-id-badge", field: "officer.pin" },
      { icon: "fa-solid fa-envelope", field: "officer.email", copy: true },
      { icon: "fa-solid fa-phone", field: "officer.mobile", type: "phone", whatsapp: true }
    ]
  },
  history: {
    enabled: true, dataUrl: "service-history.json", detailTitle: "Service History", noRecordsText: "No service history available.", presentLabel: "Present",
    fields: { itemId:"itemId", start:"startDate", end:"endDate", title:"title", location:"location", group:"group", reference:"orderReference", description:"description" }
  }
};
