"use client";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { isLocalMockDataMode } from "../../../lib/development-mode";
import type { PlanningState } from "../types";
import type { Sprint, Squad } from "../../resource-capacity/domain";
import { createSquadRepository, createSprintRepository } from "../../resource-capacity/repositories";
import { SquadCapacityPlanner } from "./squad-capacity-planner";

export function CapacityPlanning({ calendarId = "", mockMode = isLocalMockDataMode }: Readonly<{ planning: PlanningState; calendarId?: string; mockMode?: boolean }>) {
  const supabase = useMemo(() => mockMode ? null : createClient(), [mockMode]);
  const squadRepository = useMemo(() => createSquadRepository(supabase, mockMode), [mockMode, supabase]);
  const sprintRepository = useMemo(() => createSprintRepository(supabase, mockMode), [mockMode, supabase]);
  const [session, setSession] = useState<Session | null>(null), [authReady, setAuthReady] = useState(mockMode), [squads, setSquads] = useState<Squad[]>([]), [sprints, setSprints] = useState<Sprint[]>([]), [error, setError] = useState("");
  useEffect(() => { if (mockMode || !supabase) return; let mounted = true; const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (mounted) { setSession(next); setAuthReady(true); } }); void supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setAuthReady(true); } }); return () => { mounted = false; listener.subscription.unsubscribe(); }; }, [mockMode, supabase]);
  useEffect(() => { if (!mockMode && !session) return; let current = true; void Promise.all([squadRepository.list(), calendarId ? sprintRepository.listSprints(calendarId) : Promise.resolve([])]).then(([nextSquads, nextSprints]) => { if (current) { setSquads(nextSquads); setSprints(nextSprints); } }).catch((caught) => { if (current) setError(caught instanceof Error ? caught.message : "Unable to load capacity planning."); }); return () => { current = false; }; }, [calendarId, mockMode, session, sprintRepository, squadRepository]);
  if (!authReady) return <p className="mt-6 text-sm text-slate-500">Checking the existing Supabase session…</p>;
  if (!mockMode && !session) return <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">Supabase session required</h2><p className="mt-1 text-sm">Squad Capacity Planning uses the authenticated Planning session.</p><Link href="/projects" className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Open Projects to sign in</Link></section>;
  return <div className="mt-6">{error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}<SquadCapacityPlanner client={supabase} mockMode={mockMode} squads={squads} sprints={sprints} calendarName={calendarId ? `Shared calendar ${calendarId.slice(0, 8)}` : ""}/></div>;
}
