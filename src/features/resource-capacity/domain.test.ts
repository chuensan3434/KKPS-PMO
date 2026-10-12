import { describe, expect, it } from "vitest";
import {
  CAPACITY_CATEGORIES,
  legacyPlanningMapping,
  MANDAY_HOURS,
  personCreateSchema,
  squadAliasCreateSchema,
  squadCreateSchema,
  squadMembershipCreateSchema,
} from "./domain";

describe("shared resource domain validation", () => {
  it("defines stable capacity constants without changing legacy Planning fields", () => {
    expect(MANDAY_HOURS).toBe(8);
    expect(CAPACITY_CATEGORIES).toEqual(["DEV", "QA", "SUPPORT", "SA", "OTHER"]);
    expect(legacyPlanningMapping.testMd).toContain("QA");
  });

  it("normalizes source aliases independently of editable squad names", () => {
    expect(squadAliasCreateSchema.parse({
      squad_id: "00000000-0000-4000-8000-000000000001",
      source_system: "actitime",
      normalized_external_name: "  VANILLA QA  ",
    }).normalized_external_name).toBe("vanilla qa");
  });

  it("rejects invalid master and membership inputs before a database call", () => {
    expect(squadCreateSchema.safeParse({ display_name: "", active: true, display_order: 0 }).success).toBe(false);
    expect(personCreateSchema.safeParse({ display_name: "Person", active: true, employee_key: null, employment_start_date: "2027-02-01", employment_end_date: "2027-01-01", default_daily_hours: 8 }).success).toBe(false);
    expect(squadMembershipCreateSchema.safeParse({ person_id: "bad", squad_id: "bad", effective_from: "2027-01-01", effective_to: null }).success).toBe(false);
  });
});
