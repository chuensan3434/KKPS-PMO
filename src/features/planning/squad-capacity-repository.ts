import type { SupabaseClient } from "@supabase/supabase-js";
import type { AllocationRow, MemberAvailability, PlannerData, PlannerMember, SprintAllocation, WorkType } from "./squad-capacity-planner";

const storageKey = "kkps-pmo:squad-capacity-planner:v1";
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

function initialData(): PlannerData {
  return {
    members: [],
    workTypes: ["Dev", "SA", "App Support", "Tech Debt"].map((display_name, display_order) => ({ id: uuid(), display_name, display_order, archived_at: null })),
    rows: [], allocations: [], availability: [],
  };
}

function readDemo() {
  const raw = window.localStorage.getItem(storageKey);
  if (raw) try { const parsed = JSON.parse(raw) as PlannerData; return { ...parsed, members: parsed.members.map((member) => ({ ...member, default_availability_pct: member.default_availability_pct ?? 100 })) }; } catch { /* Preserve an invalid value for recovery; use a fresh in-memory state. */ }
  const data = initialData();
  window.localStorage.setItem(storageKey, JSON.stringify(data));
  return data;
}
function writeDemo(data: PlannerData) { window.localStorage.setItem(storageKey, JSON.stringify(data)); }

export function createSquadCapacityPlannerRepository(client: SupabaseClient | null, demoMode: boolean) {
  if (demoMode) return {
    async load() { return readDemo(); },
    async addMember(squadId: string, displayName: string) { const data = readDemo(); const duplicate = data.members.some((item) => item.squad_id === squadId && item.active && item.display_name.trim().toLocaleLowerCase() === displayName.trim().toLocaleLowerCase()); if (duplicate) throw new Error("A member with this name already exists in the selected squad."); const record: PlannerMember = { id: uuid(), squad_id: squadId, display_name: displayName.trim(), active: true, default_availability_pct: 100 }; data.members.push(record); writeDemo(data); return record; },
    async renameMember(id: string, displayName: string) { const data = readDemo(); let record!: PlannerMember; data.members = data.members.map((item) => item.id === id ? (record = { ...item, display_name: displayName.trim() }) : item); writeDemo(data); return record; },
    async archiveMember(id: string) { const data = readDemo(); let record!: PlannerMember; data.members = data.members.map((item) => item.id === id ? (record = { ...item, active: false }) : item); writeDemo(data); return record; },
    async setDefaultAvailability(id: string, availabilityPct: number) { const data = readDemo(); let record!: PlannerMember; data.members = data.members.map((item) => item.id === id ? (record = { ...item, default_availability_pct: availabilityPct }) : item); writeDemo(data); return record; },
    async addWorkType(displayName: string) { const data = readDemo(); const record: WorkType = { id: uuid(), display_name: displayName.trim(), display_order: data.workTypes.length, archived_at: null }; data.workTypes.push(record); writeDemo(data); return record; },
    async updateWorkType(id: string, changes: Partial<Pick<WorkType, "display_name" | "display_order" | "archived_at">>) { const data = readDemo(); let record!: WorkType; data.workTypes = data.workTypes.map((item) => item.id === id ? (record = { ...item, ...changes }) : item); writeDemo(data); return record; },
    async addRow(squadId: string, memberId: string, workTypeId: string) { const data = readDemo(); if (data.rows.some((item) => item.archived_at === null && item.squad_id === squadId && item.member_id === memberId && item.work_type_id === workTypeId)) throw new Error("This member and Work Type row already exists."); const record: AllocationRow = { id: uuid(), squad_id: squadId, member_id: memberId, work_type_id: workTypeId, archived_at: null }; data.rows.push(record); writeDemo(data); return record; },
    async archiveRow(id: string) { const data = readDemo(); let record!: AllocationRow; data.rows = data.rows.map((item) => item.id === id ? (record = { ...item, archived_at: now() }) : item); writeDemo(data); return record; },
    async setAllocation(rowId: string, sprintId: string, allocationPct: number) { const data = readDemo(); const found = data.allocations.find((item) => item.row_id === rowId && item.sprint_id === sprintId); let record: SprintAllocation; if (found) { record = { ...found, allocation_pct: allocationPct }; data.allocations = data.allocations.map((item) => item.id === found.id ? record : item); } else { record = { id: uuid(), row_id: rowId, sprint_id: sprintId, allocation_pct: allocationPct }; data.allocations.push(record); } writeDemo(data); return record; },
    async setAvailability(memberId: string, sprintId: string, availabilityPct: number) { const data = readDemo(); const found = data.availability.find((item) => item.member_id === memberId && item.sprint_id === sprintId); let record: MemberAvailability; if (found) { record = { ...found, availability_pct: availabilityPct }; data.availability = data.availability.map((item) => item.id === found.id ? record : item); } else { record = { id: uuid(), member_id: memberId, sprint_id: sprintId, availability_pct: availabilityPct }; data.availability.push(record); } writeDemo(data); return record; },
  };
  if (!client) throw new Error("Supabase client is required outside Demo Mode.");
  return {
    async load(): Promise<PlannerData> {
      const [people, memberships, workTypes, rows, allocations, availability] = await Promise.all([
        client.from("people").select("id,display_name,active,default_availability_pct"), client.from("squad_memberships").select("person_id,squad_id,effective_to"),
        client.from("work_types").select("id,display_name,display_order,archived_at").order("display_order"), client.from("allocation_rows").select("id,squad_id,member_id,work_type_id,archived_at"),
        client.from("sprint_allocations").select("id,row_id,sprint_id,allocation_pct"), client.from("member_sprint_availability").select("id,member_id,sprint_id,availability_pct"),
      ]);
      const error = [people, memberships, workTypes, rows, allocations, availability].find((result) => result.error)?.error;
      if (error) throw error;
      const personMap = new Map((people.data ?? []).map((person) => [person.id, person]));
      return {
        members: (memberships.data ?? []).map((membership) => { const person = personMap.get(membership.person_id)!; return { id: membership.person_id, squad_id: membership.squad_id, display_name: person?.display_name ?? "Unknown member", active: Boolean(person?.active && !membership.effective_to), default_availability_pct: person?.default_availability_pct ?? 100 }; }),
        workTypes: (workTypes.data ?? []) as WorkType[], rows: (rows.data ?? []) as AllocationRow[], allocations: (allocations.data ?? []) as SprintAllocation[], availability: (availability.data ?? []) as MemberAvailability[],
      };
    },
    async addMember(squadId: string, displayName: string) { const { data: person, error } = await client.from("people").insert({ display_name: displayName.trim(), active: true, default_daily_hours: 8, default_availability_pct: 100 }).select("id,display_name,active,default_availability_pct").single(); if (error) throw error; const { error: membershipError } = await client.from("squad_memberships").insert({ person_id: person.id, squad_id: squadId, effective_from: new Date().toISOString().slice(0, 10) }); if (membershipError) throw membershipError; return { id: person.id, squad_id: squadId, display_name: person.display_name, active: true, default_availability_pct: 100 } as PlannerMember; },
    async renameMember(id: string, displayName: string) { const { data, error } = await client.from("people").update({ display_name: displayName.trim() }).eq("id", id).select("id,display_name,active").single(); if (error) throw error; return { ...data, squad_id: "" } as PlannerMember; },
    async archiveMember(id: string) { const { data, error } = await client.from("people").update({ active: false }).eq("id", id).select("id,display_name,active").single(); if (error) throw error; return { ...data, squad_id: "" } as PlannerMember; },
    async setDefaultAvailability(id: string, availabilityPct: number) { const { data, error } = await client.from("people").update({ default_availability_pct: availabilityPct }).eq("id", id).select("id,display_name,active,default_availability_pct").single(); if (error) throw error; return { ...data, squad_id: "" } as PlannerMember; },
    async addWorkType(displayName: string) { const { data, error } = await client.from("work_types").insert({ display_name: displayName.trim() }).select().single(); if (error) throw error; return data as WorkType; },
    async updateWorkType(id: string, changes: Partial<Pick<WorkType, "display_name" | "display_order" | "archived_at">>) { const { data, error } = await client.from("work_types").update(changes).eq("id", id).select().single(); if (error) throw error; return data as WorkType; },
    async addRow(squadId: string, memberId: string, workTypeId: string) { const { data, error } = await client.from("allocation_rows").insert({ squad_id: squadId, member_id: memberId, work_type_id: workTypeId }).select().single(); if (error) throw error; return data as AllocationRow; },
    async archiveRow(id: string) { const { data, error } = await client.from("allocation_rows").update({ archived_at: now() }).eq("id", id).select().single(); if (error) throw error; return data as AllocationRow; },
    async setAllocation(rowId: string, sprintId: string, allocationPct: number) { const { data, error } = await client.from("sprint_allocations").upsert({ row_id: rowId, sprint_id: sprintId, allocation_pct: allocationPct }, { onConflict: "row_id,sprint_id" }).select().single(); if (error) throw error; return data as SprintAllocation; },
    async setAvailability(memberId: string, sprintId: string, availabilityPct: number) { const { data, error } = await client.from("member_sprint_availability").upsert({ member_id: memberId, sprint_id: sprintId, availability_pct: availabilityPct }, { onConflict: "member_id,sprint_id" }).select().single(); if (error) throw error; return data as MemberAvailability; },
  };
}
