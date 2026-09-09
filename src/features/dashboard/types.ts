export type WorkEntry = {
  customer: string;
  project: string;
  task: string;
  typeOfWork: string;
  date: string;
  user: string;
  sourceGroup: string;
  person: string;
  squad: string | null;
  role: string;
  hours: number;
  comments: string;
};

export type WorkFilters = {
  dateFrom: string;
  dateTo: string;
  customer: string;
  project: string;
  task: string;
  sourceGroup: string;
  squad: string;
  role: string;
  person: string;
};

export type WorkFilterOptions = {
  customer: string[];
  project: string[];
  task: string[];
  sourceGroup: string[];
  squad: string[];
  role: string[];
  person: string[];
};

export type SummaryItem = {
  label: string;
  hours: number;
};

export type WorkSummary = {
  totalHours: number;
  byCustomer: SummaryItem[];
  byProject: SummaryItem[];
  byTask: SummaryItem[];
  byRole: SummaryItem[];
  bySourceGroup: SummaryItem[];
  bySquad: SummaryItem[];
  byPerson: SummaryItem[];
};

export type EffortShare = {
  label: string;
  hours: number;
  percentage: number;
};

export type CustomerPortfolioItem = {
  customer: string;
  hours: number;
  percentage: number;
  projectCount: number;
  projects: EffortShare[];
};

export type ProjectAnalysis = {
  key: string;
  customer: string;
  project: string;
  totalHours: number;
  roles: EffortShare[];
  tasks: EffortShare[];
};

export type ServiceArea = "app" | "infra" | "unmapped";
export type WorkType = "project" | "support";

export type ResourcePortfolioRow = {
  customer: string;
  projectHours: number;
  supportHours: number;
  totalHours: number;
  projectMandays: number;
  supportMandays: number;
  totalMandays: number;
  projectPct: number;
  supportPct: number;
  totalPct: number;
};

export type ResourcePortfolioArea = {
  serviceArea: ServiceArea;
  projectHours: number;
  supportHours: number;
  totalHours: number;
  rows: ResourcePortfolioRow[];
};

export type ResourcePortfolio = {
  totalHours: number;
  departments: EffortShare[];
  app: ResourcePortfolioArea;
  infra: ResourcePortfolioArea;
  unmapped: ResourcePortfolioArea;
};
