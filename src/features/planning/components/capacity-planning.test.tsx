import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapacityPlanning } from "./capacity-planning";
import { defaultPlanningState } from "../planning-data";

const calendarId = "00000000-0000-4000-8000-000000000001";
const squadId = "00000000-0000-4000-8000-000000000002";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  squadList: vi.fn(),
  calendarList: vi.fn(),
  sprintList: vi.fn(),
  projectList: vi.fn(),
  effortList: vi.fn(),
}));

vi.mock("../../../lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange } }),
}));

vi.mock("../../resource-capacity/repositories", () => ({
  createSquadRepository: () => ({ list: mocks.squadList }),
  createSprintRepository: () => ({ listCalendars: mocks.calendarList, listSprints: mocks.sprintList }),
  createProjectRepository: () => ({ list: mocks.projectList }),
  createProjectSquadEffortRepository: () => ({ list: mocks.effortList }),
}));

vi.mock("../squad-capacity-repository", () => ({
  createSquadCapacityPlannerRepository: () => ({ load: vi.fn().mockResolvedValue({ members: [], workTypes: [], rows: [], allocations: [], availability: [] }) }),
}));

beforeEach(() => {
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  mocks.getSession.mockResolvedValue({ data: { session: { user: { email: "planner@example.com" } } } });
  mocks.squadList.mockResolvedValue([{ id: squadId, display_name: "Supabase Squad", active: true, display_order: 0, created_at: "2026-10-12T00:00:00.000Z", updated_at: "2026-10-12T00:00:00.000Z" }]);
  mocks.calendarList.mockResolvedValue([{ id: calendarId, code: "kkps-2027", display_name: "KKPS 2027", baseline_start_date: "2027-01-04", cadence_days: 14, active: true, created_at: "2026-10-12T00:00:00.000Z", updated_at: "2026-10-12T00:00:00.000Z" }]);
  mocks.sprintList.mockResolvedValue(Array.from({ length: 26 }, (_, index) => {
    const start = new Date("2027-01-04T00:00:00Z");
    start.setUTCDate(start.getUTCDate() + index * 14);
    const displayEnd = new Date(start); displayEnd.setUTCDate(displayEnd.getUTCDate() + 11);
    const coverageEnd = new Date(start); coverageEnd.setUTCDate(coverageEnd.getUTCDate() + 13);
    return { id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`, calendar_id: calendarId, sprint_code: `2027-S${index + 1}`, sequence_number: index + 1, start_date: start.toISOString().slice(0, 10), display_end_date: displayEnd.toISOString().slice(0, 10), coverage_end_date: coverageEnd.toISOString().slice(0, 10), holiday_adjustment_days: 0, created_at: "2026-10-12T00:00:00.000Z", updated_at: "2026-10-12T00:00:00.000Z" };
  }));
  mocks.projectList.mockResolvedValue([]);
  mocks.effortList.mockResolvedValue([]);
});

describe("unified Capacity Planning", () => {
  it("uses member capacity and removes manual Capacity Period controls", async () => {
    const planning = { ...defaultPlanningState, squads: [{ id: squadId, name: "Supabase Squad", capacityMd: 0 }], projects: [] };
    render(<CapacityPlanning planning={planning} calendarId={calendarId} />);

    expect(screen.queryByText(/identity mapping/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Not Configured — Add Squad Members")).toBeInTheDocument());
    expect(screen.queryByLabelText("MD per Sprint")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Capacity Timeline" })).not.toBeInTheDocument();
  });
});
