import type { PlanningState } from "./types";

export const defaultPlanningState: PlanningState = {
  year: 2027,
  sprintOneStart: "2027-01-04",
  squads: [
    { id: "alpha", name: "Squad Alpha", capacityMd: 30 },
    { id: "beta", name: "Squad Beta", capacityMd: 25 },
    { id: "gamma", name: "Squad Gamma", capacityMd: 30 },
  ],
  projects: [
    { id: "crm", name: "CRM Enhancement", businessUnit: "B.PWM", priority: "High", category: "Strategic", totalEffortMd: 120, status: "unscheduled", scheduledStartSprint: null, scheduledEndSprint: null, squadEffort: [
      { squadId: "alpha", squadName: "Squad Alpha", devMd: 40, testMd: 20, totalMd: 60 },
      { squadId: "beta", squadName: "Squad Beta", devMd: 25, testMd: 15, totalMd: 40 },
      { squadId: "gamma", squadName: "Squad Gamma", devMd: 15, testMd: 5, totalMd: 20 },
    ] },
    { id: "onboarding", name: "Digital Onboarding", businessUnit: "B.Retail", priority: "High", category: "Growth", totalEffortMd: 80, status: "unscheduled", scheduledStartSprint: null, scheduledEndSprint: null, squadEffort: [
      { squadId: "alpha", squadName: "Squad Alpha", devMd: 30, testMd: 10, totalMd: 40 },
      { squadId: "gamma", squadName: "Squad Gamma", devMd: 25, testMd: 15, totalMd: 40 },
    ] },
    { id: "risk", name: "Risk Reporting Automation", businessUnit: "Risk", priority: "Medium", category: "Compliance", totalEffortMd: 50, status: "unscheduled", scheduledStartSprint: null, scheduledEndSprint: null, squadEffort: [
      { squadId: "beta", squadName: "Squad Beta", devMd: 35, testMd: 15, totalMd: 50 },
    ] },
  ],
};
