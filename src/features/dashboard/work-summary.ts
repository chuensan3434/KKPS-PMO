import type { SummaryItem, WorkEntry, WorkFilters, WorkSummary } from "./types";

export const emptyFilters: WorkFilters = {
  dateFrom: "",
  dateTo: "",
  role: "",
  person: "",
  project: "",
};

export function filterWorkEntries(entries: WorkEntry[], filters: WorkFilters) {
  return entries.filter(
    (entry) =>
      (!filters.dateFrom || entry.date >= filters.dateFrom) &&
      (!filters.dateTo || entry.date <= filters.dateTo) &&
      (!filters.role || entry.role === filters.role) &&
      (!filters.person || entry.personName === filters.person) &&
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
    byPerson: groupHours(entries, (entry) => entry.personName),
    byProject: groupHours(entries, (entry) => entry.project),
  };
}

export function uniqueOptions(entries: WorkEntry[], getValue: (entry: WorkEntry) => string) {
  return [...new Set(entries.map(getValue))].sort((first, second) => first.localeCompare(second));
}
