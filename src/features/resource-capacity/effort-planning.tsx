"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import type { Project, ProjectSquadEffort, Squad } from "./domain";
import { createProjectRepository, createProjectSquadEffortRepository, createSquadRepository } from "./repositories";

type EffortDraft = { dev_md: string; qa_md: string };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function formatMd(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function SquadManagement({ mockMode = false }: Readonly<{ mockMode?: boolean }>) {
  const client = useMemo(() => createClient(), []);
  const repository = useMemo(() => createSquadRepository(client, mockMode), [client, mockMode]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    let current = true;
    void repository.list().then((records) => {
      if (current) setSquads(records);
    }).catch((reason: unknown) => {
      if (current) setError(errorMessage(reason));
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [repository]);

  const activeCount = squads.filter((squad) => squad.active).length;
  const visibleSquads = squads.filter((squad) => showArchived ? !squad.active : squad.active);

  async function createSquad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = name.trim();
    if (!displayName) return setError("Squad name is required.");
    if (activeCount >= 15) return setError("At most 15 squads may be active.");
    const usedOrders = new Set(squads.filter((squad) => squad.active).map((squad) => squad.display_order));
    const displayOrder = Array.from({ length: 15 }, (_, index) => index).find((index) => !usedOrders.has(index));
    if (displayOrder === undefined) return setError("No active squad display position is available.");

    setSaving(true);
    setError("");
    try {
      const created = await repository.create({ display_name: displayName, active: true, display_order: displayOrder });
      setSquads((current) => [...current, created].toSorted((a, b) => a.display_order - b.display_order));
      setName("");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function renameSquad(id: string) {
    const displayName = editingName.trim();
    if (!displayName) return setError("Squad name is required.");
    setSaving(true);
    setError("");
    try {
      const updated = await repository.update(id, { display_name: displayName });
      setSquads((current) => current.map((squad) => squad.id === updated.id ? updated : squad));
      setEditingId(null);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function archiveSquad(squad: Squad) {
    if (!window.confirm(`Archive ${squad.display_name}? Its effort assignments will remain in history and leave active totals.`)) return;
    setSaving(true);
    setError("");
    try {
      const archived = await repository.archive(squad.id);
      setSquads((current) => current.map((item) => item.id === archived.id ? archived : item));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="squad-management-heading" className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 id="squad-management-heading" className="text-xl font-semibold text-slate-950">Squad Management</h2>
        <p className="mt-1 text-sm text-slate-600">{activeCount} of 15 active squads</p>
        <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={createSquad}>
          <label className="sr-only" htmlFor="new-squad-name">New squad name</label>
          <input id="new-squad-name" className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3" maxLength={120} placeholder="New squad name" value={name} onChange={(event) => setName(event.target.value)} />
          <button type="submit" disabled={saving || activeCount >= 15} className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50">Add squad</button>
          <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700" onClick={() => setShowArchived((value) => !value)}>{showArchived ? "View active" : "View archived"}</button>
        </form>
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      </div>
      {loading ? <p className="p-5 text-sm text-slate-500">Loading squads…</p> : null}
      {!loading && visibleSquads.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No {showArchived ? "archived" : "active"} squads.</p> : null}
      {!loading && visibleSquads.length > 0 ? (
        <ul className="divide-y divide-slate-200">
          {visibleSquads.map((squad) => (
            <li key={squad.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              {editingId === squad.id ? (
                <input aria-label={`Rename ${squad.display_name}`} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3" maxLength={120} value={editingName} onChange={(event) => setEditingName(event.target.value)} />
              ) : <span className="font-medium text-slate-900">{squad.display_name}</span>}
              {squad.active ? (
                <div className="flex gap-2">
                  {editingId === squad.id ? (
                    <>
                      <button type="button" disabled={saving} className="min-h-11 rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white" onClick={() => void renameSquad(squad.id)}>Save</button>
                      <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold" onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold" onClick={() => { setEditingId(squad.id); setEditingName(squad.display_name); }}>Rename</button>
                      <button type="button" disabled={saving} className="min-h-11 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700" onClick={() => void archiveSquad(squad)}>Archive</button>
                    </>
                  )}
                </div>
              ) : <span className="text-sm text-slate-500">Archived</span>}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function EffortPlanning({ mockMode = false }: Readonly<{ mockMode?: boolean }>) {
  const client = useMemo(() => createClient(), []);
  const projectRepository = useMemo(() => createProjectRepository(client, mockMode), [client, mockMode]);
  const squadRepository = useMemo(() => createSquadRepository(client, mockMode), [client, mockMode]);
  const effortRepository = useMemo(() => createProjectSquadEffortRepository(client, mockMode), [client, mockMode]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [efforts, setEfforts] = useState<ProjectSquadEffort[]>([]);
  const [drafts, setDrafts] = useState<Record<string, EffortDraft>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedSquad, setSelectedSquad] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let current = true;
    Promise.all([projectRepository.list(), squadRepository.list(), effortRepository.list()]).then(([projectRows, squadRows, effortRows]) => {
      if (!current) return;
      setProjects(projectRows);
      setSquads(squadRows);
      setEfforts(effortRows);
      setDrafts(Object.fromEntries(effortRows.map((effort) => [effort.id, { dev_md: String(effort.dev_md), qa_md: String(effort.qa_md) }])));
    }).catch((reason: unknown) => {
      if (current) setError(errorMessage(reason));
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [effortRepository, projectRepository, squadRepository]);

  const squadById = new Map(squads.map((squad) => [squad.id, squad]));
  const activeProjects = projects.filter((project) => project.archived_at === null);

  function replaceEffort(saved: ProjectSquadEffort) {
    setEfforts((current) => current.map((effort) => effort.id === saved.id ? saved : effort));
    setDrafts((current) => ({ ...current, [saved.id]: { dev_md: String(saved.dev_md), qa_md: String(saved.qa_md) } }));
  }

  async function saveEffort(effort: ProjectSquadEffort) {
    const draft = drafts[effort.id];
    const devMd = Number(draft?.dev_md);
    const qaMd = Number(draft?.qa_md);
    if (!Number.isFinite(devMd) || !Number.isFinite(qaMd) || devMd < 0 || qaMd < 0) return setError("Dev MD and QA MD must be zero or positive numbers.");
    setSavingId(effort.id); setError(""); setMessage("");
    try {
      replaceEffort(await effortRepository.updateEffort(effort.id, { dev_md: devMd, qa_md: qaMd }));
      setMessage("Effort saved.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSavingId(null); }
  }

  async function addOrRestore(project: Project) {
    const squadId = selectedSquad[project.id];
    if (!squadId) return setError("Select a squad to add.");
    const prior = efforts.find((effort) => effort.project_id === project.id && effort.squad_id === squadId);
    const squad = squadById.get(squadId);
    if (!squad) return setError("The selected squad is unavailable.");
    setError(""); setMessage("");
    try {
      if (prior) {
        const confirmed = window.confirm(`Restore ${squad.display_name} to ${project.project_name}?\n\nPrevious Dev MD: ${formatMd(prior.dev_md)}\nPrevious QA MD: ${formatMd(prior.qa_md)}\nPrevious total: ${formatMd(prior.dev_md + prior.qa_md)}`);
        if (!confirmed) return;
        setSavingId(prior.id);
        replaceEffort(await effortRepository.restore(prior.id));
        setMessage("Assignment restored with its previous effort values.");
      } else {
        setSavingId(`${project.id}:${squadId}`);
        const created = await effortRepository.assign({ project_id: project.id, squad_id: squadId, dev_md: 0, qa_md: 0 });
        setEfforts((current) => [...current, created]);
        setDrafts((current) => ({ ...current, [created.id]: { dev_md: "0", qa_md: "0" } }));
        setMessage("Squad assigned. Enter effort and save the row.");
      }
      setSelectedSquad((current) => ({ ...current, [project.id]: "" }));
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSavingId(null); }
  }

  async function removeAssignment(effort: ProjectSquadEffort, project: Project) {
    const squad = squadById.get(effort.squad_id);
    if (!squad || !window.confirm(`Remove ${squad.display_name} from ${project.project_name}? The saved effort will remain available for restoration.`)) return;
    setSavingId(effort.id); setError(""); setMessage("");
    try {
      replaceEffort(await effortRepository.archive(effort.id));
      setMessage("Assignment removed from active totals and retained in history.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSavingId(null); }
  }

  if (loading) return <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading effort planning…</p>;

  return (
    <section aria-labelledby="effort-planning-heading" className="space-y-4">
      <div>
        <h2 id="effort-planning-heading" className="text-xl font-semibold text-slate-950">Project–Squad Effort</h2>
        <p className="mt-1 text-sm text-slate-600">Expand a project to assign squads and maintain Dev and QA mandays.</p>
      </div>
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      <p aria-live="polite" className="text-sm text-green-700">{message}</p>
      {activeProjects.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Create an active project before assigning squad effort.</p> : null}
      {activeProjects.map((project) => {
        const projectEfforts = efforts.filter((effort) => effort.project_id === project.id);
        const active = projectEfforts.filter((effort) => effort.archived_at === null && squadById.get(effort.squad_id)?.active);
        const archived = projectEfforts.filter((effort) => effort.archived_at !== null);
        const totalDev = active.reduce((sum, effort) => sum + effort.dev_md, 0);
        const totalQa = active.reduce((sum, effort) => sum + effort.qa_md, 0);
        const isExpanded = expanded.has(project.id);
        const availableSquads = squads.filter((squad) => squad.active && !active.some((effort) => effort.squad_id === squad.id));
        return (
          <article key={project.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button type="button" aria-expanded={isExpanded} aria-controls={`effort-${project.id}`} className="flex min-h-16 w-full flex-col gap-2 p-5 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(project.id)) next.delete(project.id); else next.add(project.id); return next; })}>
              <span className="font-semibold text-slate-950">{isExpanded ? "▾" : "▸"} {project.project_name}</span>
              <span className="text-sm text-slate-600">Dev {formatMd(totalDev)} · QA {formatMd(totalQa)} · Total {formatMd(totalDev + totalQa)}</span>
            </button>
            {isExpanded ? (
              <div id={`effort-${project.id}`} className="border-t border-slate-200 p-4 sm:p-5">
                {active.length === 0 ? <p className="mb-4 text-sm text-slate-500">No active squad assignments.</p> : (
                  <div className="mb-5 overflow-x-auto">
                    <table className="w-full min-w-[42rem] text-sm">
                      <thead><tr className="text-left text-slate-500"><th className="pb-2">Squad</th><th className="pb-2">Dev MD</th><th className="pb-2">QA MD</th><th className="pb-2 text-right">Total</th><th className="pb-2 text-right">Actions</th></tr></thead>
                      <tbody className="divide-y divide-slate-200">
                        {active.map((effort) => {
                          const squad = squadById.get(effort.squad_id);
                          const draft = drafts[effort.id] ?? { dev_md: String(effort.dev_md), qa_md: String(effort.qa_md) };
                          const draftTotal = Math.max(0, Number(draft.dev_md) || 0) + Math.max(0, Number(draft.qa_md) || 0);
                          return <tr key={effort.id}>
                            <td className="py-3 font-medium text-slate-900">{squad?.display_name ?? "Unknown squad"}</td>
                            <td className="py-3 pr-3"><input aria-label={`${squad?.display_name} Dev MD`} type="number" min="0" step="0.25" className="min-h-11 w-28 rounded-lg border border-slate-300 px-3 text-right" value={draft.dev_md} onChange={(event) => setDrafts((current) => ({ ...current, [effort.id]: { ...draft, dev_md: event.target.value } }))} /></td>
                            <td className="py-3 pr-3"><input aria-label={`${squad?.display_name} QA MD`} type="number" min="0" step="0.25" className="min-h-11 w-28 rounded-lg border border-slate-300 px-3 text-right" value={draft.qa_md} onChange={(event) => setDrafts((current) => ({ ...current, [effort.id]: { ...draft, qa_md: event.target.value } }))} /></td>
                            <td className="py-3 text-right font-semibold">{formatMd(draftTotal)}</td>
                            <td className="py-3 text-right"><div className="flex justify-end gap-2"><button type="button" disabled={savingId === effort.id} className="min-h-11 rounded-lg bg-blue-700 px-3 font-semibold text-white disabled:opacity-50" onClick={() => void saveEffort(effort)}>Save</button><button type="button" disabled={savingId === effort.id} className="min-h-11 rounded-lg border border-red-200 px-3 font-semibold text-red-700" onClick={() => void removeAssignment(effort, project)}>Remove</button></div></td>
                          </tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="sr-only" htmlFor={`add-squad-${project.id}`}>Squad to add to {project.project_name}</label>
                  <select id={`add-squad-${project.id}`} className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3" value={selectedSquad[project.id] ?? ""} onChange={(event) => setSelectedSquad((current) => ({ ...current, [project.id]: event.target.value }))}>
                    <option value="">Select squad…</option>
                    {availableSquads.map((squad) => {
                      const prior = archived.find((effort) => effort.squad_id === squad.id);
                      return <option key={squad.id} value={squad.id}>{squad.display_name}{prior ? ` — restore Dev ${formatMd(prior.dev_md)}, QA ${formatMd(prior.qa_md)}` : ""}</option>;
                    })}
                  </select>
                  <button type="button" className="min-h-11 rounded-lg border border-blue-700 px-4 text-sm font-semibold text-blue-700" onClick={() => void addOrRestore(project)}>Add squad</button>
                </div>
                {archived.length > 0 ? <p className="mt-3 text-xs text-slate-500">{archived.length} historical assignment{archived.length === 1 ? "" : "s"} retained. Active squads can be restored from the selector.</p> : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
