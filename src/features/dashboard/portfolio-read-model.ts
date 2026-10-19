import type { Project, ProjectQuarterPlan, ProjectRoadmapSchedule, ProjectSquadEffort, Sprint, Squad } from "../resource-capacity/domain";
import type { PlannerData } from "../planning/squad-capacity-planner";
import { squadCapacity } from "../planning/squad-capacity-planner";
import { buildUnifiedPlanningState, resolveUnifiedDemand } from "../planning/unified-planning";

export type PortfolioSummary = { projects: number; needsEstimation: number; readyForPlanning: number; planned: number; capacityExceptions: number };

export function buildPortfolioSummary(projects: Project[], efforts: ProjectSquadEffort[], quarterPlans: ProjectQuarterPlan[], sprintSchedules: ProjectRoadmapSchedule[], capacityExceptions = 0): PortfolioSummary {
  const active = projects.filter((project) => project.archived_at === null);
  const estimated = new Set(efforts.filter((effort) => effort.archived_at === null).map((effort) => effort.project_id));
  const planned = new Set([
    ...quarterPlans.filter((plan) => plan.archived_at === null).map((plan) => plan.project_id),
    ...sprintSchedules.filter((schedule) => schedule.archived_at === null).map((schedule) => schedule.project_id),
  ]);
  return {
    projects: active.length,
    needsEstimation: active.filter((project) => !estimated.has(project.id)).length,
    readyForPlanning: active.filter((project) => estimated.has(project.id) && !planned.has(project.id)).length,
    planned: active.filter((project) => planned.has(project.id)).length,
    capacityExceptions,
  };
}

export function countConfirmedCapacityExceptions(projects: Project[], squads: Squad[], efforts: ProjectSquadEffort[], schedules: ProjectRoadmapSchedule[], sprints: Sprint[], data: PlannerData) {
  const planning = buildUnifiedPlanningState(projects, squads, efforts, schedules, sprints);
  return planning.squads.reduce((count, squad) => {
    const demand = resolveUnifiedDemand(planning.projects, squad.id, sprints.length), capacity = squadCapacity(data, squad.id, sprints);
    return count + demand.filter((value, index) => value > 0 && (capacity[index] === null || value > capacity[index]!)).length;
  }, 0);
}
