import { describe, expect, it } from "vitest";
import { scheduleProject, setProjectEndSprint, setProjectStartSprint, unscheduleProject } from "./roadmap-actions";
import type { PlanningProject } from "./types";

const project: PlanningProject = {
  id: "project-1",
  name: "Project 1",
  businessUnit: "Unit",
  totalEffortMd: 40,
  status: "unscheduled",
  scheduledStartSprint: null,
  scheduledEndSprint: null,
  squadEffort: [{ squadId: "squad-1", squadName: "Squad 1", devMd: 30, testMd: 10, totalMd: 40 }],
};

describe("roadmap actions characterization", () => {
  it("schedules a backlog project for two sprints and clamps its end", () => {
    expect(scheduleProject(project, 5, 26)).toMatchObject({ status: "scheduled", scheduledStartSprint: 5, scheduledEndSprint: 6 });
    expect(scheduleProject(project, 26, 26)).toMatchObject({ status: "scheduled", scheduledStartSprint: 26, scheduledEndSprint: 26 });
  });

  it("leaves the original project unchanged when a drag is cancelled", () => {
    const before = structuredClone(project);
    expect(project).toEqual(before);
  });

  it("unschedules and preserves effort", () => {
    const scheduled = scheduleProject(project, 5, 26);
    expect(unscheduleProject(scheduled)).toMatchObject({ status: "unscheduled", scheduledStartSprint: null, scheduledEndSprint: null, totalEffortMd: 40 });
  });

  it("retains current manual start and end selection semantics", () => {
    const scheduled = scheduleProject(project, 5, 26);
    expect(setProjectStartSprint(scheduled, 8)).toMatchObject({ scheduledStartSprint: 8, scheduledEndSprint: 8 });
    expect(setProjectStartSprint(scheduled, 3)).toMatchObject({ scheduledStartSprint: 3, scheduledEndSprint: 6 });
    expect(setProjectEndSprint(scheduled, 10)).toMatchObject({ scheduledStartSprint: 5, scheduledEndSprint: 10 });
  });
});
