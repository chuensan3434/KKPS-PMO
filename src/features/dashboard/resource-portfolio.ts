import type {
  ResourcePortfolio,
  ResourcePortfolioArea,
  ServiceArea,
  WorkEntry,
  WorkType,
} from "./types";
import type { PlanningState } from "../planning/types";

export const HOURS_PER_MANDAY = 8;

// Keep team mappings here so data owners can extend them without changing UI code.
export const serviceAreaMappings = {
  app: ["app", "application", "software", "development", "dev", "qa", "quality assurance"],
  infra: ["infra", "infrastructure", "network", "platform", "cloud", "database", "server", "security", "operations"],
} as const;

const projectWorkTerms = ["development", "develop", "dev", "qa", "testing", "test", "implementation", "project", "delivery"];

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function containsTerm(value: string, terms: readonly string[]) {
  const words = normalized(value);
  return terms.some((term) => new RegExp(`(^|[^a-z])${term.replaceAll(" ", "\\s+")}([^a-z]|$)`, "i").test(words));
}

export function classifyServiceArea(entry: WorkEntry): ServiceArea {
  if (entry.squad) return "app";
  const source = `${entry.sourceGroup} ${entry.role}`;
  if (containsTerm(source, serviceAreaMappings.app)) return "app";
  if (containsTerm(source, serviceAreaMappings.infra)) return "infra";
  return "unmapped";
}

export function classifyWorkType(entry: WorkEntry): WorkType {
  return containsTerm(`${entry.task} ${entry.typeOfWork}`, projectWorkTerms) ? "project" : "support";
}

function percentage(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function buildArea(entries: WorkEntry[], serviceArea: ServiceArea): ResourcePortfolioArea {
  const customers = new Map<string, { projectHours: number; supportHours: number }>();

  entries.forEach((entry) => {
    if (classifyServiceArea(entry) !== serviceArea) return;
    const customer = entry.customer.trim() || "Unknown customer";
    const current = customers.get(customer) ?? { projectHours: 0, supportHours: 0 };
    current[classifyWorkType(entry) === "project" ? "projectHours" : "supportHours"] += entry.hours;
    customers.set(customer, current);
  });

  const totalHours = [...customers.values()].reduce((sum, row) => sum + row.projectHours + row.supportHours, 0);
  const rows = [...customers.entries()].map(([customer, hours]) => {
    const customerTotal = hours.projectHours + hours.supportHours;
    return {
      customer,
      ...hours,
      totalHours: customerTotal,
      projectMandays: hours.projectHours / HOURS_PER_MANDAY,
      supportMandays: hours.supportHours / HOURS_PER_MANDAY,
      totalMandays: customerTotal / HOURS_PER_MANDAY,
      projectPct: percentage(hours.projectHours, customerTotal),
      supportPct: percentage(hours.supportHours, customerTotal),
      totalPct: percentage(customerTotal, totalHours),
    };
  }).sort((first, second) => second.totalHours - first.totalHours || first.customer.localeCompare(second.customer));

  return {
    serviceArea,
    projectHours: rows.reduce((sum, row) => sum + row.projectHours, 0),
    supportHours: rows.reduce((sum, row) => sum + row.supportHours, 0),
    totalHours,
    rows,
  };
}

export function buildResourcePortfolio(entries: WorkEntry[]): ResourcePortfolio {
  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const departments = new Map<string, number>();
  entries.forEach((entry) => {
    const label = entry.customer.trim() || "Unknown customer";
    departments.set(label, (departments.get(label) ?? 0) + entry.hours);
  });

  return {
    totalHours,
    departments: [...departments.entries()]
      .map(([label, hours]) => ({ label, hours, percentage: percentage(hours, totalHours) }))
      .sort((first, second) => second.hours - first.hours || first.label.localeCompare(second.label)),
    app: buildArea(entries, "app"),
    infra: buildArea(entries, "infra"),
    unmapped: buildArea(entries, "unmapped"),
  };
}

export function getPortfolioPeriodLabel(dateFrom: string, dateTo: string) {
  if (!dateFrom && !dateTo) return "All periods";
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00Z`) : null;
  const to = dateTo ? new Date(`${dateTo}T00:00:00Z`) : null;
  if (from && to && from.getUTCFullYear() === to.getUTCFullYear()) {
    const fromQuarter = Math.floor(from.getUTCMonth() / 3) + 1;
    const toQuarter = Math.floor(to.getUTCMonth() / 3) + 1;
    if (fromQuarter === toQuarter) return `Q${fromQuarter} ${from.getUTCFullYear()}`;
  }
  const format = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  if (from && to) return `${format(from)} – ${format(to)}`;
  return from ? `From ${format(from)}` : `Through ${format(to!)}`;
}

export function getEstimatedMandays(
  planning: PlanningState | null,
  filters: { dateFrom: string; dateTo: string; customer: string; project: string },
) {
  if (!planning) return null;
  const years = [filters.dateFrom, filters.dateTo].filter(Boolean).map((date) => Number(date.slice(0, 4)));
  if (years.some((year) => year !== planning.year)) return null;

  const matching = planning.projects.filter((project) =>
    (!filters.customer || normalized(project.businessUnit) === normalized(filters.customer)) &&
    (!filters.project || normalized(project.name) === normalized(filters.project)),
  );
  if ((filters.customer || filters.project) && matching.length === 0) return null;
  return matching.reduce((total, project) => total + project.totalEffortMd, 0);
}
