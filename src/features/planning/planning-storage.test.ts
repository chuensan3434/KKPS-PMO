import { beforeEach, describe, expect, it } from "vitest";
import { loadEstimationState, saveEstimationState } from "./estimation-storage";
import { loadPlanningState, savePlanningState } from "./planning-storage";
import type { EstimationState, PlanningState } from "./types";

const planning: PlanningState = {
  year: 2026,
  sprintOneStart: "2026-01-05",
  squads: [{ id: "legacy-squad", name: "Legacy Squad", capacityMd: 17.5 }],
  projects: [{
    id: "legacy-project",
    name: "Legacy Project",
    businessUnit: "Legacy BU",
    totalEffortMd: 12,
    status: "scheduled",
    scheduledStartSprint: 2,
    scheduledEndSprint: 4,
    squadEffort: [{ squadId: "legacy-squad", squadName: "Legacy Squad", devMd: 8, testMd: 4, totalMd: 12 }],
  }],
};

const estimation: EstimationState = {
  version: 1,
  projects: [{ projectId: "legacy-project", requirements: [{
    id: "legacy-requirement",
    projectId: "legacy-project",
    title: "Legacy Requirement",
    status: "estimated",
    estimates: [{ squadId: "legacy-squad", devMd: 8, testMd: 4 }],
  }] }],
};

beforeEach(() => window.localStorage.clear());

describe("legacy browser storage compatibility", () => {
  it("round-trips existing Planning JSON without changing its shape or values", () => {
    savePlanningState(planning);
    expect(loadPlanningState()).toEqual(planning);
    expect(JSON.parse(window.localStorage.getItem("kkps-pmo:roadmap-planning:v1") ?? "null")).toEqual(planning);
  });

  it("loads matching Estimation JSON and retains testMd as the legacy field", () => {
    saveEstimationState(estimation);
    expect(loadEstimationState(planning.projects)).toEqual(estimation);
    expect(loadEstimationState(planning.projects).projects[0].requirements[0].estimates[0]).toHaveProperty("testMd", 4);
  });
});
