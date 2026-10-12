import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, ProjectSquadEffort, Squad } from "./domain";
import { EffortPlanning, SquadManagement } from "./effort-planning";

const mocks = vi.hoisted(() => ({
  projectList: vi.fn(),
  squadList: vi.fn(),
  squadCreate: vi.fn(),
  squadUpdate: vi.fn(),
  squadArchive: vi.fn(),
  effortList: vi.fn(),
  effortAssign: vi.fn(),
  effortUpdate: vi.fn(),
  effortArchive: vi.fn(),
  effortRestore: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("./repositories", () => ({
  createProjectRepository: () => ({ list: mocks.projectList }),
  createSquadRepository: () => ({ list: mocks.squadList, create: mocks.squadCreate, update: mocks.squadUpdate, archive: mocks.squadArchive }),
  createProjectSquadEffortRepository: () => ({ list: mocks.effortList, assign: mocks.effortAssign, updateEffort: mocks.effortUpdate, archive: mocks.effortArchive, restore: mocks.effortRestore }),
}));

const project: Project = {
  id: "00000000-0000-4000-8000-000000000001", project_name: "Alpha", description: null, status: "active", metadata: {}, archived_at: null,
  created_at: "2026-10-12T00:00:00.000Z", updated_at: "2026-10-12T00:00:00.000Z",
};
const squads: Squad[] = [
  { id: "00000000-0000-4000-8000-000000000011", display_name: "Vanilla", active: true, display_order: 0, created_at: "2026-10-12T00:00:00.000Z", updated_at: "2026-10-12T00:00:00.000Z" },
  { id: "00000000-0000-4000-8000-000000000012", display_name: "Chocolate", active: true, display_order: 1, created_at: "2026-10-12T00:00:00.000Z", updated_at: "2026-10-12T00:00:00.000Z" },
];
const efforts: ProjectSquadEffort[] = squads.map((squad, index) => ({
  id: `00000000-0000-4000-8000-00000000002${index + 1}`,
  project_id: project.id,
  squad_id: squad.id,
  dev_md: index === 0 ? 10 : 6,
  qa_md: index === 0 ? 4 : 2,
  archived_at: null,
  created_at: "2026-10-12T00:00:00.000Z",
  updated_at: "2026-10-12T00:00:00.000Z",
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.projectList.mockResolvedValue([project]);
  mocks.squadList.mockResolvedValue(squads);
  mocks.effortList.mockResolvedValue(efforts);
});

afterEach(cleanup);

describe("Effort Planning", () => {
  it("calculates multi-squad totals, saves inline effort, and restores preserved history after confirmation", async () => {
    const user = userEvent.setup();
    const archived = { ...efforts[0], archived_at: "2026-10-12T01:00:00.000Z" };
    mocks.effortUpdate.mockResolvedValue({ ...efforts[0], dev_md: 12, qa_md: 4 });
    mocks.effortArchive.mockResolvedValue(archived);
    mocks.effortRestore.mockResolvedValue(efforts[0]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<EffortPlanning />);

    expect(await screen.findByText("Dev 16 · QA 6 · Total 22")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Alpha/ }));

    const devInput = screen.getByLabelText("Vanilla Dev MD");
    await user.clear(devInput);
    await user.type(devInput, "12");
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(mocks.effortUpdate).toHaveBeenCalledWith(efforts[0].id, { dev_md: 12, qa_md: 4 }));

    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    await waitFor(() => expect(mocks.effortArchive).toHaveBeenCalledWith(efforts[0].id));
    expect(screen.getByText("Dev 6 · QA 2 · Total 8")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Squad to add to Alpha"), squads[0].id);
    await user.click(screen.getByRole("button", { name: "Add squad" }));
    expect(window.confirm).toHaveBeenLastCalledWith(expect.stringContaining("Previous Dev MD: 10"));
    expect(window.confirm).toHaveBeenLastCalledWith(expect.stringContaining("Previous QA MD: 4"));
    await waitFor(() => expect(mocks.effortRestore).toHaveBeenCalledWith(efforts[0].id));
    expect(screen.getByText("Dev 16 · QA 6 · Total 22")).toBeInTheDocument();
  });

  it("rejects negative effort before persistence", async () => {
    const user = userEvent.setup();
    render(<EffortPlanning />);
    await user.click(await screen.findByRole("button", { name: /Alpha/ }));
    const devInput = screen.getByLabelText("Vanilla Dev MD");
    await user.clear(devInput);
    await user.type(devInput, "-1");
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("zero or positive");
    expect(mocks.effortUpdate).not.toHaveBeenCalled();
  });
});

describe("Squad Management", () => {
  it("creates and archives squads without deleting them", async () => {
    const user = userEvent.setup();
    const created = { ...squads[0], id: "00000000-0000-4000-8000-000000000013", display_name: "Strawberry", display_order: 2 };
    mocks.squadCreate.mockResolvedValue(created);
    mocks.squadArchive.mockResolvedValue({ ...squads[0], active: false });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<SquadManagement />);

    await user.type(await screen.findByLabelText("New squad name"), "Strawberry");
    await user.click(screen.getByRole("button", { name: "Add squad" }));
    await waitFor(() => expect(mocks.squadCreate).toHaveBeenCalledWith({ display_name: "Strawberry", active: true, display_order: 2 }));
    await user.click(screen.getAllByRole("button", { name: "Archive" })[0]);
    await waitFor(() => expect(mocks.squadArchive).toHaveBeenCalledWith(squads[0].id));
  });
});
