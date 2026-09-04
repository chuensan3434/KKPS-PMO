import { normalizeScenarioState } from "./scenario-utils";
import type { PlanningScenarioState, PlanningState } from "./types";

const storageKey = "kkps-pmo:planning-scenarios:v1";

export function loadScenarioState(planning: PlanningState): PlanningScenarioState {
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return normalizeScenarioState(null, planning);
  try { return normalizeScenarioState(JSON.parse(stored), planning); }
  catch { return normalizeScenarioState(null, planning); }
}

export function saveScenarioState(state: PlanningScenarioState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}
