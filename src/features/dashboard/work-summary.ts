import type {
  CustomerPortfolioItem,
  ProjectAnalysis,
  SummaryItem,
  WorkEntry,
  WorkFilterOptions,
  WorkFilters,
  WorkSummary,
} from "./types";

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

function percentage(hours: number, totalHours: number) {
  return totalHours > 0 ? (hours / totalHours) * 100 : 0;
}

export function buildCustomerPortfolio(entries: WorkEntry[]): CustomerPortfolioItem[] {
  const customerHours = new Map<string, number>();
  const projectHours = new Map<string, Map<string, number>>();
  let filteredTotalHours = 0;

  entries.forEach((entry) => {
    filteredTotalHours += entry.hours;
    customerHours.set(entry.customer, (customerHours.get(entry.customer) ?? 0) + entry.hours);
    const projects = projectHours.get(entry.customer) ?? new Map<string, number>();
    projects.set(entry.project, (projects.get(entry.project) ?? 0) + entry.hours);
    projectHours.set(entry.customer, projects);
  });

  return [...customerHours.entries()]
    .map(([customer, hours]) => {
      const projects = [...(projectHours.get(customer) ?? new Map()).entries()]
        .map(([label, projectTotal]) => ({
          label,
          hours: projectTotal,
          percentage: percentage(projectTotal, hours),
        }))
        .sort((first, second) => second.hours - first.hours || first.label.localeCompare(second.label));
      return {
        customer,
        hours,
        percentage: percentage(hours, filteredTotalHours),
        projectCount: projects.length,
        projects,
      };
    })
    .sort((first, second) => second.hours - first.hours || first.customer.localeCompare(second.customer));
}

export function buildProjectAnalyses(entries: WorkEntry[]): ProjectAnalysis[] {
  const projects = new Map<string, {
    customer: string;
    project: string;
    totalHours: number;
    roles: Map<string, number>;
    tasks: Map<string, number>;
  }>();

  entries.forEach((entry) => {
    const key = `${entry.customer}\u0000${entry.project}`;
    const analysis = projects.get(key) ?? {
      customer: entry.customer,
      project: entry.project,
      totalHours: 0,
      roles: new Map<string, number>(),
      tasks: new Map<string, number>(),
    };
    analysis.totalHours += entry.hours;
    analysis.roles.set(entry.role, (analysis.roles.get(entry.role) ?? 0) + entry.hours);
    analysis.tasks.set(entry.task, (analysis.tasks.get(entry.task) ?? 0) + entry.hours);
    projects.set(key, analysis);
  });

  const breakdown = (values: Map<string, number>, totalHours: number) =>
    [...values.entries()]
      .map(([label, hours]) => ({ label, hours, percentage: percentage(hours, totalHours) }))
      .sort((first, second) => second.hours - first.hours || first.label.localeCompare(second.label));

  return [...projects.entries()]
    .map(([key, analysis]) => ({
      key,
      customer: analysis.customer,
      project: analysis.project,
      totalHours: analysis.totalHours,
      roles: breakdown(analysis.roles, analysis.totalHours),
      tasks: breakdown(analysis.tasks, analysis.totalHours),
    }))
    .sort((first, second) =>
      second.totalHours - first.totalHours ||
      first.customer.localeCompare(second.customer) ||
      first.project.localeCompare(second.project),
    );
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
