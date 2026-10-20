import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, ProjectSquadEffort, Squad } from "../../resource-capacity/domain";
import { buildEffortProjectRows, EffortEstimation, filterAndSortEffortRows } from "./effort-estimation";

const mocks = vi.hoisted(() => ({ update: vi.fn(), assign: vi.fn(), archive: vi.fn(), restore: vi.fn() }));
vi.mock("../../resource-capacity/repositories", () => ({ createProjectSquadEffortRepository: () => ({ updateEffort: mocks.update, assign: mocks.assign, archive: mocks.archive, restore: mocks.restore }) }));

const now = "2026-10-19T00:00:00.000Z";
const projects: Project[] = [
  { id: "10000000-0000-4000-8000-000000000001", project_name: "Alpha", description: null, status: "active", metadata: {}, archived_at: null, created_at: now, updated_at: now },
  { id: "10000000-0000-4000-8000-000000000002", project_name: "Beta", description: null, status: "active", metadata: {}, archived_at: null, created_at: now, updated_at: now },
];
const squads: Squad[] = [
  { id: "20000000-0000-4000-8000-000000000001", display_name: "Squad A", active: true, display_order: 0, created_at: now, updated_at: now },
  { id: "20000000-0000-4000-8000-000000000002", display_name: "Squad B", active: true, display_order: 1, created_at: now, updated_at: now },
];
const efforts: ProjectSquadEffort[] = [
  { id: "30000000-0000-4000-8000-000000000001", project_id: projects[0].id, squad_id: squads[0].id, dev_md: 10.5, qa_md: 0, archived_at: null, created_at: now, updated_at: now },
  { id: "30000000-0000-4000-8000-000000000002", project_id: projects[0].id, squad_id: squads[1].id, dev_md: 0, qa_md: 2.25, archived_at: null, created_at: now, updated_at: now },
  { id: "30000000-0000-4000-8000-000000000003", project_id: projects[1].id, squad_id: squads[0].id, dev_md: 99, qa_md: 99, archived_at: now, created_at: now, updated_at: now },
];

function Harness() {
  const [value, setValue] = useState(efforts);
  return <EffortEstimation client={null} mockMode projects={projects} squads={squads} efforts={value} onEffortsChange={setValue} />;
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("effort project model", () => {
  it("aggregates decimals and zero estimates while excluding archived assignments", () => {
    const rows = buildEffortProjectRows(projects, squads, efforts);
    expect(rows[0]).toMatchObject({ totalDev: 10.5, totalQa: 2.25, total: 12.75 });
    expect(rows[0].efforts).toHaveLength(2);
    expect(rows[1].efforts).toHaveLength(0);
  });

  it("filters without duplication and sorts deterministically", () => {
    const rows = buildEffortProjectRows(projects, squads, efforts);
    expect(filterAndSortEffortRows(rows, "alp", "", "all", "name-asc").map((row) => row.project.id)).toEqual([projects[0].id]);
    expect(filterAndSortEffortRows(rows, "", squads[1].id, "all", "name-asc")).toHaveLength(1);
    expect(filterAndSortEffortRows(rows, "", "", "not-estimated", "effort-desc").map((row) => row.project.id)).toEqual([projects[1].id]);
  });
});

describe("Effort Estimation table", () => {
  it("edits canonical effort, rejects invalid input, and surfaces retry after a save error", async () => {
    const user = userEvent.setup();
    mocks.update.mockRejectedValueOnce(new Error("Temporary save failure")).mockResolvedValueOnce({ ...efforts[0], dev_md: 12.5 });
    render(<Harness />);
    await user.click(screen.getAllByRole("button", { name: /Alpha/ })[0]);
    const input = screen.getByLabelText("Alpha Squad A Dev MD");
    await user.clear(input);
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("zero or a positive number");
    expect(mocks.update).not.toHaveBeenCalled();
    await user.type(input, "12.5");
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mocks.update).toHaveBeenLastCalledWith(efforts[0].id, { dev_md: 12.5, qa_md: 0 }));
    expect(screen.getAllByText("Saved").length).toBeGreaterThan(0);
  });

  it("adds an unused squad and archives an assignment without deleting history", async () => {
    const user = userEvent.setup();
    const betaAssignment = { ...efforts[2], archived_at: null, dev_md: 0, qa_md: 0 };
    mocks.restore.mockResolvedValue(betaAssignment);
    mocks.archive.mockResolvedValue({ ...efforts[0], archived_at: now });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Harness />);
    await user.click(screen.getAllByRole("button", { name: /Beta/ })[0]);
    const detail = screen.getByText(/No active squad assignments/).closest("td")!;
    const selector = within(detail).getByLabelText("Squad to add to Beta");
    await user.selectOptions(selector, squads[0].id);
    await user.click(within(detail).getByRole("button", { name: "+ Add Squad" }));
    await waitFor(() => expect(mocks.restore).toHaveBeenCalledWith(efforts[2].id));
    expect(within(detail).queryByRole("option", { name: /Squad A/ })).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Alpha/ })[0]);
    const alphaEffortRow = screen.getByLabelText("Alpha Squad A Dev MD").closest("tr")!;
    await user.click(within(alphaEffortRow).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledWith(efforts[0].id));
  });
});
