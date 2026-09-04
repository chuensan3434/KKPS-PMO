export type SquadEffort = {
  squadId: string;
  squadName: string;
  devMd: number;
  testMd: number;
  totalMd: number;
};

export type PlanningProject = {
  id: string;
  name: string;
  businessUnit: string;
  priority?: string;
  category?: string;
  totalEffortMd: number;
  status: "unscheduled" | "scheduled";
  scheduledStartSprint: number | null;
  scheduledEndSprint: number | null;
  squadEffort: SquadEffort[];
};

export type SquadCapacity = { id: string; name: string; capacityMd: number };
export type Sprint = { number: number; start: string; end: string; month: string };

export type PlanningState = {
  year: number;
  sprintOneStart: string;
  projects: PlanningProject[];
  squads: SquadCapacity[];
};

export type RequirementStatus = "not-started" | "in-progress" | "estimated";

export type RequirementSquadEstimate = {
  squadId: string;
  devMd: number | null;
  testMd: number | null;
};

export type PlanningRequirement = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  category?: string;
  status: RequirementStatus;
  estimates: RequirementSquadEstimate[];
};

export type ProjectEstimation = {
  projectId: string;
  requirements: PlanningRequirement[];
};

export type EstimationState = {
  version: 1;
  projects: ProjectEstimation[];
};

export type ProjectEstimationSummary = {
  projectId: string;
  totalDevMd: number;
  totalTestMd: number;
  totalMd: number;
  squadEffort: SquadEffort[];
  readyForPlanning: boolean;
};

export type ProjectSchedule = {
  projectId: string;
  status: "scheduled" | "unscheduled";
  startSprint: number | null;
  endSprint: number | null;
};

export type PlanningScenario = {
  id: string;
  name: string;
  type: "baseline" | "scenario";
  createdAt: string;
  updatedAt: string;
  projectSchedules: Record<string, ProjectSchedule>;
};

export type PlanningScenarioState = {
  version: 1;
  activeScenarioId: string;
  scenarios: PlanningScenario[];
};
