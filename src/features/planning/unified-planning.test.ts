import { describe, expect, it } from "vitest";
import type { Project, ProjectRoadmapSchedule, ProjectSquadEffort, Sprint, Squad } from "../resource-capacity/domain";
import { buildUnifiedPlanningState, distributeEffort, resolveUnifiedDemand } from "./unified-planning";

const now = "2026-10-15T00:00:00.000Z";
const projectId = "10000000-0000-4000-8000-000000000001";
const squadA = "20000000-0000-4000-8000-000000000001";
const squadB = "20000000-0000-4000-8000-000000000002";
const calendarId = "30000000-0000-4000-8000-000000000001";
const projects: Project[] = [{ id: projectId, project_name: "Renamed Project", description: null, status: "active", metadata: {}, archived_at: null, created_at: now, updated_at: now }, { id: "10000000-0000-4000-8000-000000000002", project_name: "Archived", description: null, status: "active", metadata: {}, archived_at: now, created_at: now, updated_at: now }];
const squads: Squad[] = [{ id: squadA, display_name: "Renamed Alpha", active: true, display_order: 0, created_at: now, updated_at: now }, { id: squadB, display_name: "Beta", active: true, display_order: 1, created_at: now, updated_at: now }];
const efforts: ProjectSquadEffort[] = [{ id: "40000000-0000-4000-8000-000000000001", project_id: projectId, squad_id: squadA, dev_md: 40, qa_md: 20, archived_at: null, created_at: now, updated_at: now }, { id: "40000000-0000-4000-8000-000000000002", project_id: projectId, squad_id: squadB, dev_md: 15, qa_md: 5, archived_at: null, created_at: now, updated_at: now }, { id: "40000000-0000-4000-8000-000000000003", project_id: projectId, squad_id: squadA, dev_md: 999, qa_md: 1, archived_at: now, created_at: now, updated_at: now }];
const schedules: ProjectRoadmapSchedule[] = [{ id: "50000000-0000-4000-8000-000000000001", project_id: projectId, calendar_id: calendarId, start_sprint: 1, end_sprint: 3, archived_at: null, created_at: now, updated_at: now }];
const sprints: Sprint[] = Array.from({ length: 3 }, (_, index) => ({ id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, calendar_id: calendarId, sprint_code: `S${index + 1}`, sequence_number: index + 1, start_date: `2027-01-${String(index * 14 + 1).padStart(2, "0")}`, display_end_date: "2027-01-12", coverage_end_date: "2027-01-14", created_at: now, updated_at: now }));

describe("unified planning projection", () => {
  it("uses stable IDs, multiple squads, active effort once, renames, and excludes archives", () => {
    const state = buildUnifiedPlanningState(projects, squads, efforts, schedules, sprints);
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0]).toMatchObject({ id: projectId, name: "Renamed Project", status: "scheduled", totalEffortMd: 80, scheduledStartSprint: 1, scheduledEndSprint: 3 });
    expect(state.projects[0].squadEffort).toEqual([
      { squadId: squadA, squadName: "Renamed Alpha", devMd: 40, testMd: 20, totalMd: 60 },
      { squadId: squadB, squadName: "Beta", devMd: 15, testMd: 5, totalMd: 20 },
    ]);
  });

  it("distributes demand without losing rounding remainder or double-counting", () => {
    expect(distributeEffort(10, 3)).toEqual([3.33, 3.33, 3.34]);
    const state = buildUnifiedPlanningState(projects, squads, efforts, schedules, sprints);
    expect(resolveUnifiedDemand(state.projects, squadA, 3)).toEqual([20, 20, 20]);
    expect(resolveUnifiedDemand(state.projects, squadB, 3).reduce((sum, value) => sum + value, 0)).toBe(20);
  });
});
