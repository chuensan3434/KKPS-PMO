import type { Project, Squad } from "../resource-capacity/domain";

export type ImportEffort = { squad_id: string; squad_name: string; dev_md: number; qa_md: number; row: number };
export type ImportProject = {
  project_name: string;
  description: string | null;
  business_unit: string | null;
  owner_name: string | null;
  target_date: string | null;
  efforts: ImportEffort[];
  rows: number[];
  skipped: boolean;
};
export type ImportIssue = { row: number; message: string };
export type ImportPreview = { projects: ImportProject[]; issues: ImportIssue[] };

const aliases: Record<string, string[]> = {
  project_name: ["project name", "project", "ชื่อโครงการ"],
  description: ["description", "รายละเอียด"],
  business_unit: ["business unit", "bu", "หน่วยงาน"],
  owner_name: ["po / owner", "po", "owner", "เจ้าของโครงการ"],
  target_date: ["target date", "deadline", "วันที่เป้าหมาย"],
  squad: ["squad", "ทีม"],
  dev_md: ["dev md", "development md"],
  qa_md: ["qa md", "test md"],
};

const text = (value: unknown) => value === null || value === undefined ? "" : String(value).trim();
const normalize = (value: unknown) => text(value).toLocaleLowerCase("en-US").replace(/\s+/g, " ");
function valueFor(row: Record<string, unknown>, field: keyof typeof aliases) {
  const match = Object.entries(row).find(([key]) => aliases[field].includes(normalize(key)));
  return match?.[1];
}
function dateValue(value: unknown) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = text(value), date = new Date(raw);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(date.getTime()) ? raw : "";
}
export function previewProjectImport(rows: Record<string, unknown>[], existingProjects: Project[], squads: Squad[]): ImportPreview {
  const issues: ImportIssue[] = [], groups = new Map<string, ImportProject>();
  const existing = new Set(existingProjects.filter((project) => project.archived_at === null).map((project) => normalize(project.project_name)));
  const squadByName = new Map(squads.filter((squad) => squad.active).map((squad) => [normalize(squad.display_name), squad]));

  rows.forEach((row, index) => {
    const rowNumber = index + 2, name = text(valueFor(row, "project_name")), key = normalize(name);
    if (!name) { issues.push({ row: rowNumber, message: "Project Name is required." }); return; }
    const description = text(valueFor(row, "description")) || null;
    const business_unit = text(valueFor(row, "business_unit")) || null;
    const owner_name = text(valueFor(row, "owner_name")) || null;
    const rawTarget = valueFor(row, "target_date"), target_date = rawTarget ? dateValue(rawTarget) : null;
    if (rawTarget && !target_date) issues.push({ row: rowNumber, message: "Target Date must be a valid date." });
    const prior = groups.get(key);
    if (prior) {
      const same = prior.description === description && prior.business_unit === business_unit && prior.owner_name === owner_name && prior.target_date === target_date;
      if (!same) issues.push({ row: rowNumber, message: `Project details conflict with row ${prior.rows[0]}.` });
      prior.rows.push(rowNumber);
    } else groups.set(key, { project_name: name, description, business_unit, owner_name, target_date, efforts: [], rows: [rowNumber], skipped: existing.has(key) });

    const group = groups.get(key)!;
    const squadName = text(valueFor(row, "squad")), rawDev = valueFor(row, "dev_md"), rawQa = valueFor(row, "qa_md");
    const hasEffort = Boolean(squadName || text(rawDev) || text(rawQa));
    if (!hasEffort) return;
    if (!squadName) { issues.push({ row: rowNumber, message: "Squad is required when effort is provided." }); return; }
    const squad = squadByName.get(normalize(squadName));
    if (!squad) { issues.push({ row: rowNumber, message: `Squad “${squadName}” was not found or is inactive.` }); return; }
    if (group.efforts.some((effort) => effort.squad_id === squad.id)) { issues.push({ row: rowNumber, message: `Squad “${squadName}” is duplicated for this project.` }); return; }
    if (text(rawDev) === "" || text(rawQa) === "") { issues.push({ row: rowNumber, message: "Dev MD and QA MD are both required when a Squad is provided." }); return; }
    const dev = Number(rawDev), qa = Number(rawQa);
    if (!Number.isFinite(dev) || dev < 0 || !Number.isFinite(qa) || qa < 0) { issues.push({ row: rowNumber, message: "Dev MD and QA MD must be zero or positive numbers." }); return; }
    group.efforts.push({ squad_id: squad.id, squad_name: squad.display_name, dev_md: dev, qa_md: qa, row: rowNumber });
  });

  const projects = [...groups.values()];
  return { projects, issues };
}

export function importPayload(preview: ImportPreview) {
  return preview.projects.filter((project) => !project.skipped).map((project) => ({
    project_name: project.project_name,
    description: project.description,
    business_unit: project.business_unit,
    owner_name: project.owner_name,
    target_date: project.target_date,
    status: "draft" as const,
    efforts: project.efforts.map(({ squad_id, dev_md, qa_md }) => ({ squad_id, dev_md, qa_md })),
  }));
}
