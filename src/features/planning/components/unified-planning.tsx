"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import type { Project, ProjectRoadmapSchedule, ProjectSquadEffort, Sprint, SprintCalendar, Squad } from "../../resource-capacity/domain";
import { createProjectRepository, createProjectRoadmapScheduleRepository, createProjectSquadEffortRepository, createSquadRepository, createSprintRepository } from "../../resource-capacity/repositories";
import { loadSelectedCalendarId, saveSelectedCalendarId } from "../calendar-selection-storage";
import { validateSharedSprintCalendar } from "../capacity-periods";
import { defaultEstimationState } from "../estimation-data";
import { loadEstimationState, saveEstimationState } from "../estimation-storage";
import { loadPlanningState } from "../planning-storage";
import { scheduleProject, setProjectEndSprint, setProjectStartSprint } from "../roadmap-actions";
import { formatSprintRange } from "../planning-utils";
import { getSprintDuration, moveProjectSchedule, packProjectsIntoLanes, resizeProjectSchedule } from "../timeline-utils";
import type { EstimationState, PlanningProject } from "../types";
import { buildUnifiedPlanningState } from "../unified-planning";
import { CapacityPlanning } from "./capacity-planning";
import { EffortEstimation } from "./effort-estimation";
import { SprintCalendarSetup } from "./sprint-calendar-setup";
import { RoadmapCapacityTimeline } from "./roadmap-capacity-timeline";

const sprintWidth = 112;
const requestTimeoutMs = 10_000;

function messageFrom(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "Something went wrong.";
  if (message.includes("PGRST205") || message.includes("42P01") || message.includes("project_roadmap_schedules")) {
    return "Roadmap schedule storage is unavailable. Confirm that the Phase 2C.1 project_roadmap_schedules migration is applied to this Supabase environment.";
  }
  if (message.includes("401") || message.toLowerCase().includes("jwt")) return "Your Supabase session is no longer valid. Sign in again from Projects.";
  if (message.includes("403") || message.toLowerCase().includes("permission denied")) return "Your Supabase session does not have permission to load Planning data.";
  return message;
}

function withTimeout<T>(request: Promise<T>, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`${label} timed out. Check the network connection and try again.`)), requestTimeoutMs);
    request.then(resolve, reject).finally(() => window.clearTimeout(timeout));
  });
}

export function UnifiedPlanning({ mockMode }: Readonly<{ mockMode: boolean }>) {
  const client = useMemo(() => mockMode ? null : createClient(), [mockMode]);
  const projectRepository = useMemo(() => createProjectRepository(client, mockMode), [client, mockMode]);
  const squadRepository = useMemo(() => createSquadRepository(client, mockMode), [client, mockMode]);
  const effortRepository = useMemo(() => createProjectSquadEffortRepository(client, mockMode), [client, mockMode]);
  const sprintRepository = useMemo(() => createSprintRepository(client, mockMode), [client, mockMode]);
  const scheduleRepository = useMemo(() => createProjectRoadmapScheduleRepository(client, mockMode), [client, mockMode]);
  const [session, setSession] = useState<Session | null>(null);
  const [accessReady, setAccessReady] = useState(mockMode);
  const [projects, setProjects] = useState<Project[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [efforts, setEfforts] = useState<ProjectSquadEffort[]>([]);
  const [calendars, setCalendars] = useState<SprintCalendar[]>([]);
  const [calendarId, setCalendarId] = useState("");
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [schedules, setSchedules] = useState<ProjectRoadmapSchedule[]>([]);
  const [view, setView] = useState<"roadmap" | "estimation" | "capacity">("roadmap");
  const [loading, setLoading] = useState(!mockMode);
  const [authAttempt, setAuthAttempt] = useState(0);
  const [dataAttempt, setDataAttempt] = useState(0);
  const [calendarAttempt, setCalendarAttempt] = useState(0);
  const [errorScope, setErrorScope] = useState<"data" | "calendar">("data");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [dropSprint, setDropSprint] = useState<number | null>(null);
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const [legacyPlanning] = useState(() => typeof window === "undefined" ? { year: 2027, sprintOneStart: "2027-01-04", squads: [], projects: [] } : loadPlanningState());
  const [legacyEstimation, setLegacyEstimation] = useState<EstimationState>(() => typeof window === "undefined" ? defaultEstimationState : loadEstimationState(legacyPlanning.projects));

  useEffect(() => {
    if (mockMode) return;
    if (!client) return;
    let mounted = true;
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => { if (mounted) { setSession(next); setAccessReady(true); if (!next) setLoading(false); } });
    void withTimeout(client.auth.getSession(), "Supabase authentication")
      .then(({ data, error: authError }) => {
        if (authError) throw authError;
        if (mounted) setSession(data.session);
      })
      .catch((caught) => { if (mounted) { setSession(null); setError(messageFrom(caught)); } })
      .finally(() => { if (mounted) { setAccessReady(true); setLoading(false); } });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [authAttempt, client, mockMode]);

  useEffect(() => {
    if (!accessReady || (!mockMode && !session)) return;
    let current = true;
    async function loadRepositoryData() {
      await Promise.resolve();
      if (!current) return;
      setLoading(true); setError(""); setErrorScope("data");
      try {
        const [nextProjects, nextSquads, nextEfforts, nextCalendars] = await withTimeout(Promise.all([projectRepository.list(), squadRepository.list(), effortRepository.list(), sprintRepository.listCalendars()]), "Loading Planning data");
        if (!current) return;
        setProjects(nextProjects); setSquads(nextSquads); setEfforts(nextEfforts); setCalendars(nextCalendars.filter((calendar) => calendar.active));
        const stored = loadSelectedCalendarId();
        if (stored && nextCalendars.some((calendar) => calendar.id === stored && calendar.active)) setCalendarId(stored);
      } catch (caught) { if (current) setError(messageFrom(caught)); }
      finally { if (current) setLoading(false); }
    }
    void loadRepositoryData();
    return () => { current = false; };
  }, [accessReady, dataAttempt, effortRepository, mockMode, projectRepository, session, sprintRepository, squadRepository]);

  useEffect(() => {
    if (!calendarId) return;
    let current = true;
    const calendar = calendars.find((item) => item.id === calendarId);
    async function loadCalendarData() {
      await Promise.resolve();
      if (!current) return;
      setLoading(true); setError(""); setErrorScope("calendar");
      try {
        const [nextSprints, nextSchedules] = await withTimeout(Promise.all([sprintRepository.listSprints(calendarId), scheduleRepository.list(calendarId)]), "Loading the selected Sprint calendar");
        if (!current || !calendar) return;
        const validation = validateSharedSprintCalendar(calendar, nextSprints);
        if (validation) throw new Error(validation);
        setSprints(nextSprints); setSchedules(nextSchedules); saveSelectedCalendarId(calendarId);
      } catch (caught) { if (current) { setSprints([]); setSchedules([]); setError(messageFrom(caught)); } }
      finally { if (current) setLoading(false); }
    }
    void loadCalendarData();
    return () => { current = false; };
  }, [calendarAttempt, calendarId, calendars, scheduleRepository, sprintRepository]);

  const planning = useMemo(() => buildUnifiedPlanningState(projects, squads, efforts, schedules, sprints), [efforts, projects, schedules, sprints, squads]);
  const backlog = planning.projects.filter((project) => project.status === "unscheduled");
  const scheduled = planning.projects.filter((project) => project.status === "scheduled");
  const selected = planning.projects.find((project) => project.id === selectedId) ?? null;
  const packedProjects = useMemo(() => packProjectsIntoLanes(scheduled), [scheduled]);
  const laneCount = Math.max(1, ...packedProjects.map((item) => item.lane + 1));

  async function selectCalendar(nextId: string) {
    if (calendarId && nextId !== calendarId && schedules.some((schedule) => schedule.archived_at === null) && !window.confirm("Switch calendars? Existing schedules will remain saved on the current calendar and will not be moved.")) return;
    setCalendarId(nextId); setSchedules([]); setSprints([]); setSelectedId(null);
  }

  async function persistRange(project: PlanningProject, start_sprint: number, end_sprint: number) {
    if (!calendarId) { setError("Select a compatible Sprint calendar before scheduling."); return; }
    const existing = schedules.find((schedule) => schedule.project_id === project.id && schedule.calendar_id === calendarId && schedule.archived_at === null);
    setSaving(true); setError("");
    try {
      const saved = existing ? await scheduleRepository.update(existing.id, { start_sprint, end_sprint }) : await scheduleRepository.create({ project_id: project.id, calendar_id: calendarId, start_sprint, end_sprint });
      setSchedules((current) => existing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
      setSelectedId(project.id);
    } catch (caught) { setErrorScope("calendar"); setError(messageFrom(caught)); } finally { setSaving(false); }
  }

  async function schedule(project: PlanningProject, start: number) { const next = scheduleProject(project, start, sprints.length); await persistRange(project, next.scheduledStartSprint!, next.scheduledEndSprint!); }
  async function unschedule(project: PlanningProject) {
    const existing = schedules.find((item) => item.project_id === project.id && item.calendar_id === calendarId && item.archived_at === null);
    if (!existing) return;
    setSaving(true); setError("");
    try { const archived = await scheduleRepository.archive(existing.id); setSchedules((current) => current.map((item) => item.id === archived.id ? archived : item)); setSelectedId(null); }
    catch (caught) { setErrorScope("calendar"); setError(messageFrom(caught)); } finally { setSaving(false); }
  }
  function sprintFromPointer(clientX: number) { const rect = timelineBodyRef.current?.getBoundingClientRect(); return rect ? Math.max(1, Math.min(sprints.length, Math.floor((clientX - rect.left) / sprintWidth) + 1)) : null; }
  async function dropOnSprint(event: React.DragEvent, sprint: number) { event.preventDefault(); event.stopPropagation(); const resizeId = event.dataTransfer.getData("text/resize-project-id"); const moveId = event.dataTransfer.getData("text/project-id"); const project = planning.projects.find((item) => item.id === (resizeId || moveId)); if (!project) return; const range = resizeId ? resizeProjectSchedule(project, sprint, sprints.length) : project.status === "scheduled" ? moveProjectSchedule(project, sprint, sprints.length) : scheduleProject(project, sprint, sprints.length); await persistRange(project, range.scheduledStartSprint!, range.scheduledEndSprint!); setDraggingId(null); setResizingId(null); setDropSprint(null); }

  function changeLegacyEstimation(next: EstimationState) { setLegacyEstimation(next); saveEstimationState(next); }

  if (loading && projects.length === 0 && !error) return <div className="px-4 py-12 text-sm text-slate-500">Loading unified planning workspace…</div>;
  if (!mockMode && accessReady && !session) return <div className="px-4 py-12"><h1 className="text-2xl font-bold">Supabase session required</h1><p role="alert" className="mt-2 text-slate-600">{error || "Sign in from Projects before opening unified Planning."}</p><button onClick={() => { setError(""); setAccessReady(false); setLoading(true); setAuthAttempt((current) => current + 1); }} className="mt-4 rounded-md border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700">Retry authentication</button></div>;

  return <div className="w-full px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <header className="border-b border-slate-200 pb-6"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">KKPS PMO</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Roadmap Planning</h1><p className="mt-3 text-base text-slate-600">Projects, Squads, shared Sprint dates, member capacity, and demand use stable identities.</p></header>
    {error && <div role="alert" className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span className="mr-auto">{error}</span><button onClick={() => { setError(""); if (errorScope === "calendar") setCalendarAttempt((current) => current + 1); else setDataAttempt((current) => current + 1); }} className="rounded-md border border-red-300 bg-white px-3 py-1.5 font-semibold">Retry</button></div>}
    <section className="mt-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mr-auto"><h2 className="font-semibold text-slate-950">Planning calendar</h2><p className="mt-1 text-xs text-slate-500">The selected calendar is shared by Roadmap and Squad Capacity Planner.</p></div><label className="text-sm font-medium text-slate-700">Sprint calendar<select aria-label="Sprint calendar" value={calendarId} onChange={(event) => void selectCalendar(event.target.value)} className="mt-1 block h-10 min-w-56 rounded-lg border border-slate-300 px-3"><option value="">Select a calendar</option>{calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.display_name} · {calendar.baseline_start_date}</option>)}</select></label>{calendarId && sprints.length > 0 && <p className="text-sm font-semibold text-emerald-700">Compatible · {sprints.length} Sprints</p>}</section>
    {view === "roadmap" && <SprintCalendarSetup repository={sprintRepository} schedules={schedules.filter((item) => item.archived_at === null).length} capacityPeriods={0} onCreated={(calendar, createdSprints) => { setCalendars((value) => [...value, calendar]); setCalendarId(calendar.id); setSprints(createdSprints); setSchedules([]); }} />}
    <div className="mt-6 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">{(["roadmap", "estimation", "capacity"] as const).map((tab) => <button key={tab} onClick={() => setView(tab)} aria-pressed={view === tab} className={`rounded-md px-4 py-2 text-sm font-semibold ${view === tab ? "bg-blue-700 text-white" : "text-slate-600"}`}>{tab === "roadmap" ? "Roadmap" : tab === "estimation" ? "Effort Estimation" : "Squad Capacity Planner"}</button>)}</div>
    {view === "estimation" && <div className="mt-6"><p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Legacy estimation is kept separate and does not contribute to unified Roadmap demand.</p><EffortEstimation projects={legacyPlanning.projects} squads={legacyPlanning.squads} estimation={legacyEstimation} selectedProjectId={null} onSelectProject={() => undefined} onChange={changeLegacyEstimation} /></div>}
    {view === "capacity" && <CapacityPlanning planning={planning} calendarId={calendarId} mockMode={mockMode} />}
    {view === "roadmap" && <>
      {!calendarId && <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Select a compatible Sprint calendar to schedule projects. Active projects are already listed below.</p>}
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)]"><section onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData("text/project-id"); const project = planning.projects.find((item) => item.id === id); if (project?.status === "scheduled") void unschedule(project); }} className="rounded-xl border border-slate-200 bg-slate-100 p-4"><h2 className="font-semibold">Unscheduled backlog</h2><p className="mt-1 text-xs text-slate-500">{backlog.length} active Project Master record{backlog.length === 1 ? "" : "s"}</p><div className="mt-4 min-h-28 space-y-3">{backlog.map((project) => <article key={project.id} draggable onDragStart={(event) => { event.dataTransfer.setData("text/project-id", project.id); setDraggingId(project.id); }} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><h3 className="text-sm font-semibold">{project.name}</h3><p className="mt-1 text-xs text-slate-600">{project.totalEffortMd} MD · {project.squadEffort.length} squad{project.squadEffort.length === 1 ? "" : "s"}</p><button disabled={!calendarId || saving} onClick={() => void schedule(project, 1)} className="mt-3 w-full rounded-md border border-blue-200 px-2 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-50">Schedule in S1</button></article>)}</div></section>
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-4"><h2 className="font-semibold">Annual sprint timeline</h2><p className="mt-1 text-xs text-slate-500">Drag, move, or resize projects on whole-Sprint boundaries.</p></div><div className="overflow-x-auto"><div className="relative" style={{ minWidth: Math.max(1, sprints.length) * sprintWidth }}><div className="flex border-b border-slate-200">{sprints.map((sprint) => <div key={sprint.id} onDragOver={(event) => { event.preventDefault(); setDropSprint(sprint.sequence_number); }} onDrop={(event) => void dropOnSprint(event, sprint.sequence_number)} className={`shrink-0 border-r border-slate-200 px-2 py-3 text-center ${dropSprint === sprint.sequence_number ? "bg-blue-200" : ""}`} style={{ width: sprintWidth }}><p className="text-xs font-bold">S{sprint.sequence_number}</p><p className="mt-1 text-[11px] text-slate-500">{formatSprintRange({ number: sprint.sequence_number, start: sprint.start_date, end: sprint.display_end_date, month: "" })}</p></div>)}</div><div ref={timelineBodyRef} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const sprint = sprintFromPointer(event.clientX); if (sprint) void dropOnSprint(event, sprint); }} className="relative" style={{ minHeight: laneCount * 58 + 32 }}>{packedProjects.map(({ project, lane }) => { const start = project.scheduledStartSprint!; const end = project.scheduledEndSprint!; return <div key={project.id} role="button" tabIndex={0} draggable aria-label={`${project.name}, S${start} to S${end}`} onDragStart={(event) => { event.dataTransfer.setData("text/project-id", project.id); setDraggingId(project.id); }} onClick={() => setSelectedId(project.id)} style={{ left: (start - 1) * sprintWidth + 8, top: lane * 58 + 10, width: (end - start + 1) * sprintWidth - 16 }} className={`absolute h-11 rounded-lg border px-3 pr-5 text-left text-xs shadow-sm ${draggingId === project.id ? "opacity-50" : ""} ${selectedId === project.id ? "border-blue-700 bg-blue-700 text-white" : "border-blue-300 bg-blue-50"}`}><span className="block truncate font-semibold">{project.name} · {project.totalEffortMd} MD · {getSprintDuration(start, end)} Sprint{getSprintDuration(start, end) === 1 ? "" : "s"}</span><span role="separator" aria-label={`Resize ${project.name} end sprint`} draggable onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.setData("text/resize-project-id", project.id); setResizingId(project.id); }} className={`absolute inset-y-1 right-0 w-4 cursor-ew-resize border-l ${resizingId === project.id ? "bg-blue-800" : ""}`} /></div>; })}</div></div></div></section></div>
      {selected && <section className="mt-6 rounded-xl border border-blue-200 bg-white p-5"><h2 className="text-lg font-semibold">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.totalEffortMd} MD · S{selected.scheduledStartSprint}–S{selected.scheduledEndSprint} · {getSprintDuration(selected.scheduledStartSprint!, selected.scheduledEndSprint!)} Sprints</p><div className="mt-4 flex flex-wrap gap-3"><label>Start sprint<select value={selected.scheduledStartSprint!} onChange={(event) => { const next = setProjectStartSprint(selected, Number(event.target.value)); void persistRange(selected, next.scheduledStartSprint!, next.scheduledEndSprint!); }} className="ml-2 rounded border p-1">{sprints.map((sprint) => <option key={sprint.id} value={sprint.sequence_number}>S{sprint.sequence_number}</option>)}</select></label><label>End sprint<select value={selected.scheduledEndSprint!} onChange={(event) => { const next = setProjectEndSprint(selected, Number(event.target.value)); void persistRange(selected, next.scheduledStartSprint!, next.scheduledEndSprint!); }} className="ml-2 rounded border p-1">{sprints.filter((sprint) => sprint.sequence_number >= selected.scheduledStartSprint!).map((sprint) => <option key={sprint.id} value={sprint.sequence_number}>S{sprint.sequence_number}</option>)}</select></label><button onClick={() => void unschedule(selected)} className="rounded border px-3 py-1 text-sm font-semibold">Return to backlog</button></div></section>}
      {calendarId && (
        <RoadmapCapacityTimeline client={client} mockMode={mockMode} squads={squads} sprints={sprints} planning={planning} />
      )}
    </>}
  </div>;
}
