import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { importMockProjectsWithEfforts } from "../resource-capacity/mock-repositories";

const resultSchema = z.object({ created_projects: z.number().int().nonnegative(), created_efforts: z.number().int().nonnegative(), skipped_projects: z.number().int().nonnegative() });
export type ProjectImportPayload = Parameters<typeof importMockProjectsWithEfforts>[0];

export function createProjectImportRepository(client: SupabaseClient | null, mockMode: boolean) {
  return {
    async import(payload: ProjectImportPayload) {
      if (mockMode) return resultSchema.parse(importMockProjectsWithEfforts(payload));
      if (!client) throw new Error("Supabase client is required outside Demo Mode.");
      const { data, error } = await client.rpc("import_projects_with_efforts", { payload });
      if (error) throw new Error(`Import projects failed: ${error.message}`);
      return resultSchema.parse(data);
    },
  };
}
