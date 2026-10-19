import { beforeEach, describe, expect, it } from "vitest";
import { createMockCapacityRepository, createMockEffortRepository, createMockProjectRepository, createMockQuarterPlanRepository, createMockScheduleRepository, createMockSquadRepository } from "./mock-repositories";

beforeEach(() => window.localStorage.clear());

describe("local mock data repositories", () => {
  it("persists project, squad, effort, and capacity CRUD across repository instances", async () => {
    const projects = createMockProjectRepository();
    const squads = createMockSquadRepository();
    const efforts = createMockEffortRepository();
    const periods = createMockCapacityRepository();
    const initialSquads = await squads.list();

    const project = await projects.create({ project_name: "Local project", description: null, status: "draft", metadata: {} });
    const updatedProject = await createMockProjectRepository().update(project.id, { status: "active" });
    expect(updatedProject.status).toBe("active");

    const squad = await squads.create({ display_name: "Squad Delta", active: true, display_order: 4 });
    expect((await createMockSquadRepository().list()).some((item) => item.id === squad.id)).toBe(true);

    const effort = await efforts.assign({ project_id: project.id, squad_id: squad.id, dev_md: 10, qa_md: 5 });
    expect((await createMockEffortRepository().list(project.id))[0]).toMatchObject({ id: effort.id, dev_md: 10, qa_md: 5 });

    const period = await periods.create({ squad_id: initialSquads[0].id, calendar_id: "10000000-0000-4000-8000-000000000001", start_sprint: 1, end_sprint: 3, capacity_md: 25, source: "manual" });
    const updatedPeriod = await createMockCapacityRepository().update(period.id, { capacity_md: 30 });
    expect(updatedPeriod.capacity_md).toBe(30);
    expect((await createMockCapacityRepository().list())[0].id).toBe(period.id);
  });

  it("persists schedules separately without changing either legacy planning key", async () => {
    localStorage.setItem("kkps-pmo:roadmap-planning:v1", "legacy-roadmap");
    localStorage.setItem("kkps-pmo:effort-estimation:v1", "legacy-estimation");
    const schedule = await createMockScheduleRepository().create({ project_id: "30000000-0000-4000-8000-000000000001", calendar_id: "10000000-0000-4000-8000-000000000001", start_sprint: 2, end_sprint: 4 });
    expect(await createMockScheduleRepository().list(schedule.calendar_id)).toContainEqual(schedule);
    expect(localStorage.getItem("kkps-pmo:roadmap-planning:v1")).toBe("legacy-roadmap");
    expect(localStorage.getItem("kkps-pmo:effort-estimation:v1")).toBe("legacy-estimation");
  });

  it("persists quarter intent separately from Sprint schedules", async () => {
    const plan = await createMockQuarterPlanRepository().create({ project_id: "30000000-0000-4000-8000-000000000001", planned_year: 2027, start_quarter: 1, end_quarter: 3 });
    expect(await createMockQuarterPlanRepository().list(2027)).toContainEqual(plan);
    expect(await createMockScheduleRepository().list("10000000-0000-4000-8000-000000000001")).toEqual([]);
  });
});
