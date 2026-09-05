import type { PlanningProject } from "./types";

export type PackedProject = { project: PlanningProject; lane: number };

export function getSprintDuration(startSprint: number, endSprint: number) {
  return Math.max(1, endSprint - startSprint + 1);
}

export function clampSprintRange(start: number, end: number, sprintCount: number) {
  const safeStart = Math.max(1, Math.min(sprintCount, Math.round(start)));
  const safeEnd = Math.max(safeStart, Math.min(sprintCount, Math.round(end)));
  return { start: safeStart, end: safeEnd };
}

export function moveProjectSchedule(project: PlanningProject, targetStart: number, sprintCount: number) {
  const duration = Math.max(1, (project.scheduledEndSprint ?? targetStart) - (project.scheduledStartSprint ?? targetStart) + 1);
  const start = Math.max(1, Math.min(sprintCount - duration + 1, Math.round(targetStart)));
  return { scheduledStartSprint: start, scheduledEndSprint: Math.min(sprintCount, start + duration - 1) };
}

export function resizeProjectSchedule(project: PlanningProject, targetEnd: number, sprintCount: number) {
  const start = project.scheduledStartSprint ?? 1;
  const range = clampSprintRange(start, targetEnd, sprintCount);
  return { scheduledStartSprint: range.start, scheduledEndSprint: range.end };
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart <= bEnd && bStart <= aEnd;
}

export function packProjectsIntoLanes(projects: PlanningProject[]): PackedProject[] {
  const sorted = [...projects].filter((project) => project.scheduledStartSprint !== null && project.scheduledEndSprint !== null).sort((a, b) => (a.scheduledStartSprint! - b.scheduledStartSprint!) || (a.scheduledEndSprint! - b.scheduledEndSprint!) || a.id.localeCompare(b.id));
  const laneEnds: number[] = [];
  return sorted.map((project) => {
    const lane = laneEnds.findIndex((end) => end < project.scheduledStartSprint!);
    const assignedLane = lane === -1 ? laneEnds.length : lane;
    laneEnds[assignedLane] = project.scheduledEndSprint!;
    return { project, lane: assignedLane };
  });
}
