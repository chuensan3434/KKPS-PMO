import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "./domain";
import { ProjectMaster } from "./project-master";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
  }),
}));

vi.mock("./repositories", () => ({
  createProjectRepository: () => ({
    list: mocks.list,
    create: mocks.create,
    update: mocks.update,
    archive: mocks.archive,
  }),
}));

const activeProject: Project = {
  id: "00000000-0000-4000-8000-000000000001",
  project_name: "Alpha",
  description: "Initial project",
  status: "active",
  metadata: {},
  archived_at: null,
  created_at: "2026-10-12T00:00:00.000Z",
  updated_at: "2026-10-12T00:00:00.000Z",
};

const session = { user: { email: "planner@example.com" } };

beforeEach(() => {
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.list.mockResolvedValue([]);
});

describe("Project Master authentication", () => {
  it("shows sign-in without public registration and submits email/password", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const user = userEvent.setup();
    render(<ProjectMaster />);

    await user.type(await screen.findByLabelText("Email"), " planner@example.com ");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "planner@example.com",
      password: "correct horse battery staple",
    });
    expect(screen.queryByRole("button", { name: /sign up/i })).not.toBeInTheDocument();
  });
});

describe("Project Master CRUD", () => {
  it("lists, creates, edits, archives, and views archived projects through the repository", async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    mocks.list.mockResolvedValue([activeProject]);
    const created = { ...activeProject, id: "00000000-0000-4000-8000-000000000002", project_name: "Beta", status: "draft" as const };
    const edited = { ...activeProject, project_name: "Alpha Updated" };
    const archived = { ...edited, archived_at: "2026-10-12T01:00:00.000Z" };
    mocks.create.mockResolvedValue(created);
    mocks.update.mockResolvedValue(edited);
    mocks.archive.mockResolvedValue(archived);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<ProjectMaster />);

    expect(await screen.findByText("Alpha")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Project name"), "Beta");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ project_name: "Beta", description: null, status: "draft", metadata: {} }));
    expect(await screen.findByText("Beta")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    await user.clear(screen.getByLabelText("Project name"));
    await user.type(screen.getByLabelText("Project name"), "Alpha Updated");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(activeProject.id, {
      project_name: "Alpha Updated",
      description: "Initial project",
      status: "active",
    }));

    await user.click(screen.getAllByRole("button", { name: "Archive" })[0]);
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledWith(activeProject.id));
    expect(screen.queryByText("Alpha Updated")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View archived projects" }));
    expect(screen.getByText("Alpha Updated")).toBeInTheDocument();
  });
});
