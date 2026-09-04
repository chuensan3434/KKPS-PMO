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
  role: string;
  sourceGroup: string;
  squad: string;
  person: string;
  project: string;
};

export type SummaryItem = {
  label: string;
  hours: number;
};

export type WorkSummary = {
  totalHours: number;
  byRole: SummaryItem[];
  bySourceGroup: SummaryItem[];
  bySquad: SummaryItem[];
  byPerson: SummaryItem[];
  byProject: SummaryItem[];
};
