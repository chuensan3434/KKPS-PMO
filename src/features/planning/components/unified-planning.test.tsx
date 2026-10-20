import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnifiedPlanning } from "./unified-planning";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  projectList: vi.fn(),
  squadList: vi.fn(),
  effortList: vi.fn(),
  calendarList: vi.fn(),
  sprintList: vi.fn(),
  scheduleList: vi.fn(),
}));

vi.mock("../../../lib/supabase/client", () => ({
  createClient: mocks.createClient,
}));

vi.mock("../../resource-capacity/repositories", () => ({
  createProjectRepository: () => ({ list: mocks.projectList }),
  createSquadRepository: () => ({ list: mocks.squadList }),
  createProjectSquadEffortRepository: () => ({ list: mocks.effortList }),
  createSprintRepository: () => ({ listCalendars: mocks.calendarList, listSprints: mocks.sprintList }),
  createProjectRoadmapScheduleRepository: () => ({ list: mocks.scheduleList }),
}));

const session = { access_token: "test", user: { id: "10000000-0000-4000-8000-000000000001" } };
const calendar = { id: "20000000-0000-4000-8000-000000000001", code: "test-2027", display_name: "Test 2027", baseline_start_date: "2027-01-04", cadence_days: 14, active: true, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" };
const sprints = Array.from({ length: 26 }, (_, index) => {
  const start = new Date("2027-01-04T00:00:00.000Z"); start.setUTCDate(start.getUTCDate() + index * 14);
  const displayEnd = new Date(start); displayEnd.setUTCDate(displayEnd.getUTCDate() + 11);
  const coverageEnd = new Date(start); coverageEnd.setUTCDate(coverageEnd.getUTCDate() + 13);
  return { id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, calendar_id: calendar.id, sprint_code: `2027-S${index + 1}`, sequence_number: index + 1, start_date: start.toISOString().slice(0, 10), display_end_date: displayEnd.toISOString().slice(0, 10), coverage_end_date: coverageEnd.toISOString().slice(0, 10), created_at: calendar.created_at, updated_at: calendar.updated_at };
});

describe("UnifiedPlanning loading recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.createClient.mockReturnValue({ auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange } });
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    mocks.projectList.mockResolvedValue([]);
    mocks.squadList.mockResolvedValue([]);
    mocks.effortList.mockResolvedValue([]);
    mocks.calendarList.mockResolvedValue([]);
    mocks.sprintList.mockResolvedValue([]);
    mocks.scheduleList.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows a clear sign-in state when no Supabase session exists", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<UnifiedPlanning mockMode={false} />);
    expect(await screen.findByRole("heading", { name: "Supabase session required" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry authentication" })).toBeInTheDocument();
  });

  it("loads Demo Mode without constructing a Supabase client or checking auth", async () => {
    render(<UnifiedPlanning mockMode />);
    expect(await screen.findByRole("heading", { name: "Planning" })).toBeInTheDocument();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.onAuthStateChange).not.toHaveBeenCalled();
    expect(screen.queryByText(/Supabase session required/)).not.toBeInTheDocument();
  });

  it("explains a missing Roadmap schedule table", async () => {
    localStorage.setItem("kkps-pmo:unified-planning-calendar:v1", calendar.id);
    mocks.calendarList.mockResolvedValue([calendar]);
    mocks.sprintList.mockResolvedValue(sprints);
    mocks.scheduleList.mockRejectedValueOnce(new Error("PGRST205: Could not find public.project_roadmap_schedules in the schema cache"));
    render(<UnifiedPlanning mockMode={false} />);
    expect(await screen.findByText(/Phase 2C\.1 project_roadmap_schedules migration/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mocks.scheduleList).toHaveBeenCalledTimes(2));
    expect(mocks.projectList).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "Annual Sprint Timeline" })).toBeInTheDocument();
  });

  it("recovers after a repository request fails and is retried", async () => {
    mocks.projectList.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<UnifiedPlanning mockMode={false} />);
    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mocks.projectList).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("heading", { name: "Planning" })).toBeInTheDocument();
  });

  it("leaves loading and shows a retry after an unresolved repository request", async () => {
    vi.useFakeTimers();
    mocks.projectList.mockReturnValue(new Promise(() => undefined));
    render(<UnifiedPlanning mockMode={false} />);
    await act(async () => {
      for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
    });
    expect(mocks.projectList).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByText(/Loading Planning data timed out/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
