import type { Sprint } from "../resource-capacity/domain";

export type PlannerMember = { id: string; squad_id: string; display_name: string; active: boolean; default_availability_pct: number };
export type WorkType = { id: string; display_name: string; display_order: number; archived_at: string | null };
export type AllocationRow = { id: string; squad_id: string; member_id: string; work_type_id: string; archived_at: string | null };
export type SprintAllocation = { id: string; row_id: string; sprint_id: string; allocation_pct: number };
export type MemberAvailability = { id: string; member_id: string; sprint_id: string; availability_pct: number };
export type PlannerData = { members: PlannerMember[]; workTypes: WorkType[]; rows: AllocationRow[]; allocations: SprintAllocation[]; availability: MemberAvailability[] };

export type CalendarDraft = { year: number; firstStart: string; durationWeeks: number; sprintCount: number };

const dayMs = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);

export function generateSprintPreview(draft: CalendarDraft, calendarId: string, existing: Sprint[] = []): Sprint[] {
  if (!Number.isInteger(draft.year) || draft.year < 2000 || draft.year > 2200) throw new Error("Planning year must be between 2000 and 2200.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.firstStart) || Number(draft.firstStart.slice(0, 4)) !== draft.year) throw new Error("First Sprint start must be in the planning year.");
  if (!Number.isInteger(draft.durationWeeks) || draft.durationWeeks < 1 || draft.durationWeeks > 4) throw new Error("Sprint duration must be 1–4 weeks.");
  if (!Number.isInteger(draft.sprintCount) || draft.sprintCount < 1 || draft.sprintCount > 60) throw new Error("Sprint count must be 1–60.");
  const first = new Date(`${draft.firstStart}T00:00:00.000Z`);
  if (Number.isNaN(first.getTime())) throw new Error("Enter a valid first Sprint start date.");
  const now = new Date().toISOString();
  return Array.from({ length: draft.sprintCount }, (_, index) => {
    const start = new Date(first.getTime() + index * draft.durationWeeks * 7 * dayMs);
    const end = new Date(start.getTime() + (draft.durationWeeks * 7 - 1) * dayMs);
    const prior = existing.find((item) => item.sequence_number === index + 1);
    return {
      id: prior?.id ?? crypto.randomUUID(), calendar_id: calendarId, sprint_code: `${draft.year}-S${index + 1}`,
      sequence_number: index + 1, start_date: iso(start), display_end_date: iso(end), coverage_end_date: iso(end),
      created_at: prior?.created_at ?? now, updated_at: now,
    };
  });
}

export function validateSprintDates(sprints: Sprint[]) {
  const ids = new Set<string>();
  for (let index = 0; index < sprints.length; index += 1) {
    const sprint = sprints[index];
    if (ids.has(sprint.sprint_code)) return "Sprint IDs must be unique.";
    ids.add(sprint.sprint_code);
    if (sprint.display_end_date < sprint.start_date) return `S${sprint.sequence_number} ends before it starts.`;
    if (index > 0 && sprint.start_date <= sprints[index - 1].display_end_date) return `S${sprint.sequence_number} overlaps the previous Sprint.`;
  }
  return null;
}

export function countWeekdays(startDate: string, endDate: string) {
  let count = 0;
  for (let time = new Date(`${startDate}T00:00:00.000Z`).getTime(), end = new Date(`${endDate}T00:00:00.000Z`).getTime(); time <= end; time += dayMs) {
    const day = new Date(time).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

export function availableMd(memberId: string, sprint: Sprint, availability: MemberAvailability[]) {
  const factor = (availability.find((item) => item.member_id === memberId && item.sprint_id === sprint.id)?.availability_pct ?? 100) / 100;
  return countWeekdays(sprint.start_date, sprint.display_end_date) * factor;
}

export function employeeTotals(data: PlannerData, sprints: Sprint[], allRows = data.rows) {
  const values = new Map<string, number>();
  for (const row of allRows.filter((item) => item.archived_at === null)) for (const allocation of data.allocations.filter((item) => item.row_id === row.id)) {
    const key = `${row.member_id}:${allocation.sprint_id}`;
    values.set(key, (values.get(key) ?? 0) + allocation.allocation_pct);
  }
  return values;
}

export function workloadMix(data: PlannerData, sprints: Sprint[]) {
  const activeRows = data.rows.filter((row) => row.archived_at === null);
  return sprints.map((sprint) => {
    const mdByType = new Map<string, number>();
    for (const allocation of data.allocations.filter((item) => item.sprint_id === sprint.id && item.allocation_pct > 0)) {
      const row = activeRows.find((item) => item.id === allocation.row_id);
      if (!row) continue;
      const defaultPct = data.members.find((item) => item.id === row.member_id)?.default_availability_pct ?? 100;
      const override = data.availability.find((item) => item.member_id === row.member_id && item.sprint_id === sprint.id)?.availability_pct;
      const md = countWeekdays(sprint.start_date, sprint.display_end_date) * (override ?? defaultPct) / 100 * allocation.allocation_pct / 100;
      mdByType.set(row.work_type_id, (mdByType.get(row.work_type_id) ?? 0) + md);
    }
    const totalMd = [...mdByType.values()].reduce((sum, value) => sum + value, 0);
    return { sprint, totalMd, mix: new Map([...mdByType].map(([id, md]) => [id, totalMd ? md / totalMd * 100 : 0])) };
  });
}

export function sortAllocationRows(rows: AllocationRow[], members: PlannerMember[], workTypes: WorkType[], groupBy: "employee" | "workType", direction: "asc" | "desc") {
  const memberName = (id: string) => members.find((item) => item.id === id)?.display_name ?? id;
  const typeName = (id: string) => workTypes.find((item) => item.id === id)?.display_name ?? id;
  const sign = direction === "asc" ? 1 : -1;
  return rows.toSorted((a, b) => {
    const primary = groupBy === "employee" ? memberName(a.member_id).localeCompare(memberName(b.member_id)) : typeName(a.work_type_id).localeCompare(typeName(b.work_type_id));
    const secondary = groupBy === "employee" ? typeName(a.work_type_id).localeCompare(typeName(b.work_type_id)) : memberName(a.member_id).localeCompare(memberName(b.member_id));
    return sign * (primary || secondary || a.id.localeCompare(b.id));
  });
}
