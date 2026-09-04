import type { PlanningProject, Sprint, SquadCapacity } from "./types";

const dayMs = 86_400_000;

function iso(date: Date) { return date.toISOString().slice(0, 10); }
function utcDate(value: string) { return new Date(`${value}T00:00:00Z`); }

export function validateSprintStart(value: string, year: number) {
  if (!value) return "Choose a Sprint 1 start date.";
  const date = utcDate(value);
  if (Number.isNaN(date.getTime())) return "Choose a valid Sprint 1 start date.";
  if (date.getUTCFullYear() !== year) return `Sprint 1 must start in ${year}.`;
  if (date.getUTCDay() !== 1) return "Sprint 1 must start on a Monday.";
  return "";
}

export function generateSprints(year: number, startValue: string): Sprint[] {
  if (validateSprintStart(startValue, year)) return [];
  const result: Sprint[] = [];
  let start = utcDate(startValue);
  while (start.getUTCFullYear() === year) {
    const end = new Date(start.getTime() + 11 * dayMs);
    result.push({ number: result.length + 1, start: iso(start), end: iso(end), month: start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) });
    start = new Date(start.getTime() + 14 * dayMs);
  }
  return result;
}

export function formatSprintRange(sprint: Sprint) {
  const start = utcDate(sprint.start);
  const end = utcDate(sprint.end);
  const month = start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${start.getUTCDate()} ${month}–${end.getUTCDate()} ${endMonth}`;
}

export function remainingCapacity(projects: PlanningProject[], squads: SquadCapacity[], sprintCount: number) {
  const values: Record<string, number[]> = Object.fromEntries(squads.map((s) => [s.id, Array(sprintCount).fill(s.capacityMd)]));
  for (const project of projects) {
    if (project.status !== "scheduled" || !project.scheduledStartSprint || !project.scheduledEndSprint) continue;
    const duration = project.scheduledEndSprint - project.scheduledStartSprint + 1;
    for (const effort of project.squadEffort) {
      if (!values[effort.squadId]) continue;
      const perSprint = effort.totalMd / duration;
      for (let sprint = project.scheduledStartSprint; sprint <= project.scheduledEndSprint; sprint += 1) values[effort.squadId][sprint - 1] -= perSprint;
    }
  }
  return values;
}
