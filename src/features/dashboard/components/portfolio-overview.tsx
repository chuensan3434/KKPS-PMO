"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { isLocalMockDataMode } from "../../../lib/development-mode";
import type { Project } from "../../resource-capacity/domain";
import { createProjectQuarterPlanRepository, createProjectRepository, createProjectRoadmapScheduleRepository, createProjectSquadEffortRepository, createSquadRepository, createSprintRepository } from "../../resource-capacity/repositories";
import { createSquadCapacityPlannerRepository } from "../../planning/squad-capacity-repository";
import { buildPortfolioSummary, countConfirmedCapacityExceptions, type PortfolioSummary } from "../portfolio-read-model";

const empty: PortfolioSummary = { projects: 0, needsEstimation: 0, readyForPlanning: 0, planned: 0, capacityExceptions: 0 };

export function PortfolioOverview({ mockMode = isLocalMockDataMode }: Readonly<{ mockMode?: boolean }>) {
  const client = useMemo(() => mockMode ? null : createClient(), [mockMode]);
  const [session, setSession] = useState<Session | null>(null), [authReady, setAuthReady] = useState(mockMode), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [summary, setSummary] = useState(empty), [needs, setNeeds] = useState<Project[]>([]), [ready, setReady] = useState<Project[]>([]);
  useEffect(() => { if (mockMode || !client) return; let current = true; const { data: listener } = client.auth.onAuthStateChange((_event, value) => { if (current) { setSession(value); setAuthReady(true); if (!value) setLoading(false); } }); void client.auth.getSession().then(({ data }) => { if (current) { setSession(data.session); setAuthReady(true); if (!data.session) setLoading(false); } }); return () => { current = false; listener.subscription.unsubscribe(); }; }, [client, mockMode]);
  useEffect(() => {
    if (!authReady || (!mockMode && !session)) return;
    let current = true;
    const projectsRepo = createProjectRepository(client, mockMode), effortsRepo = createProjectSquadEffortRepository(client, mockMode), quarterRepo = createProjectQuarterPlanRepository(client, mockMode), sprintRepo = createSprintRepository(client, mockMode), scheduleRepo = createProjectRoadmapScheduleRepository(client, mockMode), squadRepo = createSquadRepository(client, mockMode), capacityRepo = createSquadCapacityPlannerRepository(client, mockMode);
    void Promise.all([projectsRepo.list(), effortsRepo.list(), quarterRepo.list(), sprintRepo.listCalendars(), squadRepo.list(), capacityRepo.load()]).then(async ([projects, efforts, quarterPlans, calendars, squads, capacity]) => {
      const calendarData = await Promise.all(calendars.filter((calendar) => calendar.active).map(async (calendar) => ({ sprints: await sprintRepo.listSprints(calendar.id), schedules: await scheduleRepo.list(calendar.id) })));
      const schedules = calendarData.flatMap((item) => item.schedules);
      const exceptions = calendarData.reduce((sum, item) => sum + countConfirmedCapacityExceptions(projects, squads, efforts, item.schedules, item.sprints, capacity), 0);
      if (!current) return;
      const next = buildPortfolioSummary(projects, efforts, quarterPlans, schedules, exceptions), active = projects.filter((project) => project.archived_at === null), estimated = new Set(efforts.filter((effort) => effort.archived_at === null).map((effort) => effort.project_id)), planned = new Set([...quarterPlans.filter((plan) => plan.archived_at === null).map((plan) => plan.project_id), ...schedules.filter((schedule) => schedule.archived_at === null).map((schedule) => schedule.project_id)]);
      setSummary(next); setNeeds(active.filter((project) => !estimated.has(project.id))); setReady(active.filter((project) => estimated.has(project.id) && !planned.has(project.id)));
    }).catch((caught) => { if (current) setError(caught instanceof Error ? caught.message : "Unable to load the portfolio."); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [authReady, client, mockMode, session]);
  if (!authReady || loading) return <section className="surface p-6 text-sm text-[var(--muted)]">Loading portfolio…</section>;
  if (!mockMode && !session) return <section className="surface p-6"><h2 className="font-extrabold">Sign in to view the portfolio</h2><Link href="/projects" className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-white">Open Projects</Link></section>;
  const metrics = [["Active Projects", summary.projects], ["Needs Estimation", summary.needsEstimation], ["Ready for Planning", summary.readyForPlanning], ["Planned", summary.planned], ["Sprint Capacity Exceptions", summary.capacityExceptions]];
  return <section className="space-y-5" aria-labelledby="portfolio-heading"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--success)]">Canonical portfolio</p><h2 id="portfolio-heading" className="mt-1 text-2xl font-extrabold">Project readiness</h2><p className="mt-1 text-sm text-[var(--muted)]">Derived from Projects, effort estimates, quarter plans, confirmed Sprint schedules, and member capacity.</p></div>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(([label, value]) => <div key={label} className="surface p-4"><p className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--muted)]">{label}</p><p className="mt-2 text-3xl font-extrabold">{value}</p></div>)}</div><div className="grid gap-4 lg:grid-cols-2"><ActionList title="Needs estimation" projects={needs} empty="Every active project has a Squad estimate." /><ActionList title="Ready for planning" projects={ready} empty="No estimated projects are waiting for a plan." /></div></section>;
}

function ActionList({ title, projects, empty }: Readonly<{ title: string; projects: Project[]; empty: string }>) { return <section className="surface p-5"><h3 className="font-extrabold">{title}</h3>{projects.length ? <ul className="mt-3 divide-y divide-[var(--border)]">{projects.slice(0, 6).map((project) => <li key={project.id} className="flex items-center gap-3 py-3"><span className="mr-auto truncate text-sm font-semibold">{project.project_name}</span><Link href={`/projects?project=${project.id}`} className="text-xs font-bold underline">Open</Link></li>)}</ul> : <p className="mt-3 text-sm text-[var(--muted)]">{empty}</p>}</section>; }
