import { describe, expect, it } from "vitest";
import { generateSprints, remainingCapacity, validateSprintStart } from "./planning-utils";
import type { PlanningProject } from "./types";

const scheduledProject: PlanningProject = {
  id: "project-1",
  name: "Project 1",
  businessUnit: "Unit",
  totalEffortMd: 40,
  status: "scheduled",
  scheduledStartSprint: 2,
  scheduledEndSprint: 3,
  squadEffort: [{ squadId: "squad-1", squadName: "Squad 1", devMd: 30, testMd: 10, totalMd: 40 }],
};

describe("generateSprints characterization", () => {
  it("generates the agreed 2027 baseline every 14 days with a second-Friday display end", () => {
    const sprints = generateSprints(2027, "2027-01-04");

    expect(sprints).toHaveLength(26);
    expect(sprints[0]).toMatchObject({ number: 1, start: "2027-01-04", end: "2027-01-15" });
    expect(sprints[1]).toMatchObject({ number: 2, start: "2027-01-18", end: "2027-01-29" });
    expect(sprints[25]).toMatchObject({ number: 26, start: "2027-12-20", end: "2027-12-31" });
  });

  it("retains the current Monday and planning-year validation", () => {
    expect(validateSprintStart("2027-01-05", 2027)).toBe("Sprint 1 must start on a Monday.");
    expect(validateSprintStart("2026-12-28", 2027)).toBe("Sprint 1 must start in 2027.");
    expect(generateSprints(2027, "2027-01-05")).toEqual([]);
  });

  it("stops when the next sprint start leaves the planning year", () => {
    expect(generateSprints(2027, "2027-12-20")).toEqual([
      { number: 1, start: "2027-12-20", end: "2027-12-31", month: "Dec" },
    ]);
  });
});

describe("remainingCapacity characterization", () => {
  it("evenly redistributes unchanged total squad effort across the scheduled duration", () => {
    const twoSprint = remainingCapacity([scheduledProject], [{ id: "squad-1", name: "Squad 1", capacityMd: 30 }], 4);
    const fourSprint = remainingCapacity([
      { ...scheduledProject, scheduledStartSprint: 1, scheduledEndSprint: 4 },
    ], [{ id: "squad-1", name: "Squad 1", capacityMd: 30 }], 4);

    expect(twoSprint["squad-1"]).toEqual([30, 10, 10, 30]);
    expect(fourSprint["squad-1"]).toEqual([20, 20, 20, 20]);
    expect(scheduledProject.totalEffortMd).toBe(40);
  });
});
