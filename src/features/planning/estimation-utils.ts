import type { EstimationState, PlanningProject, PlanningRequirement, PlanningState, ProjectEstimationSummary, SquadCapacity, SquadEffort } from "./types";

function safeMd(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function calculateRequirementTotal(requirement: PlanningRequirement) {
  return requirement.estimates.reduce((total, estimate) => total + (safeMd(estimate.devMd) ?? 0) + (safeMd(estimate.testMd) ?? 0), 0);
}

export function calculateProjectEstimation(projectId: string, requirements: PlanningRequirement[], squads: SquadCapacity[]): ProjectEstimationSummary {
  const projectRequirements = requirements.filter((requirement) => requirement.projectId === projectId);
  const bySquad = new Map<string, SquadEffort>();
  let allValid = projectRequirements.length > 0;
  let estimateCount = 0;

  for (const requirement of projectRequirements) {
    if (requirement.estimates.length === 0) allValid = false;
    for (const estimate of requirement.estimates) {
      estimateCount += 1;
      const devMd = safeMd(estimate.devMd);
      const testMd = safeMd(estimate.testMd);
      if (devMd === null || testMd === null) allValid = false;
      const squad = squads.find((item) => item.id === estimate.squadId);
      if (!squad) { allValid = false; continue; }
      const current = bySquad.get(squad.id) ?? { squadId: squad.id, squadName: squad.name, devMd: 0, testMd: 0, totalMd: 0 };
      current.devMd += devMd ?? 0;
      current.testMd += testMd ?? 0;
      current.totalMd = current.devMd + current.testMd;
      bySquad.set(squad.id, current);
    }
  }

  const squadEffort = [...bySquad.values()];
  const totalDevMd = squadEffort.reduce((total, effort) => total + effort.devMd, 0);
  const totalTestMd = squadEffort.reduce((total, effort) => total + effort.testMd, 0);
  const totalMd = totalDevMd + totalTestMd;
  return { projectId, totalDevMd, totalTestMd, totalMd, squadEffort, readyForPlanning: allValid && estimateCount > 0 && totalMd > 0 };
}

export function estimationStatus(summary: ProjectEstimationSummary, requirements: PlanningRequirement[]) {
  if (summary.readyForPlanning) return "Ready for Planning";
  if (requirements.length === 0) return "Not Started";
  return "In Progress";
}

export function applyEstimationToPlanningProject(project: PlanningProject, summary: ProjectEstimationSummary): PlanningProject {
  return { ...project, totalEffortMd: summary.totalMd, squadEffort: summary.squadEffort };
}

export function integrateEstimation(state: PlanningState, estimation: EstimationState): PlanningState {
  return {
    ...state,
    projects: state.projects.map((project) => {
      const detail = estimation.projects.find((item) => item.projectId === project.id);
      if (!detail) return project;
      const summary = calculateProjectEstimation(project.id, detail.requirements, state.squads);
      return applyEstimationToPlanningProject(project, summary);
    }),
  };
}
