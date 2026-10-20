import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isLocalMockDataMode } from "../../lib/development-mode";
import { createMockCapacityRepository, createMockEffortRepository, createMockProjectRepository, createMockScheduleRepository, createMockSprintRepository, createMockSquadRepository } from "./mock-repositories";
import {
  personCreateSchema,
  personSchema,
  personUpdateSchema,
  projectCreateSchema,
  projectRoadmapScheduleCreateSchema,
  projectRoadmapScheduleSchema,
  projectRoadmapScheduleUpdateSchema,
  projectSchema,
  projectSquadEffortCreateSchema,
  projectSquadEffortSchema,
  projectSquadEffortUpdateSchema,
  projectUpdateSchema,
  squadAliasCreateSchema,
  squadAliasSchema,
  squadCreateSchema,
  squadCapacityPeriodCreateSchema,
  squadCapacityPeriodSchema,
  squadCapacityPeriodUpdateSchema,
  squadMembershipCreateSchema,
  squadMembershipSchema,
  squadMembershipUpdateSchema,
  squadSchema,
  squadUpdateSchema,
  sprintCalendarCreateSchema,
  sprintCalendarSchema,
  sprintCalendarUpdateSchema,
  sprintCreateSchema,
  sprintSchema,
  sprintUpdateSchema,
} from "./domain";

type RepositoryClient = SupabaseClient;
type MockableRepositoryClient = SupabaseClient | null;

export class ResourceRepositoryError extends Error {
  constructor(operation: string, detail: string) {
    super(`${operation} failed: ${detail}`);
    this.name = "ResourceRepositoryError";
  }
}

function validateInput<T>(operation: string, schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ResourceRepositoryError(operation, result.error.issues.map((issue) => issue.message).join("; "));
  return result.data;
}

function validateId(operation: string, id: string) {
  return validateInput(operation, z.string().uuid("A valid UUID is required."), id);
}

function parseRows<T>(operation: string, schema: z.ZodType<T>, data: unknown): T[] {
  const result = z.array(schema).safeParse(data);
  if (!result.success) throw new ResourceRepositoryError(operation, "The database returned an unexpected record shape.");
  return result.data;
}

function parseRow<T>(operation: string, schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new ResourceRepositoryError(operation, "The database returned an unexpected record shape.");
  return result.data;
}

function databaseError(operation: string, error: { message: string; code?: string } | null) {
  if (error) throw new ResourceRepositoryError(operation, `${error.message}${error.code ? ` (${error.code})` : ""}`);
}

export function createSquadRepository(client: MockableRepositoryClient, useMock = isLocalMockDataMode) {
  if (useMock) return createMockSquadRepository();
  if (!client) throw new ResourceRepositoryError("Create squad repository", "Supabase client is required outside Demo Mode.");
  return {
    async list() {
      const operation = "List squads";
      const { data, error } = await client.from("squads").select("*").order("display_order");
      databaseError(operation, error);
      return parseRows(operation, squadSchema, data);
    },
    async create(input: unknown) {
      const operation = "Create squad";
      const values = validateInput(operation, squadCreateSchema, input);
      const { data, error } = await client.from("squads").insert(values).select().single();
      databaseError(operation, error);
      return parseRow(operation, squadSchema, data);
    },
    async update(id: string, input: unknown) {
      const operation = "Update squad";
      const values = validateInput(operation, squadUpdateSchema, input);
      const { data, error } = await client.from("squads").update(values).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, squadSchema, data);
    },
    async archive(id: string) {
      const operation = "Archive squad";
      const { data, error } = await client.from("squads").update({ active: false }).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, squadSchema, data);
    },
  };
}

export function createSquadAliasRepository(client: RepositoryClient) {
  return {
    async list(squadId?: string) {
      const operation = "List squad aliases";
      let query = client.from("squad_aliases").select("*").order("source_system").order("normalized_external_name");
      if (squadId) query = query.eq("squad_id", validateId(operation, squadId));
      const { data, error } = await query;
      databaseError(operation, error);
      return parseRows(operation, squadAliasSchema, data);
    },
    async create(input: unknown) {
      const operation = "Create squad alias";
      const values = validateInput(operation, squadAliasCreateSchema, input);
      const { data, error } = await client.from("squad_aliases").insert(values).select().single();
      databaseError(operation, error);
      return parseRow(operation, squadAliasSchema, data);
    },
    async remove(id: string) {
      const operation = "Delete squad alias";
      const { error } = await client.from("squad_aliases").delete().eq("id", validateId(operation, id));
      databaseError(operation, error);
    },
  };
}

export function createPeopleRepository(client: RepositoryClient) {
  return {
    async list() {
      const operation = "List people";
      const { data, error } = await client.from("people").select("*").order("display_name");
      databaseError(operation, error);
      return parseRows(operation, personSchema, data);
    },
    async create(input: unknown) {
      const operation = "Create person";
      const values = validateInput(operation, personCreateSchema, input);
      const { data, error } = await client.from("people").insert(values).select().single();
      databaseError(operation, error);
      return parseRow(operation, personSchema, data);
    },
    async update(id: string, input: unknown) {
      const operation = "Update person";
      const values = validateInput(operation, personUpdateSchema, input);
      const { data, error } = await client.from("people").update(values).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, personSchema, data);
    },
  };
}

export function createMembershipRepository(client: RepositoryClient) {
  return {
    async list(personId?: string) {
      const operation = "List squad memberships";
      let query = client.from("squad_memberships").select("*").order("effective_from");
      if (personId) query = query.eq("person_id", validateId(operation, personId));
      const { data, error } = await query;
      databaseError(operation, error);
      return parseRows(operation, squadMembershipSchema, data);
    },
    async create(input: unknown) {
      const operation = "Create squad membership";
      const values = validateInput(operation, squadMembershipCreateSchema, input);
      const { data, error } = await client.from("squad_memberships").insert(values).select().single();
      databaseError(operation, error);
      return parseRow(operation, squadMembershipSchema, data);
    },
    async update(id: string, input: unknown) {
      const operation = "Update squad membership";
      const values = validateInput(operation, squadMembershipUpdateSchema, input);
      const { data, error } = await client.from("squad_memberships").update(values).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, squadMembershipSchema, data);
    },
  };
}

export function createSprintRepository(client: MockableRepositoryClient, useMock = isLocalMockDataMode) {
  if (useMock) return createMockSprintRepository();
  if (!client) throw new ResourceRepositoryError("Create sprint repository", "Supabase client is required outside Demo Mode.");
  return {
    async listCalendars() {
      const operation = "List sprint calendars";
      const { data, error } = await client.from("sprint_calendars").select("*").order("baseline_start_date");
      databaseError(operation, error);
      return parseRows(operation, sprintCalendarSchema, data);
    },
    async createCalendar(input: unknown) {
      const operation = "Create sprint calendar";
      const values = validateInput(operation, sprintCalendarCreateSchema, input);
      const { data, error } = await client.from("sprint_calendars").insert(values).select().single();
      databaseError(operation, error);
      return parseRow(operation, sprintCalendarSchema, data);
    },
    async updateCalendar(id: string, input: unknown) {
      const operation = "Update sprint calendar";
      const values = validateInput(operation, sprintCalendarUpdateSchema, input);
      const { data, error } = await client.from("sprint_calendars").update(values).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, sprintCalendarSchema, data);
    },
    async listSprints(calendarId: string) {
      const operation = "List sprints";
      const { data, error } = await client.from("sprints").select("*").eq("calendar_id", validateId(operation, calendarId)).order("sequence_number");
      databaseError(operation, error);
      return parseRows(operation, sprintSchema, data);
    },
    async createSprint(input: unknown) {
      const operation = "Create sprint";
      const values = validateInput(operation, sprintCreateSchema, input);
      const { data, error } = await client.from("sprints").insert(values).select().single();
      databaseError(operation, error);
      return parseRow(operation, sprintSchema, data);
    },
    async updateSprint(id: string, input: unknown) {
      const operation = "Update sprint";
      const values = validateInput(operation, sprintUpdateSchema, input);
      const { data, error } = await client.from("sprints").update(values).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, sprintSchema, data);
    },
  };
}

export function createProjectRepository(client: MockableRepositoryClient, useMock = isLocalMockDataMode) {
  if (useMock) return createMockProjectRepository();
  if (!client) throw new ResourceRepositoryError("Create project repository", "Supabase client is required outside Demo Mode.");
  return {
    async list() {
      const operation = "List projects";
      const { data, error } = await client.from("projects").select("*").order("project_name");
      databaseError(operation, error);
      return parseRows(operation, projectSchema, data);
    },
    async create(input: unknown) {
      const operation = "Create project";
      const values = validateInput(operation, projectCreateSchema, input);
      const { data, error } = await client.from("projects").insert(values).select().single();
      databaseError(operation, error);
      return parseRow(operation, projectSchema, data);
    },
    async update(id: string, input: unknown) {
      const operation = "Update project";
      const values = validateInput(operation, projectUpdateSchema, input);
      const { data, error } = await client.from("projects").update(values).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, projectSchema, data);
    },
    async archive(id: string) {
      const operation = "Archive project";
      const { data, error } = await client.from("projects").update({ archived_at: new Date().toISOString() }).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, projectSchema, data);
    },
  };
}

export function createProjectSquadEffortRepository(client: MockableRepositoryClient, useMock = isLocalMockDataMode) {
  if (useMock) return createMockEffortRepository();
  if (!client) throw new ResourceRepositoryError("Create effort repository", "Supabase client is required outside Demo Mode.");
  return {
    async list(projectId?: string) {
      const operation = "List project squad efforts";
      let query = client.from("project_squad_efforts").select("*").order("created_at");
      if (projectId) query = query.eq("project_id", validateId(operation, projectId));
      const { data, error } = await query;
      databaseError(operation, error);
      return parseRows(operation, projectSquadEffortSchema, data);
    },
    async assign(input: unknown) {
      const operation = "Assign squad to project";
      const values = validateInput(operation, projectSquadEffortCreateSchema, input);
      const { data, error } = await client.from("project_squad_efforts").insert(values).select().single();
      databaseError(operation, error);
      return parseRow(operation, projectSquadEffortSchema, data);
    },
    async updateEffort(id: string, input: unknown) {
      const operation = "Update project squad effort";
      const values = validateInput(operation, projectSquadEffortUpdateSchema, input);
      const { data, error } = await client.from("project_squad_efforts").update(values).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, projectSquadEffortSchema, data);
    },
    async archive(id: string) {
      const operation = "Archive project squad assignment";
      const { data, error } = await client.from("project_squad_efforts").update({ archived_at: new Date().toISOString() }).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, projectSquadEffortSchema, data);
    },
    async restore(id: string) {
      const operation = "Restore project squad assignment";
      const { data, error } = await client.from("project_squad_efforts").update({ archived_at: null }).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, projectSquadEffortSchema, data);
    },
  };
}

export function createSquadCapacityPeriodRepository(client: MockableRepositoryClient, useMock = isLocalMockDataMode) {
  if (useMock) return createMockCapacityRepository();
  if (!client) throw new ResourceRepositoryError("Create capacity repository", "Supabase client is required outside Demo Mode.");
  return {
    async list(calendarId?: string) {
      const operation = "List capacity periods";
      let query = client.from("squad_capacity_periods").select("*").order("start_sprint");
      if (calendarId) query = query.eq("calendar_id", validateId(operation, calendarId));
      const { data, error } = await query;
      databaseError(operation, error);
      return parseRows(operation, squadCapacityPeriodSchema, data);
    },
    async create(input: unknown) {
      const operation = "Create capacity period";
      const values = validateInput(operation, squadCapacityPeriodCreateSchema, input);
      const { data, error } = await client.from("squad_capacity_periods").insert(values).select().single();
      databaseError(operation, error);
      return parseRow(operation, squadCapacityPeriodSchema, data);
    },
    async update(id: string, input: unknown) {
      const operation = "Update capacity period";
      const values = validateInput(operation, squadCapacityPeriodUpdateSchema, input);
      const { data, error } = await client.from("squad_capacity_periods").update(values).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, squadCapacityPeriodSchema, data);
    },
    async archive(id: string) {
      const operation = "Archive capacity period";
      const { data, error } = await client.from("squad_capacity_periods").update({ archived_at: new Date().toISOString() }).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, squadCapacityPeriodSchema, data);
    },
  };
}

export function createProjectRoadmapScheduleRepository(client: MockableRepositoryClient, useMock = isLocalMockDataMode) {
  if (useMock) return createMockScheduleRepository();
  if (!client) throw new ResourceRepositoryError("Create Roadmap repository", "Supabase client is required outside Demo Mode.");
  return {
    async list(calendarId: string) {
      const operation = "List project Roadmap schedules";
      const { data, error } = await client.from("project_roadmap_schedules").select("*").eq("calendar_id", validateId(operation, calendarId)).order("created_at");
      databaseError(operation, error);
      return parseRows(operation, projectRoadmapScheduleSchema, data);
    },
    async create(input: unknown) {
      const operation = "Create project Roadmap schedule";
      const values = validateInput(operation, projectRoadmapScheduleCreateSchema, input);
      const { data, error } = await client.from("project_roadmap_schedules").insert(values).select().single();
      databaseError(operation, error);
      return parseRow(operation, projectRoadmapScheduleSchema, data);
    },
    async update(id: string, input: unknown) {
      const operation = "Update project Roadmap schedule";
      const values = validateInput(operation, projectRoadmapScheduleUpdateSchema, input);
      const { data, error } = await client.from("project_roadmap_schedules").update(values).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, projectRoadmapScheduleSchema, data);
    },
    async archive(id: string) {
      const operation = "Archive project Roadmap schedule";
      const { data, error } = await client.from("project_roadmap_schedules").update({ archived_at: new Date().toISOString() }).eq("id", validateId(operation, id)).select().single();
      databaseError(operation, error);
      return parseRow(operation, projectRoadmapScheduleSchema, data);
    },
  };
}
