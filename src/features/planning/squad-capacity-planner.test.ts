import { describe, expect, it } from "vitest";
import { countWeekdays, effectiveWorkingDays, employeeTotals, generateSprintPreview, sortAllocationRows, squadCapacity, validateHolidayAdjustment, validateSprintDates, workloadMix, type PlannerData } from "./squad-capacity-planner";

const calendarId = "10000000-0000-4000-8000-000000000001";
const sprints = generateSprintPreview({ year: 2027, firstStart: "2027-01-04", durationWeeks: 2, sprintCount: 2 }, calendarId);

describe("shared Sprint Calendar", () => {
  it("generates variable counts and durations with stable existing IDs", () => {
    const next = generateSprintPreview({ year: 2027, firstStart: "2027-01-04", durationWeeks: 1, sprintCount: 3 }, calendarId, sprints);
    expect(next).toHaveLength(3);
    expect(next[0].id).toBe(sprints[0].id);
    expect(next[1].start_date).toBe("2027-01-11");
    expect(countWeekdays(next[0].start_date, next[0].display_end_date)).toBe(5);
  });

  it("rejects invalid input and detects irregular overlaps", () => {
    expect(() => generateSprintPreview({ year: 2027, firstStart: "2026-12-28", durationWeeks: 2, sprintCount: 26 }, calendarId)).toThrow(/planning year/i);
    expect(validateSprintDates([{ ...sprints[0], display_end_date: "2027-01-20" }, sprints[1]])).toMatch(/overlap/i);
  });

  it("subtracts validated global non-working weekdays without going negative", () => {
    const sprint = { ...sprints[0], holiday_adjustment_days: 2 };
    expect(countWeekdays(sprint.start_date, sprint.display_end_date)).toBe(10);
    expect(effectiveWorkingDays(sprint)).toBe(8);
    expect(validateHolidayAdjustment(sprint, 0)).toBe("");
    expect(validateHolidayAdjustment(sprint, 10)).toBe("");
    expect(validateHolidayAdjustment(sprint, 11)).toMatch(/0 to 10/);
  });
});

describe("allocation calculations", () => {
  const data: PlannerData = {
    members: [
      { id: "member-a", squad_id: "squad-a", display_name: "Alex", active: true, default_availability_pct: 100 },
      { id: "member-a", squad_id: "squad-b", display_name: "Alex", active: true, default_availability_pct: 100 },
      { id: "member-b", squad_id: "squad-a", display_name: "Bee", active: true, default_availability_pct: 100 },
    ],
    workTypes: [{ id: "dev", display_name: "Dev", display_order: 0, archived_at: null }, { id: "sa", display_name: "SA", display_order: 1, archived_at: null }],
    rows: [
      { id: "r1", squad_id: "squad-a", member_id: "member-a", work_type_id: "dev", archived_at: null },
      { id: "r2", squad_id: "squad-b", member_id: "member-a", work_type_id: "sa", archived_at: null },
      { id: "r3", squad_id: "squad-a", member_id: "member-b", work_type_id: "sa", archived_at: null },
    ],
    allocations: [
      { id: "a1", row_id: "r1", sprint_id: sprints[0].id, allocation_pct: 60 },
      { id: "a2", row_id: "r2", sprint_id: sprints[0].id, allocation_pct: 50 },
      { id: "a3", row_id: "r3", sprint_id: sprints[0].id, allocation_pct: 50 },
    ],
    availability: [{ id: "v1", member_id: "member-b", sprint_id: sprints[0].id, availability_pct: 50 }],
  };

  it("detects cross-Work-Type and cross-squad over-allocation by stable member ID", () => {
    expect(employeeTotals(data, sprints).get(`member-a:${sprints[0].id}`)).toBe(110);
  });

  it("weights workload mix by available MD and keeps empty Sprints empty", () => {
    const result = workloadMix(data, sprints);
    expect(result[0].mix.get("dev")).toBeCloseTo(60 / (60 + 50 + 50) * 100);
    expect(result[1].totalMd).toBe(0);
    expect(result[1].mix.size).toBe(0);
  });

  it("distinguishes no members from zero effective working days and applies default availability", () => {
    expect(squadCapacity(data, "missing", sprints)).toEqual([null, null]);
    const zeroDays = [{ ...sprints[0], holiday_adjustment_days: 10 }];
    expect(squadCapacity(data, "squad-a", zeroDays)).toEqual([0]);
    const withPartTime = { ...data, members: data.members.map((member) => member.id === "member-b" ? { ...member, default_availability_pct: 50 } : member) };
    expect(squadCapacity(withPartTime, "squad-a", [sprints[0]])).toEqual([15]);
  });

  it("sorts without mutating row identity", () => {
    const sorted = sortAllocationRows(data.rows, data.members, data.workTypes, "workType", "desc");
    expect(new Set(sorted.map((row) => row.id))).toEqual(new Set(data.rows.map((row) => row.id)));
    expect(data.rows[0].id).toBe("r1");
  });
});
