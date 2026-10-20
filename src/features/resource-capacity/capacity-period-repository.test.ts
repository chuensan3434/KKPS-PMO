import { describe, expect, it, vi } from "vitest";
import { createSquadCapacityPeriodRepository } from "./repositories";

const period = {
  id: "00000000-0000-4000-8000-000000000001",
  squad_id: "00000000-0000-4000-8000-000000000002",
  calendar_id: "00000000-0000-4000-8000-000000000003",
  start_sprint: 1,
  end_sprint: 4,
  capacity_md: 0,
  source: "manual" as const,
  archived_at: null,
  created_at: "2026-10-12T00:00:00.000Z",
  updated_at: "2026-10-12T00:00:00.000Z",
};

describe("capacity period repository", () => {
  it("loads persisted periods and delegates create, edit, and archive to Supabase", async () => {
    const single = vi.fn()
      .mockResolvedValueOnce({ data: period, error: null })
      .mockResolvedValueOnce({ data: { ...period, capacity_md: 25 }, error: null })
      .mockResolvedValueOnce({ data: { ...period, archived_at: "2026-10-12T01:00:00.000Z" }, error: null });
    const writeSelect = vi.fn(() => ({ single }));
    const writeEq = vi.fn(() => ({ select: writeSelect }));
    const insert = vi.fn(() => ({ select: writeSelect }));
    const update = vi.fn(() => ({ eq: writeEq }));
    const listEq = vi.fn().mockResolvedValue({ data: [period], error: null });
    const order = vi.fn(() => ({ eq: listEq }));
    const client = { from: vi.fn(() => ({ select: vi.fn(() => ({ order })), insert, update })) };
    const repository = createSquadCapacityPeriodRepository(client as never);

    await expect(repository.list(period.calendar_id)).resolves.toEqual([period]);
    await expect(repository.create({ squad_id: period.squad_id, calendar_id: period.calendar_id, start_sprint: 1, end_sprint: 4, capacity_md: 0, source: "manual" })).resolves.toEqual(period);
    await expect(repository.update(period.id, { capacity_md: 25 })).resolves.toMatchObject({ capacity_md: 25 });
    await expect(repository.archive(period.id)).resolves.toMatchObject({ archived_at: expect.any(String) });
    expect(insert).toHaveBeenCalledOnce();
    expect(update).toHaveBeenNthCalledWith(1, { capacity_md: 25 });
    expect(update).toHaveBeenNthCalledWith(2, { archived_at: expect.any(String) });
  });

  it("rejects invalid values before a write", async () => {
    const insert = vi.fn();
    const repository = createSquadCapacityPeriodRepository({ from: vi.fn(() => ({ insert })) } as never);
    await expect(repository.create({ squad_id: period.squad_id, calendar_id: period.calendar_id, start_sprint: 1, end_sprint: 2, capacity_md: Number.POSITIVE_INFINITY, source: "manual" })).rejects.toThrow("Create capacity period failed");
    expect(insert).not.toHaveBeenCalled();
  });
});
