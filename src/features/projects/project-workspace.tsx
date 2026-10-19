"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageContainer } from "../../components/layout/page-container";
import { createClient } from "../../lib/supabase/client";
import { isLocalMockDataMode } from "../../lib/development-mode";
import type { Project, ProjectSquadEffort, Squad } from "../resource-capacity/domain";
import { createProjectRepository, createProjectSquadEffortRepository, createSquadRepository } from "../resource-capacity/repositories";

type ProjectForm = {
  project_name: string;
  description: string;
  business_unit: string;
  owner_name: string;
  target_date: string;
  status: Project["status"];
};

const emptyForm: ProjectForm = { project_name: "", description: "", business_unit: "", owner_name: "", target_date: "", status: "draft" };
const messageFrom = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
const formatMd = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

export function getProjectNextStep(project: Project, efforts: ProjectSquadEffort[]) {
  return efforts.some((effort) => effort.project_id === project.id && effort.archived_at === null) ? "Ready for Planning" : "Needs Estimation";
}

export function ProjectWorkspace({ mockMode = isLocalMockDataMode, initialProjectId = "" }: Readonly<{ mockMode?: boolean; initialProjectId?: string }>) {
  const client = useMemo(() => mockMode ? null : createClient(), [mockMode]);
  const projectRepository = useMemo(() => createProjectRepository(client, mockMode), [client, mockMode]);
  const effortRepository = useMemo(() => createProjectSquadEffortRepository(client, mockMode), [client, mockMode]);
  const squadRepository = useMemo(() => createSquadRepository(client, mockMode), [client, mockMode]);
  const [session, setSession] = useState<Session | null>(null), [authReady, setAuthReady] = useState(mockMode);
  const [projects, setProjects] = useState<Project[]>([]), [squads, setSquads] = useState<Squad[]>([]), [efforts, setEfforts] = useState<ProjectSquadEffort[]>([]);
  const [selectedId, setSelectedId] = useState(initialProjectId), [search, setSearch] = useState(""), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [editing, setEditing] = useState(false), [creating, setCreating] = useState(false), [saving, setSaving] = useState(false), [form, setForm] = useState<ProjectForm>(emptyForm);

  useEffect(() => {
    if (mockMode || !client) return;
    let current = true;
    const { data: listener } = client.auth.onAuthStateChange((_event, value) => { if (current) { setSession(value); setAuthReady(true); if (!value) setLoading(false); } });
    void client.auth.getSession().then(({ data, error: authError }) => { if (!current) return; if (authError) setError(authError.message); setSession(data.session); setAuthReady(true); if (!data.session) setLoading(false); });
    return () => { current = false; listener.subscription.unsubscribe(); };
  }, [client, mockMode]);

  useEffect(() => {
    if (!authReady || (!mockMode && !session)) return;
    let current = true;
    void Promise.all([projectRepository.list(), squadRepository.list(), effortRepository.list()]).then(([nextProjects, nextSquads, nextEfforts]) => {
      if (!current) return;
      setProjects(nextProjects); setSquads(nextSquads); setEfforts(nextEfforts);
      const active = nextProjects.filter((project) => project.archived_at === null);
      setSelectedId((value) => active.some((project) => project.id === value) ? value : active[0]?.id ?? "");
    }).catch((caught) => { if (current) setError(messageFrom(caught)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [authReady, effortRepository, mockMode, projectRepository, session, squadRepository]);

  const activeProjects = projects.filter((project) => project.archived_at === null);
  const visibleProjects = activeProjects.filter((project) => project.project_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const selected = activeProjects.find((project) => project.id === selectedId) ?? null;
  const selectedEfforts = efforts.filter((effort) => effort.project_id === selectedId && effort.archived_at === null);

  function startCreate() { setCreating(true); setEditing(true); setSelectedId(""); setForm(emptyForm); setError(""); }
  function startEdit(project: Project) { setCreating(false); setEditing(true); setForm({ project_name: project.project_name, description: project.description ?? "", business_unit: project.business_unit ?? "", owner_name: project.owner_name ?? "", target_date: project.target_date ?? "", status: project.status }); setError(""); }
  function selectProject(id: string) { setSelectedId(id); setCreating(false); setEditing(false); }

  async function saveProject(event: FormEvent) {
    event.preventDefault();
    if (!form.project_name.trim()) { setError("Project name is required."); return; }
    setSaving(true); setError("");
    const values = { project_name: form.project_name.trim(), description: form.description.trim() || null, business_unit: form.business_unit.trim() || null, owner_name: form.owner_name.trim() || null, target_date: form.target_date || null, status: form.status };
    try {
      const saved = creating ? await projectRepository.create({ ...values, metadata: {} }) : await projectRepository.update(selectedId, values);
      setProjects((current) => creating ? [...current, saved].toSorted((a, b) => a.project_name.localeCompare(b.project_name)) : current.map((project) => project.id === saved.id ? saved : project));
      setSelectedId(saved.id); setCreating(false); setEditing(false);
    } catch (caught) { setError(messageFrom(caught)); } finally { setSaving(false); }
  }

  async function archiveProject() {
    if (!selected || !window.confirm(`Archive ${selected.project_name}? Historical effort will be preserved.`)) return;
    try { const saved = await projectRepository.archive(selected.id); setProjects((current) => current.map((project) => project.id === saved.id ? saved : project)); setSelectedId(activeProjects.find((project) => project.id !== saved.id)?.id ?? ""); }
    catch (caught) { setError(messageFrom(caught)); }
  }

  if (!authReady || loading) return <PageContainer title="Projects" description="Loading the project workspace…" />;
  if (!mockMode && !session) return <SignIn client={client!} error={error} />;

  return <PageContainer eyebrow="Project workflow" title="Projects" description="Create a project, estimate Squad effort, then open it in Planning.">
    <div className="mb-5 flex flex-wrap items-center gap-3"><button type="button" onClick={startCreate} className="min-h-11 rounded-xl bg-[var(--ink)] px-5 text-sm font-bold text-white">New Project</button><p className="text-sm text-[var(--muted)]">Select one project to view its details and effort.</p></div>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="grid min-h-[620px] gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="surface overflow-hidden" aria-label="Project list"><div className="border-b border-[var(--border)] p-4"><label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Search<input aria-label="Search projects" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Project name" className="control mt-2 w-full px-3 text-sm font-medium normal-case tracking-normal" /></label></div><ul className="max-h-[680px] overflow-y-auto">{visibleProjects.map((project) => { const active = project.id === selectedId; return <li key={project.id} className="border-b border-[var(--border)] last:border-0"><button type="button" onClick={() => selectProject(project.id)} aria-current={active ? "true" : undefined} className={`w-full px-4 py-4 text-left ${active ? "bg-[#f5f9d7]" : "hover:bg-[var(--surface-subtle)]"}`}><span className="block font-extrabold text-[var(--ink)]">{project.project_name}</span><span className="mt-1 block text-xs font-semibold text-[var(--muted)]">{getProjectNextStep(project, efforts)}</span></button></li>; })}</ul>{visibleProjects.length === 0 && <p className="p-6 text-center text-sm text-[var(--muted)]">No projects match your search.</p>}</aside>
      <main className="min-w-0">{editing ? <ProjectFormPanel form={form} creating={creating} saving={saving} onChange={setForm} onSubmit={saveProject} onCancel={() => { setEditing(false); setCreating(false); if (!selectedId) setSelectedId(activeProjects[0]?.id ?? ""); }} /> : selected ? <ProjectDetail project={selected} efforts={selectedEfforts} allEfforts={efforts} squads={squads} effortRepository={effortRepository} onEffortsChange={setEfforts} onEdit={() => startEdit(selected)} onArchive={() => void archiveProject()} /> : <section className="surface grid min-h-64 place-items-center p-8 text-center"><div><h2 className="text-xl font-extrabold">Create your first project</h2><p className="mt-2 text-sm text-[var(--muted)]">Project name is the only required field.</p><button onClick={startCreate} className="mt-5 min-h-11 rounded-xl bg-[var(--ink)] px-5 text-sm font-bold text-white">New Project</button></div></section>}</main>
    </div>
  </PageContainer>;
}

function ProjectFormPanel({ form, creating, saving, onChange, onSubmit, onCancel }: Readonly<{ form: ProjectForm; creating: boolean; saving: boolean; onChange: (form: ProjectForm) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void }>) {
  const field = (name: keyof ProjectForm, value: string) => onChange({ ...form, [name]: value });
  return <section className="surface p-5 sm:p-6"><h2 className="text-xl font-extrabold">{creating ? "New Project" : "Edit project"}</h2><form onSubmit={onSubmit} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2 text-sm font-bold">Project name<input required maxLength={200} value={form.project_name} onChange={(event) => field("project_name", event.target.value)} className="control mt-1 w-full px-3 font-medium" /></label><label className="text-sm font-bold">Business unit<input maxLength={120} value={form.business_unit} onChange={(event) => field("business_unit", event.target.value)} className="control mt-1 w-full px-3 font-medium" /></label><label className="text-sm font-bold">PO / Owner<input maxLength={160} value={form.owner_name} onChange={(event) => field("owner_name", event.target.value)} className="control mt-1 w-full px-3 font-medium" /></label><label className="text-sm font-bold">Target date<input type="date" value={form.target_date} onChange={(event) => field("target_date", event.target.value)} className="control mt-1 w-full px-3 font-medium" /></label><label className="text-sm font-bold">Status<select value={form.status} onChange={(event) => field("status", event.target.value)} className="control mt-1 w-full px-3 font-medium"><option value="draft">Draft</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label className="sm:col-span-2 text-sm font-bold">Description<textarea rows={4} value={form.description} onChange={(event) => field("description", event.target.value)} className="control mt-1 w-full p-3 font-medium" /></label><div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={onCancel} className="control min-h-11 px-4 text-sm font-bold">Cancel</button><button disabled={saving} className="min-h-11 rounded-xl bg-[var(--ink)] px-5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save Project"}</button></div></form></section>;
}

type EffortRepository = ReturnType<typeof createProjectSquadEffortRepository>;
function ProjectDetail({ project, efforts, allEfforts, squads, effortRepository, onEffortsChange, onEdit, onArchive }: Readonly<{ project: Project; efforts: ProjectSquadEffort[]; allEfforts: ProjectSquadEffort[]; squads: Squad[]; effortRepository: EffortRepository; onEffortsChange: (value: ProjectSquadEffort[]) => void; onEdit: () => void; onArchive: () => void }>) {
  const [drafts, setDrafts] = useState<Record<string, { dev: string; qa: string }>>({}), [addSquadId, setAddSquadId] = useState(""), [error, setError] = useState(""), [saving, setSaving] = useState("");
  const squadById = new Map(squads.map((squad) => [squad.id, squad])), used = new Set(efforts.map((effort) => effort.squad_id));
  const totalDev = efforts.reduce((sum, effort) => sum + effort.dev_md, 0), totalQa = efforts.reduce((sum, effort) => sum + effort.qa_md, 0);
  async function saveEffort(effort: ProjectSquadEffort) { const draft = drafts[effort.id] ?? { dev: String(effort.dev_md), qa: String(effort.qa_md) }; const dev = Number(draft.dev), qa = Number(draft.qa); if (!draft.dev.trim() || !draft.qa.trim() || dev < 0 || qa < 0 || !Number.isFinite(dev) || !Number.isFinite(qa)) { setError("Enter zero or a positive number for both Dev and QA MD."); return; } setSaving(effort.id); setError(""); try { const saved = await effortRepository.updateEffort(effort.id, { dev_md: dev, qa_md: qa }); onEffortsChange(allEfforts.map((item) => item.id === saved.id ? saved : item)); } catch (caught) { setError(messageFrom(caught)); } finally { setSaving(""); } }
  async function addSquad() { if (!addSquadId) return; setSaving("add"); setError(""); try { const historical = allEfforts.find((item) => item.project_id === project.id && item.squad_id === addSquadId); const saved = historical ? await effortRepository.restore(historical.id) : await effortRepository.assign({ project_id: project.id, squad_id: addSquadId, dev_md: 0, qa_md: 0 }); onEffortsChange(historical ? allEfforts.map((item) => item.id === saved.id ? saved : item) : [...allEfforts, saved]); setAddSquadId(""); } catch (caught) { setError(messageFrom(caught)); } finally { setSaving(""); } }
  async function removeEffort(effort: ProjectSquadEffort) { if (!window.confirm("Remove this Squad assignment? Saved effort remains in history.")) return; const saved = await effortRepository.archive(effort.id); onEffortsChange(allEfforts.map((item) => item.id === saved.id ? saved : item)); }
  return <div className="space-y-5"><section className="surface p-5 sm:p-6"><div className="flex flex-wrap items-start gap-3"><div className="mr-auto"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--success)]">{getProjectNextStep(project, allEfforts)}</p><h2 className="mt-1 text-2xl font-extrabold">{project.project_name}</h2></div><button onClick={onEdit} className="control min-h-10 px-4 text-sm font-bold">Edit</button><button onClick={onArchive} className="min-h-10 rounded-xl px-3 text-sm font-bold text-red-700 hover:bg-red-50">Archive</button></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-xs font-bold uppercase text-[var(--muted)]">Business unit</dt><dd className="mt-1 font-semibold">{project.business_unit || "Not set"}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--muted)]">PO / Owner</dt><dd className="mt-1 font-semibold">{project.owner_name || "Not set"}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--muted)]">Target date</dt><dd className="mt-1 font-semibold">{project.target_date || "Not set"}</dd></div></dl>{project.description && <p className="mt-5 border-t border-[var(--border)] pt-4 text-sm leading-6 text-[var(--muted)]">{project.description}</p>}</section>
    <section className="surface overflow-hidden"><div className="flex flex-wrap items-end gap-4 border-b border-[var(--border)] p-5"><div className="mr-auto"><h2 className="text-lg font-extrabold">Squad effort</h2><p className="mt-1 text-sm text-[var(--muted)]">Both values are required. Zero is valid.</p></div><p className="text-sm font-bold">Dev {formatMd(totalDev)} · QA {formatMd(totalQa)} · Total {formatMd(totalDev + totalQa)} MD</p></div>{error && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}<div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="bg-[var(--surface-subtle)] text-left text-xs uppercase text-[var(--muted)]"><th className="px-5 py-3">Squad</th><th className="px-3 py-3 text-right">Dev MD</th><th className="px-3 py-3 text-right">QA MD</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody>{efforts.map((effort) => { const draft = drafts[effort.id] ?? { dev: String(effort.dev_md), qa: String(effort.qa_md) }; return <tr key={effort.id} className="border-t border-[var(--border)]"><th className="px-5 py-3 text-left">{squadById.get(effort.squad_id)?.display_name ?? "Unknown Squad"}</th><td className="px-3 py-3 text-right"><input aria-label={`${project.project_name} Dev MD`} type="number" min="0" step="0.25" value={draft.dev} onChange={(event) => setDrafts((value) => ({ ...value, [effort.id]: { ...draft, dev: event.target.value } }))} className="control w-28 px-3 text-right" /></td><td className="px-3 py-3 text-right"><input aria-label={`${project.project_name} QA MD`} type="number" min="0" step="0.25" value={draft.qa} onChange={(event) => setDrafts((value) => ({ ...value, [effort.id]: { ...draft, qa: event.target.value } }))} className="control w-28 px-3 text-right" /></td><td className="px-5 py-3 text-right"><button disabled={saving === effort.id} onClick={() => void saveEffort(effort)} className="min-h-9 rounded-lg bg-[var(--ink)] px-3 text-xs font-bold text-white disabled:opacity-50">Save</button><button onClick={() => void removeEffort(effort)} className="ml-2 min-h-9 px-2 text-xs font-bold text-red-700">Remove</button></td></tr>; })}</tbody></table></div><div className="flex flex-col gap-2 border-t border-[var(--border)] p-4 sm:flex-row"><select aria-label="Squad to add" value={addSquadId} onChange={(event) => setAddSquadId(event.target.value)} className="control flex-1 px-3 text-sm"><option value="">Select a Squad…</option>{squads.filter((squad) => squad.active && !used.has(squad.id)).map((squad) => <option key={squad.id} value={squad.id}>{squad.display_name}</option>)}</select><button disabled={!addSquadId || saving === "add"} onClick={() => void addSquad()} className="min-h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-bold disabled:opacity-40">Add Squad</button></div></section>
    <section className="surface flex flex-wrap items-center gap-4 p-5"><div className="mr-auto"><h2 className="font-extrabold">Planning</h2><p className="mt-1 text-sm text-[var(--muted)]">Quarter and Sprint schedules are managed in Planning.</p></div><Link href={`/planning?project=${project.id}`} className="inline-flex min-h-10 items-center rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-white">Open in Planning</Link></section></div>;
}

function SignIn({ client, error }: Readonly<{ client: ReturnType<typeof createClient>; error: string }>) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [message, setMessage] = useState(error), [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); const { error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password }); setMessage(signInError?.message ?? ""); setSaving(false); }
  return <PageContainer title="Projects" description="Sign in to manage project and effort data."><section className="surface max-w-md p-6"><h2 className="text-xl font-extrabold">Sign in</h2><form onSubmit={submit} className="mt-5 space-y-4"><label className="block text-sm font-bold">Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="control mt-1 w-full px-3" /></label><label className="block text-sm font-bold">Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="control mt-1 w-full px-3" /></label>{message && <p role="alert" className="text-sm text-red-700">{message}</p>}<button disabled={saving} className="min-h-11 w-full rounded-xl bg-[var(--ink)] text-sm font-bold text-white">{saving ? "Signing in…" : "Sign in"}</button></form></section></PageContainer>;
}
