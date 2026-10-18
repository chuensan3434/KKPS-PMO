"use client";

import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { isLocalMockDataMode } from "../../../lib/development-mode";
import type { PlanningState } from "../types";
import type { Sprint, Squad, SquadCapacityPeriod } from "../../resource-capacity/domain";
import { createSquadCapacityPeriodRepository, createSquadRepository, createSprintRepository } from "../../resource-capacity/repositories";
import { capacityVsDemand, findOverlappingPeriod, resolveSprintCapacity, validateCapacityPeriod } from "../capacity-periods";
import { getCapacityState } from "../decision-utils";
import { resolveUnifiedDemand } from "../unified-planning";

type PeriodForm = { squadId: string; startSprint: number; endSprint: number; capacityMd: string; source: "manual" | "override" };
const emptyForm: PeriodForm = { squadId: "", startSprint: 1, endSprint: 1, capacityMd: "", source: "manual" };

function messageFrom(error: unknown) { return error instanceof Error ? error.message : "Something went wrong."; }

export function CapacityPlanning({ planning, calendarId = "", mockMode = isLocalMockDataMode }: Readonly<{ planning: PlanningState; calendarId?: string; mockMode?: boolean }>) {
  const supabase = useMemo(() => mockMode ? null : createClient(), [mockMode]);
  const capacityRepository = useMemo(() => createSquadCapacityPeriodRepository(supabase, mockMode), [mockMode, supabase]);
  const squadRepository = useMemo(() => createSquadRepository(supabase, mockMode), [mockMode, supabase]);
  const sprintRepository = useMemo(() => createSprintRepository(supabase, mockMode), [mockMode, supabase]);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(mockMode);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [periods, setPeriods] = useState<SquadCapacityPeriod[]>([]);
  const [form, setForm] = useState<PeriodForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mockMode) return;
    if (!supabase) return;
    let mounted = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (mounted) { setSession(next); setAuthReady(true); } });
    void supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setAuthReady(true); } });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [mockMode, supabase]);

  useEffect(() => {
    if (!mockMode && !session) return;
    let current = true;
    void Promise.resolve().then(() => {
      if (current) { setLoading(true); setError(""); }
      return squadRepository.list();
    })
      .then((nextSquads) => {
        if (!current) return;
        setSquads(nextSquads);
        setForm((value) => ({ ...value, squadId: value.squadId || nextSquads.find((squad) => squad.active)?.id || "" }));
      })
      .catch((caught) => { if (current) setError(messageFrom(caught)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [mockMode, session, squadRepository]);

  useEffect(() => {
    if ((!mockMode && !session) || !calendarId) return;
    let current = true;
    void Promise.resolve().then(() => {
      if (current) { setLoading(true); setError(""); }
      return Promise.all([sprintRepository.listSprints(calendarId), capacityRepository.list(calendarId)]);
    })
      .then(([nextSprints, nextPeriods]) => { if (current) { setSprints(nextSprints); setPeriods(nextPeriods); } })
      .catch((caught) => { if (current) setError(messageFrom(caught)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [calendarId, capacityRepository, mockMode, session, sprintRepository]);

  function beginEdit(period: SquadCapacityPeriod) {
    setEditingId(period.id);
    setForm({ squadId: period.squad_id, startSprint: period.start_sprint, endSprint: period.end_sprint, capacityMd: String(period.capacity_md), source: period.source === "override" ? "override" : "manual" });
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, squadId: squads.find((squad) => squad.active)?.id ?? "" });
    setError("");
  }

  async function savePeriod(event: FormEvent) {
    event.preventDefault();
    if (!calendarId || !form.squadId) { setError("Choose a calendar and squad."); return; }
    const input = { squad_id: form.squadId, calendar_id: calendarId, start_sprint: form.startSprint, end_sprint: form.endSprint, capacity_md: Number(form.capacityMd) };
    const validation = validateCapacityPeriod(input, sprints.length);
    if (validation) { setError(validation); return; }
    const overlap = findOverlappingPeriod(input, periods, editingId);
    if (overlap) { setError(`This range overlaps S${overlap.start_sprint}–S${overlap.end_sprint}.`); return; }
    setSaving(true);
    setError("");
    try {
      const saved = editingId
        ? await capacityRepository.update(editingId, { start_sprint: input.start_sprint, end_sprint: input.end_sprint, capacity_md: input.capacity_md, source: form.source })
        : await capacityRepository.create({ ...input, source: form.source });
      setPeriods((current) => editingId ? current.map((period) => period.id === saved.id ? saved : period) : [...current, saved]);
      resetForm();
    } catch (caught) { setError(messageFrom(caught)); }
    finally { setSaving(false); }
  }

  async function archivePeriod(period: SquadCapacityPeriod) {
    if (!window.confirm(`Archive capacity period S${period.start_sprint}–S${period.end_sprint}?`)) return;
    try {
      const archived = await capacityRepository.archive(period.id);
      setPeriods((current) => current.map((item) => item.id === archived.id ? archived : item));
      if (editingId === period.id) resetForm();
    } catch (caught) { setError(messageFrom(caught)); }
  }

  if (!authReady) return <p className="mt-6 text-sm text-slate-500">Checking the existing Supabase session…</p>;
  if (!mockMode && !session) return <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold text-amber-950">Supabase session required</h2><p className="mt-1 text-sm text-amber-800">Capacity Periods use the same authenticated session as Project & Effort Planning.</p><Link href="/projects" className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Open Projects to sign in</Link></section>;

  const activePeriods = periods.filter((period) => showArchived ? period.archived_at !== null : period.archived_at === null);

  return <div className="mt-6 space-y-6">
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div><h2 className="font-semibold text-slate-950">Manage Capacity Periods</h2><p className="mt-1 text-sm text-slate-500">Start and End Sprint are inclusive. Zero MD is valid.</p></div><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Show archived</label></div>
      {!calendarId && <p className="border-b border-slate-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">Select and confirm a compatible Sprint calendar before managing Capacity Periods.</p>}
      <form onSubmit={savePeriod} className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"><label className="text-sm font-medium text-slate-700 lg:col-span-2">Squad<select disabled={Boolean(editingId) || !calendarId} value={form.squadId} onChange={(event) => setForm((current) => ({ ...current, squadId: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3"><option value="">Choose squad</option>{squads.filter((squad) => squad.active).map((squad) => <option key={squad.id} value={squad.id}>{squad.display_name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Start Sprint<select disabled={!calendarId} value={form.startSprint} onChange={(event) => setForm((current) => ({ ...current, startSprint: Number(event.target.value) }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3">{sprints.map((sprint) => <option key={sprint.id} value={sprint.sequence_number}>S{sprint.sequence_number}</option>)}</select></label><label className="text-sm font-medium text-slate-700">End Sprint<select disabled={!calendarId} value={form.endSprint} onChange={(event) => setForm((current) => ({ ...current, endSprint: Number(event.target.value) }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3">{sprints.map((sprint) => <option key={sprint.id} value={sprint.sequence_number}>S{sprint.sequence_number}</option>)}</select></label><label className="text-sm font-medium text-slate-700">MD per Sprint<input disabled={!calendarId} aria-label="MD per Sprint" type="number" min="0" step="0.5" required value={form.capacityMd} onChange={(event) => setForm((current) => ({ ...current, capacityMd: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3" /></label><div className="flex gap-2"><button disabled={saving || loading || !calendarId || !sprints.length} className="h-10 flex-1 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : editingId ? "Save" : "Add period"}</button>{editingId && <button type="button" onClick={resetForm} className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700">Cancel</button>}</div></form>
      {activePeriods.length === 0 ? <p className="p-5 text-sm text-slate-500">No {showArchived ? "archived" : "active"} Capacity Periods for this calendar.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Squad</th><th className="px-3 py-3">Range</th><th className="px-3 py-3 text-right">MD / Sprint</th><th className="px-3 py-3">Source</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody>{activePeriods.map((period) => <tr key={period.id} className="border-t border-slate-200"><td className="px-5 py-3 font-medium">{squads.find((squad) => squad.id === period.squad_id)?.display_name ?? period.squad_id}</td><td className="px-3 py-3">S{period.start_sprint}–S{period.end_sprint}</td><td className="px-3 py-3 text-right font-semibold">{period.capacity_md}</td><td className="px-3 py-3">{period.source}</td><td className="px-5 py-3 text-right">{period.archived_at ? <span className="text-slate-500">Archived</span> : <span className="space-x-3"><button onClick={() => beginEdit(period)} className="font-semibold text-blue-700">Edit</button><button onClick={() => void archivePeriod(period)} className="font-semibold text-red-700">Archive</button></span>}</td></tr>)}</tbody></table></div>}
    </section>

    <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="font-semibold text-slate-950">Capacity Timeline</h2><p className="mt-1 text-sm text-slate-500">Active Project–Squad effort is distributed once across each scheduled Project range.</p></div><div className="max-h-[70vh] overflow-auto"><table className="border-collapse text-sm" style={{ minWidth: 240 + sprints.length * 92 }}><thead><tr><th className="sticky left-0 top-0 z-30 w-60 border-b border-r border-slate-200 bg-white p-3 text-left">Squad</th>{sprints.map((sprint) => <th key={sprint.id} className="sticky top-0 z-20 w-[92px] border-b border-r border-slate-200 bg-white p-2 text-center text-xs text-slate-600">S{sprint.sequence_number}</th>)}</tr></thead><tbody>{squads.filter((squad) => squad.active).map((squad) => {
        const capacity = resolveSprintCapacity(periods, squad.id, calendarId, sprints.length);
        const demand = resolveUnifiedDemand(planning.projects, squad.id, sprints.length);
        const cells = capacityVsDemand(capacity, demand);
        return <tr key={squad.id}><th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white p-3 text-left"><span className="block font-semibold text-slate-800">{squad.display_name}</span></th>{cells.map((cell, index) => {
          if (cell.remainingMd === null) return <td key={index} aria-label={`${squad.display_name}, Sprint ${index + 1}: Not Set`} className="border-b border-r border-slate-200 bg-slate-50 p-2 text-center text-xs font-semibold text-slate-500"><span className="block">Not Set</span>{cell.demandMd > 0 && <span className="block text-[10px] text-amber-700">{Number(cell.demandMd.toFixed(1))} MD demand</span>}</td>;
          const status = getCapacityState(cell.remainingMd, cell.capacityMd ?? 0);
          return <td key={index} aria-label={`${squad.display_name}, Sprint ${index + 1}: ${Number(cell.remainingMd.toFixed(1))} MD remaining, ${status}`} className={`border-b border-r border-slate-200 p-1 text-center font-semibold ${status === "over" ? "bg-red-100 text-red-900" : status === "full" ? "bg-slate-200 text-slate-900" : status === "low" ? "bg-amber-100 text-amber-900" : "text-slate-700"}`}><span className="block">{Number(cell.remainingMd.toFixed(1))} MD</span><span className="block text-[10px] uppercase">{status}</span><span className="block text-[10px] font-normal">{Number(cell.demandMd.toFixed(1))} demand</span></td>;
        })}</tr>;
      })}</tbody></table></div></section>
  </div>;
}
