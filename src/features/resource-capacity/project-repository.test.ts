import { describe, expect, it, vi } from "vitest";
import { createProjectRepository } from "./repositories";

const project = {
  id: "00000000-0000-4000-8000-000000000001",
  project_name: "Alpha",
  description: null,
  status: "draft",
  metadata: {},
  archived_at: null,
  created_at: "2026-10-12T00:00:00.000Z",
  updated_at: "2026-10-12T00:00:00.000Z",
};

describe("project repository", () => {
  it("validates and delegates create, update, and archive to Supabase", async () => {
    const single = vi.fn()
      .mockResolvedValueOnce({ data: project, error: null })
      .mockResolvedValueOnce({ data: { ...project, status: "active" }, error: null })
      .mockResolvedValueOnce({ data: { ...project, archived_at: "2026-10-12T01:00:00.000Z" }, error: null });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const insert = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ insert, update })) };
    const repository = createProjectRepository(client as never);

    await expect(repository.create({ project_name: "Alpha", description: null, status: "draft", metadata: {} })).resolves.toEqual(project);
    await expect(repository.update(project.id, { status: "active" })).resolves.toMatchObject({ status: "active" });
    await expect(repository.archive(project.id)).resolves.toMatchObject({ archived_at: "2026-10-12T01:00:00.000Z" });

    expect(insert).toHaveBeenCalledWith({ project_name: "Alpha", description: null, status: "draft", metadata: {} });
    expect(update).toHaveBeenNthCalledWith(1, { status: "active" });
    expect(update).toHaveBeenNthCalledWith(2, { archived_at: expect.any(String) });
    expect(eq).toHaveBeenCalledWith("id", project.id);
  });

  it("rejects invalid project data before issuing a database write", async () => {
    const insert = vi.fn();
    const client = { from: vi.fn(() => ({ insert })) };
    const repository = createProjectRepository(client as never);

    await expect(repository.create({ project_name: "", description: null, status: "draft", metadata: {} })).rejects.toThrow("Create project failed");
    expect(insert).not.toHaveBeenCalled();
  });
});
