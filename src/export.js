(function (root) {
  "use strict";

  function filterBookings(rows, filters) {
    const months = new Set(filters.months || []);
    return rows.filter(row =>
      (filters.allMonths || months.has(row.date.slice(0, 7))) &&
      (!filters.clinician || String(row.clinician ?? "").trim() === filters.clinician) &&
      (!filters.serviceType || String(row.serviceType ?? "").trim() === filters.serviceType)
    ).slice().sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }

  function summarize(rows) {
    const groups = new Map();
    for (const row of rows) {
      const month = row.date.slice(0, 7);
      const clinician = String(row.clinician ?? "").trim();
      const service = String(row.serviceType ?? "").trim();
      const key = JSON.stringify([month, clinician, service]);
      if (!groups.has(key)) groups.set(key, { month, clinician, service, appointments: 0, ids: new Set() });
      const group = groups.get(key);
      group.appointments++;
      group.ids.add(row.id);
    }
    return Array.from(groups.values()).sort((a, b) =>
      a.month.localeCompare(b.month) || a.clinician.localeCompare(b.clinician, "el") || a.service.localeCompare(b.service, "el")
    ).map(g => [g.month, g.clinician, g.service, g.appointments, g.ids.size]);
  }

  function buildWorkbook(XLSX, rows) {
    const text = value => String(value ?? "");
    const details = [["Ημερομηνία", "Μήνας", "Ώρα", "Ωφελούμενος", "Email", "Τηλέφωνο", "Υπηρεσία", "Αίθουσα", "Κλινικός εκπαιδευτής", "Σημειώσεις", "ID περιστατικού / σειράς", "Εβδομαδιαίο", "Με αλλαγή"]];
    rows.forEach(r => details.push([
      r.date, r.date.slice(0, 7), r.time, text(r.beneficiaryName), text(r.beneficiaryEmail),
      text(r.beneficiaryPhone), text(r.serviceType), text(r.room), text(r.clinician),
      text(r.notes), text(r.id), r.isRecurring ? "Ναι" : "Όχι", r.isOverride ? "Ναι" : "Όχι"
    ]));
    const summary = [["Μήνας", "Κλινικός εκπαιδευτής", "Υπηρεσία", "Ραντεβού", "Περιστατικά / σειρές"], ...summarize(rows)];
    summary.push(["ΣΥΝΟΛΟ", "", "", rows.length, new Set(rows.map(r => r.id)).size]);
    summary.push(["Κάθε ID μετρά ως ένα περιστατικό/σειρά. Τα μηνιαία πλήθη μπορεί να περιλαμβάνουν το ίδιο ID σε διαφορετικούς μήνες."]);
    const wb = XLSX.utils.book_new();
    const detailSheet = XLSX.utils.aoa_to_sheet(details);
    detailSheet["!cols"] = [14, 10, 9, 30, 32, 20, 24, 18, 30, 50, 38, 16, 16].map(wch => ({ wch }));
    detailSheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: details.length - 1, c: 12 } }) };
    const summarySheet = XLSX.utils.aoa_to_sheet(summary);
    summarySheet["!cols"] = [16, 32, 26, 14, 26].map(wch => ({ wch }));
    summarySheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: summary.length - 3, c: 4 } }) };
    XLSX.utils.book_append_sheet(wb, detailSheet, "Ραντεβού");
    XLSX.utils.book_append_sheet(wb, summarySheet, "Ανά μήνα");
    return wb;
  }

  const api = { filterBookings, summarize, buildWorkbook };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BookingExport = api;
})(typeof window !== "undefined" ? window : globalThis);
