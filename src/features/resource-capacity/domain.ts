import { z } from "zod";

const isoDate = z.string().date();
const timestamp = z.string().datetime({ offset: true });
const nonBlank = (maximum: number) => z.string().trim().min(1).max(maximum);

export const squadSchema = z.object({
  id: z.string().uuid(),
  display_name: nonBlank(120),
  active: z.boolean(),
  display_order: z.number().int().nonnegative(),
  created_at: timestamp,
  updated_at: timestamp,
});
export const squadCreateSchema = squadSchema.pick({ display_name: true, active: true, display_order: true });
export const squadUpdateSchema = squadCreateSchema.partial().refine((value) => Object.keys(value).length > 0, "Provide at least one squad change.");

export const squadAliasSchema = z.object({
  id: z.string().uuid(),
  squad_id: z.string().uuid(),
  source_system: nonBlank(80),
  normalized_external_name: nonBlank(160).transform((value) => value.toLocaleLowerCase("en-US")),
  created_at: timestamp,
  updated_at: timestamp,
});
export const squadAliasCreateSchema = squadAliasSchema.pick({ squad_id: true, source_system: true, normalized_external_name: true });

export const personSchema = z.object({
  id: z.string().uuid(),
  employee_key: z.string().trim().min(1).nullable(),
  display_name: nonBlank(160),
  active: z.boolean(),
  employment_start_date: isoDate.nullable(),
  employment_end_date: isoDate.nullable(),
  default_daily_hours: z.coerce.number().positive().max(24),
  created_at: timestamp,
  updated_at: timestamp,
}).refine((value) => !value.employment_start_date || !value.employment_end_date || value.employment_end_date >= value.employment_start_date, {
  message: "Employment end date must not precede the start date.",
  path: ["employment_end_date"],
});
export const personCreateSchema = personSchema.omit({ id: true, created_at: true, updated_at: true }).refine(
  (value) => !value.employment_start_date || !value.employment_end_date || value.employment_end_date >= value.employment_start_date,
  { message: "Employment end date must not precede the start date.", path: ["employment_end_date"] },
);
export const personUpdateSchema = personCreateSchema.partial().refine((value) => Object.keys(value).length > 0, "Provide at least one person change.");

export const squadMembershipSchema = z.object({
  id: z.string().uuid(),
  person_id: z.string().uuid(),
  squad_id: z.string().uuid(),
  effective_from: isoDate,
  effective_to: isoDate.nullable(),
  created_at: timestamp,
  updated_at: timestamp,
}).refine((value) => !value.effective_to || value.effective_to >= value.effective_from, {
  message: "Membership end date must not precede the start date.",
  path: ["effective_to"],
});
export const squadMembershipCreateSchema = squadMembershipSchema.omit({ id: true, created_at: true, updated_at: true }).refine(
  (value) => !value.effective_to || value.effective_to >= value.effective_from,
  { message: "Membership end date must not precede the start date.", path: ["effective_to"] },
);
export const squadMembershipUpdateSchema = squadMembershipCreateSchema.pick({ squad_id: true, effective_from: true, effective_to: true }).partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one membership change.");

export const sprintCalendarSchema = z.object({
  id: z.string().uuid(),
  code: nonBlank(80),
  display_name: nonBlank(160),
  baseline_start_date: isoDate,
  cadence_days: z.literal(14),
  active: z.boolean(),
  created_at: timestamp,
  updated_at: timestamp,
});
export const sprintCalendarCreateSchema = sprintCalendarSchema.omit({ id: true, created_at: true, updated_at: true, cadence_days: true });
export const sprintCalendarUpdateSchema = sprintCalendarCreateSchema.partial().refine((value) => Object.keys(value).length > 0, "Provide at least one calendar change.");

export const sprintSchema = z.object({
  id: z.string().uuid(),
  calendar_id: z.string().uuid(),
  sprint_code: nonBlank(80),
  sequence_number: z.number().int().positive(),
  start_date: isoDate,
  display_end_date: isoDate,
  coverage_end_date: isoDate,
  created_at: timestamp,
  updated_at: timestamp,
});
export const sprintCreateSchema = sprintSchema.omit({ id: true, created_at: true, updated_at: true });
export const sprintUpdateSchema = sprintCreateSchema.partial().refine((value) => Object.keys(value).length > 0, "Provide at least one sprint change.");

export const projectStatusSchema = z.enum(["draft", "active", "on_hold", "completed", "cancelled"]);
export const projectSchema = z.object({
  id: z.string().uuid(),
  project_name: nonBlank(200),
  description: z.string().nullable(),
  status: projectStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  archived_at: timestamp.nullable(),
  created_at: timestamp,
  updated_at: timestamp,
});
export const projectCreateSchema = projectSchema.omit({ id: true, archived_at: true, created_at: true, updated_at: true });
export const projectUpdateSchema = projectCreateSchema.partial().refine((value) => Object.keys(value).length > 0, "Provide at least one project change.");

export type Squad = z.infer<typeof squadSchema>;
export type SquadCreate = z.input<typeof squadCreateSchema>;
export type SquadAlias = z.infer<typeof squadAliasSchema>;
export type SquadAliasCreate = z.input<typeof squadAliasCreateSchema>;
export type Person = z.infer<typeof personSchema>;
export type PersonCreate = z.input<typeof personCreateSchema>;
export type SquadMembership = z.infer<typeof squadMembershipSchema>;
export type SquadMembershipCreate = z.input<typeof squadMembershipCreateSchema>;
export type SprintCalendar = z.infer<typeof sprintCalendarSchema>;
export type SprintCalendarCreate = z.input<typeof sprintCalendarCreateSchema>;
export type Sprint = z.infer<typeof sprintSchema>;
export type SprintCreate = z.input<typeof sprintCreateSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectCreate = z.input<typeof projectCreateSchema>;

export const MANDAY_HOURS = 8 as const;
export const CAPACITY_CATEGORIES = ["DEV", "QA", "SUPPORT", "SA", "OTHER"] as const;

export const legacyPlanningMapping = {
  squadId: "Resolve to squads.id through a reviewed import map; never match by editable display_name alone.",
  squadName: "Preserve as import evidence or create a source alias after an operator confirms the match.",
  sprintIndex: "Resolve with legacy Planning year + index against an approved sprint calendar.",
  testMd: "Map explicitly to future QA demand; retain the original testMd value in the backup payload.",
} as const;
