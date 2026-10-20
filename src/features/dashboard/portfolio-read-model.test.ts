import { describe, expect, it } from "vitest";
import type { Project } from "../resource-capacity/domain";
import { buildPortfolioSummary } from "./portfolio-read-model";

const now = "2027-01-01T00:00:00.000Z";
const projects: Project[] = ["Needs estimate", "Ready", "Planned"].map((project_name, index) => ({ id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, project_name, description: null, status: "active", metadata: {}, archived_at: null, created_at: now, updated_at: now }));

describe("buildPortfolioSummary", () => {
  it("derives readiness from canonical effort and planning records", () => {
    const summary = buildPortfolioSummary(projects, [
      { id: "20000000-0000-4000-8000-000000000001", project_id: projects[1].id, squad_id: "30000000-0000-4000-8000-000000000001", dev_md: 0, qa_md: 0, archived_at: null, created_at: now, updated_at: now },
      { id: "20000000-0000-4000-8000-000000000002", project_id: projects[2].id, squad_id: "30000000-0000-4000-8000-000000000001", dev_md: 10, qa_md: 5, archived_at: null, created_at: now, updated_at: now },
    ], [{ id: "40000000-0000-4000-8000-000000000001", project_id: projects[2].id, calendar_id: "50000000-0000-4000-8000-000000000001", start_sprint: 1, end_sprint: 2, archived_at: null, created_at: now, updated_at: now }], 2);
    expect(summary).toEqual({ projects: 3, needsEstimation: 1, readyForPlanning: 1, planned: 1, capacityExceptions: 2 });
  });
});
