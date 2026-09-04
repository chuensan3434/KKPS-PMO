import { defaultEstimationState } from "./estimation-data";
import type { EstimationState, PlanningProject } from "./types";

const storageKey = "kkps-pmo:effort-estimation:v1";

export function loadEstimationState(projects: PlanningProject[]): EstimationState {
  const stored = window.localStorage.getItem(storageKey);
  let parsed: EstimationState = structuredClone(defaultEstimationState);
  if (stored) {
    try { parsed = JSON.parse(stored) as EstimationState; } catch { /* Retain non-destructive defaults. */ }
  }
  return {
    version: 1,
    projects: projects.map((project) => parsed.projects.find((item) => item.projectId === project.id) ?? { projectId: project.id, requirements: [] }),
  };
}

export function saveEstimationState(state: EstimationState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}
