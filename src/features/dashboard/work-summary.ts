import type { SummaryItem, WorkEntry, WorkFilterOptions, WorkFilters, WorkSummary } from "./types";

export const NO_SQUAD_VALUE = "__NO_SQUAD__";

const optionFilterKeys = ["customer", "project", "task", "sourceGroup", "squad", "role", "person"] as const;
type OptionFilterKey = (typeof optionFilterKeys)[number];

export const emptyFilters: WorkFilters = {
  dateFrom: "",
  dateTo: "",
  customer: "",
  project: "",
  task: "",
  sourceGroup: "",
  squad: "",
  role: "",
  person: "",
};

function matchesFilter(entry: WorkEntry, key: keyof WorkFilters, value: string) {
  if (!value) return true;

  switch (key) {
    case "dateFrom": return entry.date >= value;
    case "dateTo": return entry.date <= value;
    case "squad": return value === NO_SQUAD_VALUE ? entry.squad === null : entry.squad === value;
    default: return entry[key] === value;
  }
}

export function filterWorkEntries(
  entries: WorkEntry[],
  filters: WorkFilters,
  ignoredKeys: ReadonlySet<keyof WorkFilters> = new Set(),
) {
  return entries.filter(
    (entry) => Object.entries(filters).every(([key, value]) =>
      ignoredKeys.has(key as keyof WorkFilters) || matchesFilter(entry, key as keyof WorkFilters, value),
    ),
  );
}

function uniqueOptions(entries: WorkEntry[], getValue: (entry: WorkEntry) => string) {
  return [...new Set(entries.map(getValue))].sort((first, second) => first.localeCompare(second));
}

function optionsFor(entries: WorkEntry[], filters: WorkFilters, key: OptionFilterKey) {
  const applicableEntries = filterWorkEntries(entries, filters, new Set([key]));
  if (key === "squad") {
    const squads = uniqueOptions(
      applicableEntries.filter((entry) => entry.squad !== null),
      (entry) => entry.squad ?? "",
    );
    return applicableEntries.some((entry) => entry.squad === null) ? [...squads, NO_SQUAD_VALUE] : squads;
  }
  return uniqueOptions(applicableEntries, (entry) => entry[key]);
}

export function getContextualFilterOptions(entries: WorkEntry[], filters: WorkFilters): WorkFilterOptions {
  return Object.fromEntries(optionFilterKeys.map((key) => [key, optionsFor(entries, filters, key)])) as WorkFilterOptions;
}

export function getContextualDateRange(entries: WorkEntry[], filters: WorkFilters) {
  const applicableEntries = filterWorkEntries(entries, filters, new Set(["dateFrom", "dateTo"]));
  let min = "";
  let max = "";

  applicableEntries.forEach(({ date }) => {
    if (!min || date < min) min = date;
    if (!max || date > max) max = date;
  });
  return { min, max };
}

export function reconcileWorkFilters(
  entries: WorkEntry[],
  filters: WorkFilters,
  preferredKey?: keyof WorkFilters,
) {
  let next = { ...filters };
  const keys = preferredKey && optionFilterKeys.includes(preferredKey as OptionFilterKey)
    ? [...optionFilterKeys.filter((key) => key !== preferredKey), preferredKey as OptionFilterKey]
    : [...optionFilterKeys];

  for (let pass = 0; pass <= optionFilterKeys.length; pass += 1) {
    let changed = false;
    for (const key of keys) {
      if (next[key] && !optionsFor(entries, next, key).includes(next[key])) {
        next = { ...next, [key]: "" };
        changed = true;
      }
    }

    const dateRange = getContextualDateRange(entries, next);
    if (next.dateFrom && (!dateRange.min || next.dateFrom < dateRange.min || next.dateFrom > dateRange.max)) {
      next = { ...next, dateFrom: "" };
      changed = true;
    }
    if (next.dateTo && (!dateRange.min || next.dateTo < dateRange.min || next.dateTo > dateRange.max)) {
      next = { ...next, dateTo: "" };
      changed = true;
    }
    if (next.dateFrom && next.dateTo && next.dateFrom > next.dateTo) {
      next = preferredKey === "dateTo" ? { ...next, dateFrom: "" } : { ...next, dateTo: "" };
      changed = true;
    }
    if (!changed) break;
  }

  return next;
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
    byCustomer: groupHours(entries, (entry) => entry.customer),
    byProject: groupHours(entries, (entry) => entry.project),
    byTask: groupHours(entries, (entry) => entry.task),
    byRole: groupHours(entries, (entry) => entry.role),
    bySourceGroup: groupHours(entries, (entry) => entry.sourceGroup),
    bySquad: groupHours(
      entries.filter((entry) => entry.squad !== null),
      (entry) => entry.squad ?? "",
    ),
    byPerson: groupHours(entries, (entry) => entry.person),
  };
}
