import type { PlanningProject } from "./types";
import type { Sprint } from "./types";

export type CapacityPeriodValue = {
  id: string;
  squad_id: string;
  calendar_id: string;
  start_sprint: number;
  end_sprint: number;
  capacity_md: number;
  archived_at: string | null;
};

export type CapacityPeriodInput = Omit<CapacityPeriodValue, "id" | "archived_at">;

export function validateCapacityPeriod(period: CapacityPeriodInput, sprintCount: number) {
  if (!Number.isInteger(period.start_sprint) || period.start_sprint < 1) return "Start Sprint must be a positive whole number.";
  if (!Number.isInteger(period.end_sprint) || period.end_sprint < period.start_sprint) return "End Sprint must be the same as or after Start Sprint.";
  if (period.end_sprint > sprintCount) return `End Sprint must be S${sprintCount} or earlier.`;
  if (!Number.isFinite(period.capacity_md) || period.capacity_md < 0) return "Capacity must be a finite value of zero or more.";
  return "";
}

export function periodsOverlap(left: Pick<CapacityPeriodValue, "start_sprint" | "end_sprint">, right: Pick<CapacityPeriodValue, "start_sprint" | "end_sprint">) {
  return left.start_sprint <= right.end_sprint && right.start_sprint <= left.end_sprint;
}

export function findOverlappingPeriod(period: CapacityPeriodInput, periods: CapacityPeriodValue[], editingId?: string | null) {
  return periods.find((candidate) => candidate.id !== editingId && candidate.archived_at === null && candidate.squad_id === period.squad_id && candidate.calendar_id === period.calendar_id && periodsOverlap(period, candidate)) ?? null;
}

export function resolveSprintCapacity(periods: CapacityPeriodValue[], squadId: string, calendarId: string, sprintCount: number): Array<number | null> {
  return Array.from({ length: sprintCount }, (_, index) => {
    const sprint = index + 1;
    return periods.find((period) => period.archived_at === null && period.squad_id === squadId && period.calendar_id === calendarId && sprint >= period.start_sprint && sprint <= period.end_sprint)?.capacity_md ?? null;
  });
}

export function resolvePlannedDemand(projects: PlanningProject[], legacySquadId: string, sprintCount: number, effortByProject: ReadonlyMap<string, number>): number[] {
  const demand = Array(sprintCount).fill(0) as number[];
  for (const project of projects) {
    if (project.status !== "scheduled" || project.scheduledStartSprint === null || project.scheduledEndSprint === null) continue;
    const effort = effortByProject.get(project.id) ?? 0;
    const perSprint = effort / (project.scheduledEndSprint - project.scheduledStartSprint + 1);
    if (!project.squadEffort.some((item) => item.squadId === legacySquadId)) continue;
    for (let sprint = project.scheduledStartSprint; sprint <= project.scheduledEndSprint; sprint += 1) demand[sprint - 1] += perSprint;
  }
  return demand;
}

export function capacityVsDemand(capacity: Array<number | null>, demand: number[]) {
  return capacity.map((value, index) => ({ capacityMd: value, demandMd: demand[index] ?? 0, remainingMd: value === null ? null : value - (demand[index] ?? 0) }));
}

export function assignUniqueMapping(mapping: Readonly<Record<string, string>>, legacyId: string, targetId: string) {
  if (targetId && Object.entries(mapping).some(([otherLegacyId, otherTargetId]) => otherLegacyId !== legacyId && otherTargetId === targetId)) {
    return { mapping, error: "That Supabase record is already mapped to another legacy record." };
  }
  return { mapping: { ...mapping, [legacyId]: targetId }, error: "" };
}

type CalendarCandidate = { baseline_start_date: string; cadence_days: number };
type SprintCandidate = { sequence_number: number; start_date: string; display_end_date: string; coverage_end_date: string };

export function validateCalendarConfirmation(calendar: CalendarCandidate, candidateSprints: SprintCandidate[], roadmapSprints: Sprint[]) {
  if (calendar.baseline_start_date !== roadmapSprints[0]?.start) return "Calendar start date does not match the Roadmap Sprint 1 start date.";
  if (calendar.cadence_days !== 14) return "Calendar cadence must be 14 days.";
  if (candidateSprints.length !== roadmapSprints.length) return "Calendar Sprint count does not match the Roadmap.";
  for (let index = 0; index < roadmapSprints.length; index += 1) {
    const candidate = candidateSprints[index];
    const roadmap = roadmapSprints[index];
    if (!candidate || candidate.sequence_number !== index + 1) return "Calendar Sprint sequence must be contiguous from S1.";
    if (candidate.start_date !== roadmap.start || candidate.display_end_date !== roadmap.end) return `Calendar dates do not match the Roadmap at S${index + 1}.`;
    const coverageEnd = new Date(`${candidate.start_date}T00:00:00Z`);
    coverageEnd.setUTCDate(coverageEnd.getUTCDate() + 13);
    if (candidate.coverage_end_date !== coverageEnd.toISOString().slice(0, 10)) return `Calendar Sprint duration is invalid at S${index + 1}.`;
  }
  return "";
}
