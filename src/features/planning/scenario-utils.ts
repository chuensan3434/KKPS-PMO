import { getOverCapacityCells, getPlanningSummary } from "./decision-utils";
import { remainingCapacity } from "./planning-utils";
import type { PlanningProject, PlanningScenario, PlanningScenarioState, PlanningState, ProjectSchedule } from "./types";

export function schedulesFromProjects(projects: PlanningProject[]): Record<string, ProjectSchedule> {
  return Object.fromEntries(projects.map((project) => [project.id, { projectId: project.id, status: project.status, startSprint: project.scheduledStartSprint, endSprint: project.scheduledEndSprint }]));
}

export function createBaseline(state: PlanningState): PlanningScenario {
  return { id: "baseline", name: "Baseline", type: "baseline", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", projectSchedules: schedulesFromProjects(state.projects) };
}

export function normalizeScenarioState(value: unknown, planning: PlanningState): PlanningScenarioState {
  const candidate = value as Partial<PlanningScenarioState> | null;
  const scenarios = Array.isArray(candidate?.scenarios) ? candidate.scenarios.filter((scenario) => scenario && typeof scenario.id === "string") : [];
  const baseline = scenarios.find((scenario) => scenario.type === "baseline");
  const normalized = baseline ? scenarios.map((scenario) => ({ ...scenario, projectSchedules: { ...schedulesFromProjects(planning.projects), ...scenario.projectSchedules } })) : [createBaseline(planning)];
  const activeScenarioId = normalized.some((scenario) => scenario.id === candidate?.activeScenarioId) ? candidate!.activeScenarioId! : normalized.find((scenario) => scenario.type === "baseline")!.id;
  return { version: 1, activeScenarioId, scenarios: normalized };
}

export function getActiveScenario(state: PlanningScenarioState) {
  return state.scenarios.find((scenario) => scenario.id === state.activeScenarioId) ?? state.scenarios.find((scenario) => scenario.type === "baseline")!;
}

export function applyScenarioSchedules(state: PlanningState, scenario: PlanningScenario): PlanningState {
  return { ...state, projects: state.projects.map((project) => { const schedule = scenario.projectSchedules[project.id]; return schedule ? { ...project, status: schedule.status, scheduledStartSprint: schedule.startSprint, scheduledEndSprint: schedule.endSprint } : project; }) };
}

export function updateScenarioSchedules(state: PlanningScenarioState, scenarioId: string, projects: PlanningProject[]) {
  const updatedAt = new Date().toISOString();
  return { ...state, scenarios: state.scenarios.map((scenario) => scenario.id === scenarioId ? { ...scenario, updatedAt, projectSchedules: schedulesFromProjects(projects) } : scenario) };
}

export function duplicateScenario(state: PlanningScenarioState, sourceId: string) {
  const source = state.scenarios.find((scenario) => scenario.id === sourceId)!;
  const sequence = Math.max(0, ...state.scenarios.map((scenario) => Number(scenario.id.match(/scenario-(\d+)/)?.[1] ?? 0))) + 1;
  const id = `scenario-${sequence}`;
  const now = new Date().toISOString();
  const scenario: PlanningScenario = { ...source, id, name: `Option ${sequence}`, type: "scenario", createdAt: now, updatedAt: now, projectSchedules: structuredClone(source.projectSchedules) };
  return { ...state, activeScenarioId: id, scenarios: [...state.scenarios, scenario] };
}

export function renameScenario(state: PlanningScenarioState, scenarioId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed || state.scenarios.some((scenario) => scenario.id !== scenarioId && scenario.name.toLowerCase() === trimmed.toLowerCase())) return null;
  return { ...state, scenarios: state.scenarios.map((scenario) => scenario.id === scenarioId && scenario.type !== "baseline" ? { ...scenario, name: trimmed, updatedAt: new Date().toISOString() } : scenario) };
}

export function deleteScenario(state: PlanningScenarioState, scenarioId: string) {
  const target = state.scenarios.find((scenario) => scenario.id === scenarioId);
  if (!target || target.type === "baseline") return state;
  const baseline = state.scenarios.find((scenario) => scenario.type === "baseline")!;
  return { ...state, activeScenarioId: state.activeScenarioId === scenarioId ? baseline.id : state.activeScenarioId, scenarios: state.scenarios.filter((scenario) => scenario.id !== scenarioId) };
}

export function promoteScenarioToBaseline(state: PlanningScenarioState, scenarioId: string) {
  const source = state.scenarios.find((scenario) => scenario.id === scenarioId);
  if (!source || source.type === "baseline") return state;
  return { ...state, scenarios: state.scenarios.map((scenario) => scenario.type === "baseline" ? { ...scenario, projectSchedules: structuredClone(source.projectSchedules), updatedAt: new Date().toISOString() } : scenario) };
}

export function scenarioMetrics(planning: PlanningState, scenario: PlanningScenario, readyProjectIds: Set<string>, sprintCount: number) {
  const materialized = applyScenarioSchedules(planning, scenario);
  const capacity = remainingCapacity(materialized.projects, materialized.squads, sprintCount);
  const issues = getOverCapacityCells(capacity, materialized.squads);
  const backlogCount = materialized.projects.filter((project) => project.status === "unscheduled" && readyProjectIds.has(project.id)).length;
  return { materialized, capacity, issues, summary: getPlanningSummary(materialized.projects, backlogCount, issues) };
}

export function compareProjectSchedules(projects: PlanningProject[], left: PlanningScenario, right: PlanningScenario) {
  return projects.flatMap((project) => {
    const a = left.projectSchedules[project.id]; const b = right.projectSchedules[project.id];
    if (!a || !b || (a.status === b.status && a.startSprint === b.startSprint && a.endSprint === b.endSprint)) return [];
    const label = (schedule: ProjectSchedule) => schedule.status === "unscheduled" ? "Backlog" : `S${schedule.startSprint}–S${schedule.endSprint}`;
    const change = a.status === "unscheduled" ? "Newly scheduled" : b.status === "unscheduled" ? "Moved to backlog" : "Moved";
    return [{ projectId: project.id, projectName: project.name, left: label(a), right: label(b), change }];
  });
}
