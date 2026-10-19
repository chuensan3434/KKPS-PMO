"use client";

import type { Session } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageContainer } from "../../components/layout/page-container";
import { createClient } from "../../lib/supabase/client";
import { isLocalMockDataMode } from "../../lib/development-mode";
import type { Project } from "./domain";
import { EffortPlanning, SquadManagement } from "./effort-planning";
import { createProjectRepository } from "./repositories";

const PROJECT_STATUSES = ["draft", "active", "on_hold", "completed", "cancelled"] as const;

type ProjectForm = {
  project_name: string;
  description: string;
  status: (typeof PROJECT_STATUSES)[number];
};

const emptyForm: ProjectForm = { project_name: "", description: "", status: "draft" };

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function statusLabel(status: Project["status"]) {
  return status.replace("_", " ");
}

export function ProjectMaster({ mockMode = isLocalMockDataMode, embeddedView }: Readonly<{ mockMode?: boolean; embeddedView?: "projects" | "squads" }>) {
  const supabase = useMemo(() => mockMode ? null : createClient(), [mockMode]);
  const repository = useMemo(() => createProjectRepository(supabase, mockMode), [mockMode, supabase]);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(!mockMode);
  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<"projects" | "effort" | "squads">(embeddedView ?? "effort");

  useEffect(() => {
    if (mockMode) return;
    let mounted = true;
    if (!supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setAuthLoading(false);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError(error.message);
      setSession(data.session);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [mockMode, supabase]);

  useEffect(() => {
    if (!mockMode && !session) return;

    let current = true;
    async function loadProjects() {
      await Promise.resolve();
      if (!current) return;
      setProjectsLoading(true);
      setProjectError("");
      try {
        const records = await repository.list();
        if (current) setProjects(records);
      } catch (error) {
        if (current) setProjectError(messageFrom(error));
      } finally {
        if (current) setProjectsLoading(false);
      }
    }
    void loadProjects();
    return () => {
      current = false;
    };
  }, [mockMode, repository, session]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthError("");
    setAuthSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setAuthError(error.message);
    setAuthSubmitting(false);
  }

  async function signOut() {
    if (!supabase) return;
    setAuthError("");
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
  }

  function beginCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  }

  function beginEdit(project: Project) {
    setEditingId(project.id);
    setForm({
      project_name: project.project_name,
      description: project.description ?? "",
      status: project.status,
    });
    setFormError("");
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const projectName = form.project_name.trim();
    if (!projectName) {
      setFormError("Project name is required.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const values = {
        project_name: projectName,
        description: form.description.trim() || null,
        status: form.status,
      };
      const saved = editingId
        ? await repository.update(editingId, values)
        : await repository.create({ ...values, metadata: {} });
      setProjects((current) => {
        const next = editingId ? current.map((project) => project.id === saved.id ? saved : project) : [...current, saved];
        return next.toSorted((a, b) => a.project_name.localeCompare(b.project_name));
      });
      beginCreate();
    } catch (error) {
      setFormError(messageFrom(error));
    } finally {
      setSaving(false);
    }
  }

  async function archiveProject(project: Project) {
    if (!window.confirm(`Archive ${project.project_name}?`)) return;
    setProjectError("");
    try {
      const archived = await repository.archive(project.id);
      setProjects((current) => current.map((item) => item.id === archived.id ? archived : item));
      if (editingId === project.id) beginCreate();
    } catch (error) {
      setProjectError(messageFrom(error));
    }
  }

  const visibleProjects = projects.filter((project) => showArchived ? project.archived_at !== null : project.archived_at === null);

  if (authLoading) {
    return <PageContainer title="Projects" description="Loading your secure Project Master session…" />;
  }

  if (!mockMode && !session) {
    return (
      <PageContainer title="Projects" description="Sign in with your KKPS-PMO account to manage Project Master data.">
        <section className="surface max-w-md p-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--success)]">Secure workspace</p><h2 className="mt-1 text-xl font-extrabold text-[var(--ink)]">Sign in</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Accounts are created by an administrator. Public registration is not available here.</p>
          <form className="mt-6 space-y-4" onSubmit={signIn}>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input className="control mt-1 w-full px-3" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <input className="control mt-1 w-full px-3" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {authError ? <p role="alert" className="text-sm text-red-700">{authError}</p> : null}
            <button className="min-h-11 w-full rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" type="submit" disabled={authSubmitting}>
              {authSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </section>
      </PageContainer>
    );
  }

  const content = <>
      {!embeddedView && !mockMode ? <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">Signed in as <span className="font-medium text-slate-900">{session?.user.email}</span></p><button type="button" onClick={signOut} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign out</button></div> : null}

      {!embeddedView ? <div role="tablist" aria-label="Project planning sections" className="surface mt-6 flex flex-wrap gap-1 p-1">
        {([
          ["effort", "Effort Planning"],
          ["projects", "Project Master"],
          ["squads", "Squad Management"],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={workspaceView === value} onClick={() => setWorkspaceView(value)} className={`min-h-10 rounded-xl px-4 text-sm font-bold ${workspaceView === value ? "bg-[var(--accent)] text-[var(--ink)]" : "text-[var(--muted)] hover:bg-[var(--surface-subtle)]"}`}>{label}</button>
        ))}
      </div> : null}

      {workspaceView === "effort" ? <div className="mt-6"><EffortPlanning mockMode={mockMode} /></div> : null}
      {workspaceView === "squads" ? <div className={embeddedView ? "mt-6" : "mt-6"}><SquadManagement mockMode={mockMode} /></div> : null}
      {workspaceView === "projects" ? <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="project-list-heading" className="surface min-w-0 overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="project-list-heading" className="text-xl font-extrabold tracking-[-0.02em] text-[var(--ink)]">{showArchived ? "Archived projects" : "Active projects"}</h2>
              <p className="mt-1 text-sm text-slate-500">{visibleProjects.length} project{visibleProjects.length === 1 ? "" : "s"}</p>
            </div>
            <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setShowArchived((current) => !current)}>
              {showArchived ? "View active projects" : "View archived projects"}
            </button>
          </div>
          {projectError ? <p role="alert" className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{projectError}</p> : null}
          {projectsLoading ? <p className="p-5 text-sm text-slate-500">Loading projects…</p> : null}
          {!projectsLoading && visibleProjects.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-medium text-slate-800">No {showArchived ? "archived" : "active"} projects</p>
              <p className="mt-1 text-sm text-slate-500">{showArchived ? "Archived projects will appear here." : "Create the first project using the form."}</p>
            </div>
          ) : null}
          {!projectsLoading && visibleProjects.length > 0 ? (
            <ul className="divide-y divide-slate-200">
              {visibleProjects.map((project) => (
                <li key={project.id} className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-950">{project.project_name}</h3>
                      <p className="mt-1 text-sm capitalize text-blue-700">{statusLabel(project.status)}</p>
                      {project.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{project.description}</p> : null}
                    </div>
                    {!project.archived_at ? (
                      <div className="flex shrink-0 gap-2">
                        <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => beginEdit(project)}>Edit</button>
                        <button type="button" className="min-h-11 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50" onClick={() => void archiveProject(project)}>Archive</button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section aria-labelledby="project-form-heading" className="surface h-fit p-5 xl:sticky xl:top-24">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--success)]">Project details</p><h2 id="project-form-heading" className="mt-1 text-xl font-extrabold text-[var(--ink)]">{editingId ? "Edit project" : "Create project"}</h2>
          <form className="mt-5 space-y-4" onSubmit={saveProject}>
            <label className="block text-sm font-medium text-slate-700">
              Project name
              <input className="control mt-1 w-full px-3" maxLength={200} required value={form.project_name} onChange={(event) => setForm((current) => ({ ...current, project_name: event.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Description
              <textarea className="control mt-1 min-h-28 w-full p-3" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Status
              <select className="control mt-1 w-full bg-white px-3 capitalize" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ProjectForm["status"] }))}>
                {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
            </label>
            {formError ? <p role="alert" className="text-sm text-red-700">{formError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button className="min-h-11 rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create project"}</button>
              {editingId ? <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={beginCreate}>Cancel</button> : null}
            </div>
          </form>
        </section>
      </div> : null}
    </>;

  if (embeddedView) return content;
  return <PageContainer title="Project & Effort Planning" description={mockMode ? "Maintain local mock projects, squads, and squad-level Dev and QA effort." : "Maintain projects, squads, and squad-level Dev and QA effort in Supabase."}>{content}</PageContainer>;
}
