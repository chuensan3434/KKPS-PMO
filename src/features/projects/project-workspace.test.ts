import { describe, expect, it } from "vitest";
import type { Project, ProjectSquadEffort } from "../resource-capacity/domain";
import { getProjectNextStep } from "./project-workspace";

const project: Project = {
  id: "10000000-0000-4000-8000-000000000001",
  project_name: "CRM",
  description: null,
  business_unit: null,
  owner_name: null,
  target_date: null,
  status: "active",
  metadata: {},
  archived_at: null,
  created_at: "2027-01-01T00:00:00.000Z",
  updated_at: "2027-01-01T00:00:00.000Z",
};

describe("getProjectNextStep", () => {
  it("requires an active effort assignment before planning", () => {
    expect(getProjectNextStep(project, [])).toBe("Needs Estimation");
  });

  it("treats explicit zero effort as estimated", () => {
    const effort: ProjectSquadEffort = {
      id: "20000000-0000-4000-8000-000000000001",
      project_id: project.id,
      squad_id: "30000000-0000-4000-8000-000000000001",
      dev_md: 0,
      qa_md: 0,
      archived_at: null,
      created_at: project.created_at,
      updated_at: project.updated_at,
    };
    expect(getProjectNextStep(project, [effort])).toBe("Ready for Planning");
    expect(getProjectNextStep(project, [{ ...effort, archived_at: project.updated_at }])).toBe("Needs Estimation");
  });
});
