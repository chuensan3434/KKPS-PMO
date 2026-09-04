import type { SummaryItem, WorkEntry, WorkFilters, WorkSummary } from "./types";

export const emptyFilters: WorkFilters = {
  dateFrom: "",
  dateTo: "",
  role: "",
  sourceGroup: "",
  squad: "",
  person: "",
  project: "",
};

export function filterWorkEntries(entries: WorkEntry[], filters: WorkFilters) {
  return entries.filter(
    (entry) =>
      (!filters.dateFrom || entry.date >= filters.dateFrom) &&
      (!filters.dateTo || entry.date <= filters.dateTo) &&
      (!filters.role || entry.role === filters.role) &&
      (!filters.sourceGroup || entry.sourceGroup === filters.sourceGroup) &&
      (!filters.squad ||
        (filters.squad === "__NO_SQUAD__" ? entry.squad === null : entry.squad === filters.squad)) &&
      (!filters.person || entry.person === filters.person) &&
      (!filters.project || entry.project === filters.project),
  );
}

function groupHours(entries: WorkEntry[], getLabel: (entry: WorkEntry) => string): SummaryItem[] {
  const totals = new Map<string, number>();

  entries.forEach((entry) => {
    const label = getLabel(entry);
    totals.set(label, (totals.get(label) ?? 0) + entry.hours);
  });

  return [...totals.entries()]
    .map(([label, hours]) => ({ label, hours }))
    .sort((first, second) => second.hours - first.hours || first.label.localeCompare(second.label));
}

export function summarizeWork(entries: WorkEntry[]): WorkSummary {
  return {
    totalHours: entries.reduce((total, entry) => total + entry.hours, 0),
    byRole: groupHours(entries, (entry) => entry.role),
    bySourceGroup: groupHours(entries, (entry) => entry.sourceGroup),
    bySquad: groupHours(
      entries.filter((entry) => entry.squad !== null),
      (entry) => entry.squad ?? "",
    ),
    byPerson: groupHours(entries, (entry) => entry.person),
    byProject: groupHours(entries, (entry) => entry.project),
  };
}

export function uniqueOptions(entries: WorkEntry[], getValue: (entry: WorkEntry) => string) {
  return [...new Set(entries.map(getValue))].sort((first, second) => first.localeCompare(second));
}
