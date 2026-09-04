import type { WorkEntry } from "./types";

const requiredHeaders = [
  "Customer",
  "Project",
  "Task",
  "Type of Work",
  "Day",
  "User",
  "Spent Time",
  "Comments",
] as const;

const confirmedSquads = [
  "Vanilla",
  "Butterbeer",
  "Matcha",
  "Latte",
  "Piccolo",
  "Rocky Road",
  "Ka-ti",
  "Mocha",
  "Americano",
  "Magnum",
] as const;

const confirmedSquadByNormalizedName = new Map(
  confirmedSquads.map((squad) => [squad.toLocaleLowerCase("en-US"), squad]),
);

export type ParseResult = {
  entries: WorkEntry[];
  skippedEntryRows: number;
};

function parseCsvRows(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"' && value.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (character !== "\r") {
      value += character;
    }
  }

  if (quoted) {
    throw new Error("The CSV contains an unfinished quoted value.");
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function parseDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
}

function parseHours(value: string): number | null {
  if (!/^(?:\d+|\d*\.\d+)$/.test(value)) return null;
  const hours = Number(value);
  return Number.isFinite(hours) && hours >= 0 ? hours : null;
}

export function parseWorkforceIdentity(value: string) {
  const separator = value.indexOf(",");
  if (separator === -1) {
    return { sourceGroup: value, person: value, squad: null, role: value };
  }

  const sourceGroup = value.slice(0, separator).trim();
  const person = value.slice(separator + 1).trim();

  if (!sourceGroup || !person) {
    const preservedValue = value.trim();
    return {
      sourceGroup: sourceGroup || preservedValue,
      person: person || preservedValue,
      squad: null,
      role: sourceGroup || preservedValue,
    };
  }

  const canonicalSquad = confirmedSquadByNormalizedName.get(
    sourceGroup.toLocaleLowerCase("en-US"),
  );
  if (canonicalSquad) {
    return { sourceGroup, person, squad: canonicalSquad, role: "Dev" };
  }

  const possibleSquad = sourceGroup.replace(/\s+qa$/i, "").trim();
  const canonicalQaSquad =
    possibleSquad === sourceGroup
      ? undefined
      : confirmedSquadByNormalizedName.get(possibleSquad.toLocaleLowerCase("en-US"));

  if (canonicalQaSquad) {
    return { sourceGroup, person, squad: canonicalQaSquad, role: "QA" };
  }

  return { sourceGroup, person, squad: null, role: sourceGroup };
}

export function parseActitimeCsv(source: string): ParseResult {
  if (!source.trim()) {
    throw new Error("The selected CSV is empty.");
  }

  const rows = parseCsvRows(source.replace(/^\uFEFF/, ""));
  const headerIndex = rows.findIndex((row) => {
    const values = row.map((value) => value.trim());
    return requiredHeaders.every((name) => values.includes(name));
  });
  const header = headerIndex >= 0 ? rows[headerIndex].map((value) => value.trim()) : null;

  if (!header || requiredHeaders.some((name) => !header.includes(name))) {
    throw new Error(`The CSV must include these columns: ${requiredHeaders.join(", ")}.`);
  }

  const column = Object.fromEntries(header.map((name, index) => [name, index]));
  const entries: WorkEntry[] = [];
  let customer = "";
  let project = "";
  let skippedEntryRows = 0;

  for (const rawRow of rows.slice(headerIndex + 1)) {
    const get = (name: (typeof requiredHeaders)[number]) =>
      (rawRow[column[name]] ?? "").trim();
    const rowCustomer = get("Customer");
    const rowProject = get("Project");
    const task = get("Task");
    const typeOfWork = get("Type of Work");
    const day = get("Day");
    const user = get("User");
    const spentTime = get("Spent Time");

    if (rowCustomer && !rowProject && !task && !typeOfWork && !day && !user) {
      customer = rowCustomer;
      project = "";
      continue;
    }

    if (rowProject && !rowCustomer && !task && !typeOfWork && !day && !user) {
      project = rowProject;
      continue;
    }

    const hasEntryContent = Boolean(task || typeOfWork || day || user);
    if (!hasEntryContent) continue;

    const date = parseDate(day);
    const hours = parseHours(spentTime);
    if (!customer || !project || !task || !typeOfWork || !user || !date || hours === null) {
      skippedEntryRows += 1;
      continue;
    }

    const identity = parseWorkforceIdentity(user);
    entries.push({
      customer,
      project,
      task,
      typeOfWork,
      date,
      user,
      ...identity,
      hours,
      comments: get("Comments"),
    });
  }

  return { entries, skippedEntryRows };
}
