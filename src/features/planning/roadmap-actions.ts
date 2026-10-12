import type { PlanningProject } from "./types";

export const defaultScheduleDuration = 2;

export function scheduleProject(
  project: PlanningProject,
  startSprint: number,
  sprintCount: number,
  duration = defaultScheduleDuration,
): PlanningProject {
  return {
    ...project,
    status: "scheduled",
    scheduledStartSprint: startSprint,
    scheduledEndSprint: Math.min(sprintCount, startSprint + duration - 1),
  };
}

export function unscheduleProject(project: PlanningProject): PlanningProject {
  return {
    ...project,
    status: "unscheduled",
    scheduledStartSprint: null,
    scheduledEndSprint: null,
  };
}

export function setProjectStartSprint(project: PlanningProject, startSprint: number): PlanningProject {
  return {
    ...project,
    scheduledStartSprint: startSprint,
    scheduledEndSprint: Math.max(startSprint, project.scheduledEndSprint ?? startSprint),
  };
}

export function setProjectEndSprint(project: PlanningProject, endSprint: number): PlanningProject {
  return { ...project, scheduledEndSprint: endSprint };
}
