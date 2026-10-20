"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useRef, useState } from "react";
import type { Project, Squad } from "../resource-capacity/domain";
import { createProjectImportRepository } from "./project-import-repository";
import { importPayload, previewProjectImport, type ImportPreview } from "./project-import";

const headers = ["Project Name", "Description", "Business Unit", "PO / Owner", "Target Date", "Squad", "Dev MD", "QA MD"];
const maxWorkbookBytes = 5 * 1024 * 1024;
const maxImportRows = 5_000;

export function ProjectImportDialog({ client, mockMode, projects, squads, onClose, onImported }: Readonly<{ client: SupabaseClient | null; mockMode: boolean; projects: Project[]; squads: Squad[]; onClose: () => void; onImported: () => void }>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState(""), [preview, setPreview] = useState<ImportPreview | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [result, setResult] = useState("");

  async function readFile(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(""); setResult(""); setFileName(file.name);
    try {
      if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) throw new Error("Choose an Excel .xlsx file.");
      if (file.size > maxWorkbookBytes) throw new Error("The workbook is larger than 5 MB. Split it into smaller imports.");
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("The workbook does not contain a worksheet.");
      if (sheet.rowCount - 1 > maxImportRows) throw new Error("The worksheet has more than 5,000 data rows. Split it into smaller imports.");
      const headerRow = sheet.getRow(1).values as unknown[];
      const parsedRows: Record<string, unknown>[] = [];
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const values = sheet.getRow(rowNumber).values as unknown[];
        const record: Record<string, unknown> = {};
        for (let column = 1; column < headerRow.length; column += 1) {
          const key = String(headerRow[column] ?? "").trim();
          if (key) record[key] = values[column] ?? "";
        }
        if (Object.values(record).some((value) => String(value ?? "").trim() !== "")) parsedRows.push(record);
      }
      if (parsedRows.length === 0) throw new Error("The worksheet does not contain any project rows.");
      setPreview(previewProjectImport(parsedRows, projects, squads));
    } catch (caught) { setPreview(null); setError(caught instanceof Error ? caught.message : "The workbook could not be read."); }
    finally { setBusy(false); }
  }

  async function downloadTemplate() {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet("Projects");
    sheet.addRow(headers);
    sheet.addRow(["CRM Enhancement", "Improve CRM", "PWM", "PO A", "", "Squad Alpha", 20, 10]);
    sheet.addRow(["CRM Enhancement", "Improve CRM", "PWM", "PO A", "", "Squad Beta", 12, 6]);
    sheet.addRow(["Digital Onboarding", "New flow", "Digital", "PO B", "", "", "", ""]);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns.forEach((column, index) => { column.width = index === 0 ? 26 : 18; });
    const output = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a"); link.href = url; link.download = "KKPS-PMO-Project-Import-Template.xlsx"; link.click(); URL.revokeObjectURL(url);
  }

  async function confirmImport() {
    if (!preview || preview.issues.length) return;
    const payload = importPayload(preview);
    if (payload.length === 0) { setError("There are no new projects to import."); return; }
    setBusy(true); setError("");
    try {
      const saved = await createProjectImportRepository(client, mockMode).import(payload);
      setResult(`${saved.created_projects} projects and ${saved.created_efforts} Squad estimates imported. ${saved.skipped_projects} existing projects skipped.`);
      onImported();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The import failed. No data was saved."); }
    finally { setBusy(false); }
  }

  const newProjects = preview?.projects.filter((project) => !project.skipped).length ?? 0, skipped = preview?.projects.filter((project) => project.skipped).length ?? 0;
  return <div role="dialog" aria-modal="true" aria-labelledby="project-import-title" className="fixed inset-0 z-[70] overflow-y-auto bg-black/40 p-4"><section className="mx-auto mt-8 max-w-4xl rounded-2xl bg-white shadow-2xl"><header className="flex items-start gap-4 border-b border-[var(--border)] p-5 sm:p-6"><div className="mr-auto"><h2 id="project-import-title" className="text-xl font-extrabold">Import Projects from Excel</h2><p className="mt-1 text-sm text-[var(--muted)]">Upload, review every row, then confirm once.</p></div><button onClick={onClose} aria-label="Close import" className="grid size-10 place-items-center rounded-xl hover:bg-[var(--surface-subtle)]">×</button></header>
    <div className="p-5 sm:p-6"><ol className="mb-6 grid grid-cols-3 gap-2 text-center text-xs font-bold"><li className="rounded-lg bg-[var(--accent)] px-2 py-2">1 Upload</li><li className={`rounded-lg px-2 py-2 ${preview ? "bg-[var(--accent)]" : "bg-[var(--surface-subtle)]"}`}>2 Preview</li><li className={`rounded-lg px-2 py-2 ${result ? "bg-[var(--accent)]" : "bg-[var(--surface-subtle)]"}`}>3 Confirm</li></ol>
      <div className="flex flex-wrap items-center gap-3"><input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0])} /><button disabled={busy} onClick={() => inputRef.current?.click()} className="min-h-11 rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-white">{busy ? "Reading…" : fileName ? "Choose another file" : "Upload .xlsx"}</button><button onClick={() => void downloadTemplate()} className="control min-h-11 px-4 text-sm font-bold">Download template</button>{fileName && <span className="text-sm font-semibold">{fileName}</span>}</div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}{result && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800">{result}</p>}
      {preview && <div className="mt-6 space-y-4"><div className="flex flex-wrap gap-4 text-sm"><strong>{newProjects} new projects</strong><span>{preview.projects.reduce((sum, project) => sum + project.efforts.length, 0)} estimates</span><span>{skipped} existing projects skipped</span><span className={preview.issues.length ? "text-red-700" : "text-green-700"}>{preview.issues.length} validation errors</span></div>
        {preview.issues.length > 0 && <section aria-label="Import validation errors" className="rounded-xl border border-red-200"><h3 className="border-b border-red-200 px-4 py-3 font-bold text-red-900">Fix these rows before importing</h3><ul className="divide-y divide-red-100">{preview.issues.map((issue, index) => <li key={`${issue.row}-${index}`} className="px-4 py-3 text-sm text-red-800"><strong>Row {issue.row}:</strong> {issue.message}</li>)}</ul></section>}
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]"><table className="w-full min-w-[620px] text-sm"><thead><tr className="bg-[var(--surface-subtle)] text-left text-xs uppercase text-[var(--muted)]"><th className="p-3">Project</th><th className="p-3">Details</th><th className="p-3 text-right">Squads</th><th className="p-3">Result</th></tr></thead><tbody>{preview.projects.map((project) => <tr key={project.project_name.toLocaleLowerCase()} className="border-t border-[var(--border)]"><th className="p-3 text-left">{project.project_name}</th><td className="p-3 text-[var(--muted)]">{project.business_unit || "—"} · {project.owner_name || "—"}</td><td className="p-3 text-right">{project.efforts.length}</td><td className="p-3 font-semibold">{project.skipped ? "Skip existing" : "Create"}</td></tr>)}</tbody></table></div>
        <div className="flex justify-end gap-2"><button onClick={onClose} className="control min-h-11 px-4 text-sm font-bold">{result ? "Close" : "Cancel"}</button>{!result && <button disabled={busy || preview.issues.length > 0 || newProjects === 0} onClick={() => void confirmImport()} className="min-h-11 rounded-xl bg-[var(--ink)] px-5 text-sm font-bold text-white disabled:opacity-40">{busy ? "Importing…" : `Confirm ${newProjects} Projects`}</button>}</div></div>}
    </div></section></div>;
}
