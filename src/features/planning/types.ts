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
