import type { PlanningProject, SquadCapacity } from "./types";

export type CapacityState = "healthy" | "low" | "full" | "over";
export type CapacityIssue = { squadId: string; squadName: string; sprint: number; remainingMd: number; overMd: number };

export function getCapacityState(remainingMd: number, capacityMd: number): CapacityState {
  if (remainingMd < 0) return "over";
  if (remainingMd === 0) return "full";
  if (remainingMd <= capacityMd * 0.2) return "low";
  return "healthy";
}

export function getProjectAllocation(project: PlanningProject, squadId: string) {
  if (!project.scheduledStartSprint || !project.scheduledEndSprint) return 0;
  const effort = project.squadEffort.find((item) => item.squadId === squadId)?.totalMd ?? 0;
  return effort / (project.scheduledEndSprint - project.scheduledStartSprint + 1);
}

export function getProjectsForSquadSprint(projects: PlanningProject[], squadId: string, sprint: number) {
  return projects.flatMap((project) => {
    const active = project.status === "scheduled" && project.scheduledStartSprint !== null && project.scheduledEndSprint !== null && sprint >= project.scheduledStartSprint && sprint <= project.scheduledEndSprint;
    const allocationMd = active ? getProjectAllocation(project, squadId) : 0;
    return allocationMd > 0 ? [{ projectId: project.id, projectName: project.name, allocationMd }] : [];
  });
}

export function getOverCapacityCells(capacity: Record<string, number[]>, squads: SquadCapacity[]) {
  return squads.flatMap((squad) => (capacity[squad.id] ?? []).flatMap((remainingMd, index) => remainingMd < 0 ? [{ squadId: squad.id, squadName: squad.name, sprint: index + 1, remainingMd, overMd: Math.abs(remainingMd) }] : [])).sort((a, b) => b.overMd - a.overMd);
}

export function getPlanningSummary(projects: PlanningProject[], backlogCount: number, issues: CapacityIssue[]) {
  const scheduled = projects.filter((project) => project.status === "scheduled");
  return {
    scheduledProjects: scheduled.length,
    backlogProjects: backlogCount,
    plannedMd: scheduled.reduce((total, project) => total + project.totalEffortMd, 0),
    overloadedCells: issues.length,
    overloadedSquads: new Set(issues.map((issue) => issue.squadId)).size,
  };
}
