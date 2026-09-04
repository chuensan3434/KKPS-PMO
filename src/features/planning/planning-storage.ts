import { defaultPlanningState } from "./planning-data";
import type { PlanningState } from "./types";

const storageKey = "kkps-pmo:roadmap-planning:v1";

export function loadPlanningState(): PlanningState {
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return structuredClone(defaultPlanningState);
  try { return JSON.parse(stored) as PlanningState; } catch { return structuredClone(defaultPlanningState); }
}

export function savePlanningState(state: PlanningState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}
