import { describe, expect, it } from "vitest";
import type { Project, Squad } from "../resource-capacity/domain";
import { previewProjectImport } from "./project-import";

const now = "2027-01-01T00:00:00.000Z";
const squad: Squad = { id: "20000000-0000-4000-8000-000000000001", display_name: "Alpha", active: true, display_order: 0, created_at: now, updated_at: now };
const existing: Project = { id: "10000000-0000-4000-8000-000000000001", project_name: "Existing", description: null, status: "active", metadata: {}, archived_at: null, created_at: now, updated_at: now };

describe("previewProjectImport", () => {
  it("groups multiple Squad rows and preserves explicit zero effort", () => {
    const preview = previewProjectImport([
      { "Project Name": "CRM", Squad: "Alpha", "Dev MD": 0, "QA MD": 5 },
    ], [], [squad]);
    expect(preview.issues).toEqual([]);
    expect(preview.projects[0].efforts[0]).toMatchObject({ dev_md: 0, qa_md: 5 });
  });

  it("skips existing projects and reports row-level errors", () => {
    const preview = previewProjectImport([
      { "Project Name": " existing ", Squad: "Alpha", "Dev MD": 2, "QA MD": 1 },
      { "Project Name": "New", Squad: "Missing", "Dev MD": 2, "QA MD": 1 },
    ], [existing], [squad]);
    expect(preview.projects[0].skipped).toBe(true);
    expect(preview.issues).toEqual([{ row: 3, message: "Squad “Missing” was not found or is inactive." }]);
  });

  it("rejects conflicting metadata across rows for the same project", () => {
    const preview = previewProjectImport([
      { "Project Name": "CRM", "Business Unit": "A" },
      { "Project Name": "CRM", "Business Unit": "B" },
    ], [], [squad]);
    expect(preview.issues[0]).toEqual({ row: 3, message: "Project details conflict with row 2." });
  });
});
