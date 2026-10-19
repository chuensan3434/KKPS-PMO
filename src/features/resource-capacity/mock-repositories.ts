import { projectCreateSchema, projectRoadmapScheduleCreateSchema, projectRoadmapScheduleUpdateSchema, projectSquadEffortCreateSchema, projectSquadEffortUpdateSchema, projectUpdateSchema, squadCapacityPeriodCreateSchema, squadCapacityPeriodUpdateSchema, squadCreateSchema, squadUpdateSchema, sprintCalendarCreateSchema, sprintCalendarUpdateSchema, sprintCreateSchema, sprintUpdateSchema, type Project, type ProjectRoadmapSchedule, type ProjectSquadEffort, type Sprint, type SprintCalendar, type Squad, type SquadCapacityPeriod } from "./domain";

const storageKey = "kkps-pmo:local-mock-data:v1";
const calendarId = "10000000-0000-4000-8000-000000000001";
const squadIds = ["20000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000002", "20000000-0000-4000-8000-000000000003"];
const projectIds = ["30000000-0000-4000-8000-000000000001", "30000000-0000-4000-8000-000000000002", "30000000-0000-4000-8000-000000000003"];

type MockStore = { squads: Squad[]; projects: Project[]; efforts: ProjectSquadEffort[]; calendars: SprintCalendar[]; sprints: Sprint[]; periods: SquadCapacityPeriod[]; schedules: ProjectRoadmapSchedule[] };
const now = () => new Date().toISOString();

function initialStore(): MockStore {
  const created = now();
  const squads = ["Squad Alpha", "Squad Beta", "Squad Gamma"].map((display_name, index) => ({ id: squadIds[index], display_name, active: true, display_order: index, created_at: created, updated_at: created }));
  const projects = ["CRM Enhancement", "Digital Onboarding", "Risk Reporting Automation"].map((project_name, index) => ({ id: projectIds[index], project_name, description: "Local development mock record", status: "active" as const, metadata: {}, archived_at: null, created_at: created, updated_at: created }));
  const calendars: SprintCalendar[] = [{ id: calendarId, code: "mock-2027", display_name: "Local Mock 2027", baseline_start_date: "2027-01-04", cadence_days: 14, active: true, created_at: created, updated_at: created }];
  const sprints = Array.from({ length: 26 }, (_, index) => {
    const start = new Date("2027-01-04T00:00:00.000Z"); start.setUTCDate(start.getUTCDate() + index * 14);
    const displayEnd = new Date(start); displayEnd.setUTCDate(displayEnd.getUTCDate() + 11);
    const coverageEnd = new Date(start); coverageEnd.setUTCDate(coverageEnd.getUTCDate() + 13);
    return { id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, calendar_id: calendarId, sprint_code: `2027-S${index + 1}`, sequence_number: index + 1, start_date: start.toISOString().slice(0, 10), display_end_date: displayEnd.toISOString().slice(0, 10), coverage_end_date: coverageEnd.toISOString().slice(0, 10), holiday_adjustment_days: 0, created_at: created, updated_at: created };
  });
  return { squads, projects, efforts: [], calendars, sprints, periods: [], schedules: [] };
}

function write(store: MockStore) { window.localStorage.setItem(storageKey, JSON.stringify(store)); }
function read(): MockStore { const value = window.localStorage.getItem(storageKey); if (value) { try { const parsed = JSON.parse(value) as MockStore; return { ...parsed, schedules: parsed.schedules ?? [], sprints: parsed.sprints.map((sprint) => ({ ...sprint, holiday_adjustment_days: sprint.holiday_adjustment_days ?? 0 })) }; } catch {} } const store = initialStore(); write(store); return store; }
function change(mutate: (store: MockStore) => void) { const store = read(); mutate(store); write(store); }
const uuid = () => crypto.randomUUID();

export function createMockSquadRepository() { return {
  async list() { return read().squads.toSorted((a, b) => a.display_order - b.display_order); },
  async create(input: unknown) { const values = squadCreateSchema.parse(input); const record = { id: uuid(), ...values, created_at: now(), updated_at: now() }; change((s) => { s.squads.push(record); }); return record; },
  async update(recordId: string, input: unknown) { const values = squadUpdateSchema.parse(input); let result!: Squad; change((s) => { s.squads = s.squads.map((r) => r.id === recordId ? (result = { ...r, ...values, updated_at: now() }) : r); }); return result; },
  async archive(recordId: string) { return this.update(recordId, { active: false }); },
}; }

export function createMockProjectRepository() { return {
  async list() { return read().projects.toSorted((a, b) => a.project_name.localeCompare(b.project_name)); },
  async create(input: unknown) { const values = projectCreateSchema.parse(input); const record = { id: uuid(), ...values, archived_at: null, created_at: now(), updated_at: now() }; change((s) => { s.projects.push(record); }); return record; },
  async update(recordId: string, input: unknown) { const values = projectUpdateSchema.parse(input); let result!: Project; change((s) => { s.projects = s.projects.map((r) => r.id === recordId ? (result = { ...r, ...values, updated_at: now() }) : r); }); return result; },
  async archive(recordId: string) { let result!: Project; change((s) => { s.projects = s.projects.map((r) => r.id === recordId ? (result = { ...r, archived_at: now(), updated_at: now() }) : r); }); return result; },
}; }

function effortArchive(recordId: string, archived_at: string | null) { let result!: ProjectSquadEffort; change((s) => { s.efforts = s.efforts.map((r) => r.id === recordId ? (result = { ...r, archived_at, updated_at: now() }) : r); }); return result; }
export function createMockEffortRepository() { return {
  async list(projectId?: string) { return read().efforts.filter((r) => !projectId || r.project_id === projectId); },
  async assign(input: unknown) { const values = projectSquadEffortCreateSchema.parse(input); const record = { id: uuid(), ...values, archived_at: null, created_at: now(), updated_at: now() }; change((s) => { s.efforts.push(record); }); return record; },
  async updateEffort(recordId: string, input: unknown) { const values = projectSquadEffortUpdateSchema.parse(input); let result!: ProjectSquadEffort; change((s) => { s.efforts = s.efforts.map((r) => r.id === recordId ? (result = { ...r, ...values, updated_at: now() }) : r); }); return result; },
  async archive(recordId: string) { return effortArchive(recordId, now()); }, async restore(recordId: string) { return effortArchive(recordId, null); },
}; }

export function createMockSprintRepository() { return {
  async listCalendars() { return read().calendars; },
  async createCalendar(input: unknown) { const values = sprintCalendarCreateSchema.parse(input); const record = { id: uuid(), ...values, created_at: now(), updated_at: now() }; change((store) => { store.calendars.push(record); }); return record; },
  async updateCalendar(recordId: string, input: unknown) { const values = sprintCalendarUpdateSchema.parse(input); let result!: SprintCalendar; change((store) => { store.calendars = store.calendars.map((record) => record.id === recordId ? (result = { ...record, ...values, updated_at: now() }) : record); }); return result; },
  async listSprints(id: string) { return read().sprints.filter((r) => r.calendar_id === id).toSorted((a, b) => a.sequence_number - b.sequence_number); },
  async createSprint(input: unknown) { const values = sprintCreateSchema.parse(input); const record = { id: uuid(), ...values, created_at: now(), updated_at: now() }; change((store) => { store.sprints.push(record); }); return record; },
  async updateSprint(recordId: string, input: unknown) { const values = sprintUpdateSchema.parse(input); let result!: Sprint; change((store) => { store.sprints = store.sprints.map((record) => record.id === recordId ? (result = { ...record, ...values, updated_at: now() }) : record); }); return result; },
}; }
export function createMockCapacityRepository() { return {
  async list(id?: string) { return read().periods.filter((r) => !id || r.calendar_id === id); },
  async create(input: unknown) { const values = squadCapacityPeriodCreateSchema.parse(input); const record = { id: uuid(), ...values, archived_at: null, created_at: now(), updated_at: now() }; change((s) => { s.periods.push(record); }); return record; },
  async update(recordId: string, input: unknown) { const values = squadCapacityPeriodUpdateSchema.parse(input); let result!: SquadCapacityPeriod; change((s) => { s.periods = s.periods.map((r) => r.id === recordId ? (result = { ...r, ...values, updated_at: now() }) : r); }); return result; },
  async archive(recordId: string) { let result!: SquadCapacityPeriod; change((s) => { s.periods = s.periods.map((r) => r.id === recordId ? (result = { ...r, archived_at: now(), updated_at: now() }) : r); }); return result; },
}; }

export function createMockScheduleRepository() { return {
  async list(calendarId: string) { return read().schedules.filter((record) => record.calendar_id === calendarId); },
  async create(input: unknown) { const values = projectRoadmapScheduleCreateSchema.parse(input); const record = { id: uuid(), ...values, archived_at: null, created_at: now(), updated_at: now() }; change((store) => { store.schedules.push(record); }); return record; },
  async update(recordId: string, input: unknown) { const values = projectRoadmapScheduleUpdateSchema.parse(input); let result!: ProjectRoadmapSchedule; change((store) => { store.schedules = store.schedules.map((record) => record.id === recordId ? (result = { ...record, ...values, updated_at: now() }) : record); }); return result; },
  async archive(recordId: string) { let result!: ProjectRoadmapSchedule; change((store) => { store.schedules = store.schedules.map((record) => record.id === recordId ? (result = { ...record, archived_at: now(), updated_at: now() }) : record); }); return result; },
}; }
