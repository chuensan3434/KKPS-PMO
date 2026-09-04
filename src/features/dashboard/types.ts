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
