export type WorkEntry = {
  customer: string;
  project: string;
  task: string;
  typeOfWork: string;
  date: string;
  user: string;
  role: string;
  personName: string;
  hours: number;
  comments: string;
};

export type WorkFilters = {
  dateFrom: string;
  dateTo: string;
  role: string;
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
  byPerson: SummaryItem[];
  byProject: SummaryItem[];
};
