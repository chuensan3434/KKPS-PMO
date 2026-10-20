import type { Project, ProjectRoadmapSchedule, ProjectSquadEffort, Sprint, Squad } from "../resource-capacity/domain";
import type { PlanningProject, PlanningState } from "./types";

export function buildUnifiedPlanningState(projects: Project[], squads: Squad[], efforts: ProjectSquadEffort[], schedules: ProjectRoadmapSchedule[], sprints: Sprint[]): PlanningState {
  const activeSquads = squads.filter((squad) => squad.active);
  const squadById = new Map(activeSquads.map((squad) => [squad.id, squad]));
  const activeScheduleByProject = new Map(schedules.filter((schedule) => schedule.archived_at === null).map((schedule) => [schedule.project_id, schedule]));
  const planningProjects = projects.filter((project) => project.archived_at === null).map((project): PlanningProject => {
    const schedule = activeScheduleByProject.get(project.id);
    const squadEffort = efforts.filter((effort) => effort.project_id === project.id && effort.archived_at === null && squadById.has(effort.squad_id)).map((effort) => {
      const squad = squadById.get(effort.squad_id)!;
      return { squadId: squad.id, squadName: squad.display_name, devMd: effort.dev_md, testMd: effort.qa_md, totalMd: effort.dev_md + effort.qa_md };
    });
    const metadata = project.metadata as Record<string, unknown>;
    return {
      id: project.id,
      name: project.project_name,
      businessUnit: typeof metadata.businessUnit === "string" ? metadata.businessUnit : "",
      priority: typeof metadata.priority === "string" ? metadata.priority : undefined,
      category: typeof metadata.category === "string" ? metadata.category : undefined,
      totalEffortMd: squadEffort.reduce((sum, effort) => sum + effort.totalMd, 0),
      status: schedule ? "scheduled" : "unscheduled",
      scheduledStartSprint: schedule?.start_sprint ?? null,
      scheduledEndSprint: schedule?.end_sprint ?? null,
      squadEffort,
    };
  });
  return {
    year: Number(sprints[0]?.start_date.slice(0, 4) ?? new Date().getFullYear()),
    sprintOneStart: sprints[0]?.start_date ?? "",
    squads: activeSquads.map((squad) => ({ id: squad.id, name: squad.display_name, capacityMd: 0 })),
    projects: planningProjects,
  };
}

export function distributeEffort(totalMd: number, sprintCount: number) {
  if (sprintCount <= 0) return [];
  const rounded = Math.round((totalMd / sprintCount) * 100) / 100;
  return Array.from({ length: sprintCount }, (_, index) => index === sprintCount - 1 ? Math.round((totalMd - rounded * (sprintCount - 1)) * 100) / 100 : rounded);
}

export function resolveUnifiedDemand(projects: PlanningProject[], squadId: string, sprintCount: number) {
  const demand = Array(sprintCount).fill(0) as number[];
  for (const project of projects) {
    if (project.status !== "scheduled" || project.scheduledStartSprint === null || project.scheduledEndSprint === null) continue;
    const effort = project.squadEffort.find((item) => item.squadId === squadId)?.totalMd;
    if (effort === undefined) continue;
    const allocations = distributeEffort(effort, project.scheduledEndSprint - project.scheduledStartSprint + 1);
    allocations.forEach((value, index) => { demand[project.scheduledStartSprint! - 1 + index] += value; });
  }
  return demand;
}
