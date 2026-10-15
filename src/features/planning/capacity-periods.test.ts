import { describe, expect, it } from "vitest";
import { assignUniqueMapping, capacityVsDemand, findOverlappingPeriod, periodsOverlap, resolvePlannedDemand, resolveSprintCapacity, validateCalendarConfirmation, validateCapacityPeriod, type CapacityPeriodValue } from "./capacity-periods";
import type { PlanningProject } from "./types";

const periods: CapacityPeriodValue[] = [
  { id: "p1", squad_id: "s1", calendar_id: "c1", start_sprint: 1, end_sprint: 3, capacity_md: 20, archived_at: null },
  { id: "p2", squad_id: "s1", calendar_id: "c1", start_sprint: 5, end_sprint: 6, capacity_md: 0, archived_at: null },
  { id: "p3", squad_id: "s1", calendar_id: "c1", start_sprint: 4, end_sprint: 4, capacity_md: 99, archived_at: "2026-10-12T00:00:00Z" },
];

const project: PlanningProject = {
  id: "legacy-project",
  name: "Legacy",
  businessUnit: "BU",
  totalEffortMd: 999,
  status: "scheduled",
  scheduledStartSprint: 2,
  scheduledEndSprint: 3,
  squadEffort: [{ squadId: "legacy-squad", squadName: "Legacy Squad", devMd: 900, testMd: 99, totalMd: 999 }],
};

describe("capacity periods", () => {
  it("validates ranges and accepts zero capacity", () => {
    expect(validateCapacityPeriod({ squad_id: "s1", calendar_id: "c1", start_sprint: 1, end_sprint: 2, capacity_md: 0 }, 6)).toBe("");
    expect(validateCapacityPeriod({ squad_id: "s1", calendar_id: "c1", start_sprint: 1, end_sprint: 2, capacity_md: -1 }, 6)).toMatch(/zero or more/);
    expect(validateCapacityPeriod({ squad_id: "s1", calendar_id: "c1", start_sprint: 1, end_sprint: 2, capacity_md: Number.NaN }, 6)).toMatch(/finite/);
    expect(validateCapacityPeriod({ squad_id: "s1", calendar_id: "c1", start_sprint: 4, end_sprint: 3, capacity_md: 1 }, 6)).toMatch(/same as or after/);
  });

  it("uses inclusive overlap rules while ignoring archived and edited records", () => {
    expect(periodsOverlap(periods[0], { start_sprint: 3, end_sprint: 4 })).toBe(true);
    expect(findOverlappingPeriod({ squad_id: "s1", calendar_id: "c1", start_sprint: 3, end_sprint: 4, capacity_md: 10 }, periods)?.id).toBe("p1");
    expect(findOverlappingPeriod({ squad_id: "s1", calendar_id: "c1", start_sprint: 1, end_sprint: 4, capacity_md: 10 }, periods, "p1")).toBeNull();
  });

  it("resolves multiple periods, gaps, zero, and archived records", () => {
    expect(resolveSprintCapacity(periods, "s1", "c1", 6)).toEqual([20, 20, 20, null, 0, 0]);
  });

  it("uses mapped Supabase effort once and distributes it across scheduled Sprints", () => {
    const demand = resolvePlannedDemand([project], "legacy-squad", 4, new Map([["legacy-project", 40]]));
    expect(demand).toEqual([0, 20, 20, 0]);
    expect(capacityVsDemand([null, 20, 0, 30], demand)).toEqual([
      { capacityMd: null, demandMd: 0, remainingMd: null },
      { capacityMd: 20, demandMd: 20, remainingMd: 0 },
      { capacityMd: 0, demandMd: 20, remainingMd: -20 },
      { capacityMd: 30, demandMd: 0, remainingMd: 30 },
    ]);
  });

  it("enforces one-to-one mappings so effort cannot be counted twice", () => {
    const first = assignUniqueMapping({}, "legacy-1", "supabase-1");
    expect(first.error).toBe("");
    const duplicate = assignUniqueMapping(first.mapping, "legacy-2", "supabase-1");
    expect(duplicate.error).toMatch(/already mapped/);
    expect(duplicate.mapping).toEqual({ "legacy-1": "supabase-1" });
  });

  it("requires exact calendar start, count, sequence, duration, and dates", () => {
    const roadmap = [
      { number: 1, start: "2027-01-04", end: "2027-01-15", month: "Jan" },
      { number: 2, start: "2027-01-18", end: "2027-01-29", month: "Jan" },
    ];
    const candidate = [
      { sequence_number: 1, start_date: "2027-01-04", display_end_date: "2027-01-15", coverage_end_date: "2027-01-17" },
      { sequence_number: 2, start_date: "2027-01-18", display_end_date: "2027-01-29", coverage_end_date: "2027-01-31" },
    ];
    expect(validateCalendarConfirmation({ baseline_start_date: "2027-01-04", cadence_days: 14 }, candidate, roadmap)).toBe("");
    expect(validateCalendarConfirmation({ baseline_start_date: "2027-01-05", cadence_days: 14 }, candidate, roadmap)).toMatch(/start date/);
    expect(validateCalendarConfirmation({ baseline_start_date: "2027-01-04", cadence_days: 14 }, [candidate[1], candidate[0]], roadmap)).toMatch(/sequence/);
  });
});
