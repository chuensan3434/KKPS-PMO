import { describe, expect, it } from "vitest";
import { moveProjectSchedule, resizeProjectSchedule } from "./timeline-utils";
import type { PlanningProject } from "./types";

const project: PlanningProject = {
  id: "project-1",
  name: "Project 1",
  businessUnit: "Unit",
  totalEffortMd: 40,
  status: "scheduled",
  scheduledStartSprint: 4,
  scheduledEndSprint: 6,
  squadEffort: [{ squadId: "squad-1", squadName: "Squad 1", devMd: 30, testMd: 10, totalMd: 40 }],
};

describe("roadmap timeline characterization", () => {
  it("moves a scheduled bar while preserving duration and clamps it to year bounds", () => {
    expect(moveProjectSchedule(project, 10, 26)).toEqual({ scheduledStartSprint: 10, scheduledEndSprint: 12 });
    expect(moveProjectSchedule(project, 26, 26)).toEqual({ scheduledStartSprint: 24, scheduledEndSprint: 26 });
    expect(moveProjectSchedule(project, 0, 26)).toEqual({ scheduledStartSprint: 1, scheduledEndSprint: 3 });
    expect(project.totalEffortMd).toBe(40);
  });

  it("extends and shrinks only the right edge with a minimum duration of one sprint", () => {
    expect(resizeProjectSchedule(project, 9, 26)).toEqual({ scheduledStartSprint: 4, scheduledEndSprint: 9 });
    expect(resizeProjectSchedule(project, 5, 26)).toEqual({ scheduledStartSprint: 4, scheduledEndSprint: 5 });
    expect(resizeProjectSchedule(project, 2, 26)).toEqual({ scheduledStartSprint: 4, scheduledEndSprint: 4 });
    expect(project.scheduledStartSprint).toBe(4);
    expect(project.totalEffortMd).toBe(40);
  });
});
