"use client";

import { useMemo, useRef, useState } from "react";
import { parseActitimeCsv } from "../actitime-parser";
import type { SummaryItem, WorkEntry, WorkFilters } from "../types";
import { emptyFilters, filterWorkEntries, summarizeWork, uniqueOptions } from "../work-summary";

function formatHours(hours: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(hours);
}

function SummaryList({ title, items }: Readonly<{ title: string; items: SummaryItem[] }>) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      {items.length ? (
        <ul className="mt-4 divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.label} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <span className="min-w-0 break-words text-sm text-slate-700">{item.label}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-950">
                {formatHours(item.hours)} h
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No hours match the current filters.</p>
      )}
    </section>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

function FilterSelect({ label, value, options, onChange }: Readonly<FilterSelectProps>) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">All {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export function WorkSummaryDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [skippedRows, setSkippedRows] = useState(0);
  const [filters, setFilters] = useState<WorkFilters>(emptyFilters);

  const filteredEntries = useMemo(() => filterWorkEntries(entries, filters), [entries, filters]);
  const summary = useMemo(() => summarizeWork(filteredEntries), [filteredEntries]);
  const options = useMemo(
    () => ({
      roles: uniqueOptions(entries, (entry) => entry.role),
      people: uniqueOptions(entries, (entry) => entry.personName),
      projects: uniqueOptions(entries, (entry) => entry.project),
    }),
    [entries],
  );
  const dateRange = useMemo(() => {
    const dates = entries.map((entry) => entry.date).sort();
    return { min: dates[0] ?? "", max: dates.at(-1) ?? "" };
  }, [entries]);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setFileName(file.name);
    setError("");
    setProcessing(true);
    setHasProcessed(false);

    try {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error("Choose a CSV file with a .csv extension.");
      }

      const result = parseActitimeCsv(await file.text());
      setEntries(result.entries);
      setSkippedRows(result.skippedEntryRows);
      setFilters(emptyFilters);
      setHasProcessed(true);
    } catch (caughtError) {
      setEntries([]);
      setSkippedRows(0);
      setError(caughtError instanceof Error ? caughtError.message : "The CSV could not be read.");
    } finally {
      setProcessing(false);
    }
  }

  function updateFilter(name: keyof WorkFilters, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">actiTIME CSV</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              The file is processed only in this browser session and is not uploaded or saved.
            </p>
            {fileName ? <p className="mt-2 break-all text-sm font-medium text-slate-800">{fileName}</p> : null}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              inputRef.current?.click();
            }}
            disabled={processing}
            className="min-h-11 shrink-0 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {processing ? "Processing…" : fileName ? "Replace CSV" : "Select CSV"}
          </button>
        </div>
        {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
      </section>

      {hasProcessed && entries.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 sm:p-8">
          <h2 className="font-semibold text-slate-950">No usable work entries found</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Check that the export contains detailed actiTIME rows with customer and project context.
          </p>
        </section>
      ) : null}

      {entries.length ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Work summary filters">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Filters</h2>
                <p className="mt-1 text-sm text-slate-500">{filteredEntries.length} of {entries.length} entries included</p>
              </div>
              <button
                type="button"
                onClick={() => setFilters(emptyFilters)}
                className="min-h-11 self-start rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Reset filters
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Date from
                <input
                  type="date"
                  min={dateRange.min}
                  max={filters.dateTo || dateRange.max}
                  value={filters.dateFrom}
                  onChange={(event) => updateFilter("dateFrom", event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Date to
                <input
                  type="date"
                  min={filters.dateFrom || dateRange.min}
                  max={dateRange.max}
                  value={filters.dateTo}
                  onChange={(event) => updateFilter("dateTo", event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <FilterSelect label="Role" value={filters.role} options={options.roles} onChange={(value) => updateFilter("role", value)} />
              <FilterSelect label="Person" value={filters.person} options={options.people} onChange={(value) => updateFilter("person", value)} />
              <FilterSelect label="Project" value={filters.project} options={options.projects} onChange={(value) => updateFilter("project", value)} />
            </div>
          </section>

          <section className="rounded-xl bg-blue-700 p-6 text-white shadow-sm" aria-label="Total hours">
            <p className="text-sm font-medium text-blue-100">Total hours</p>
            <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">{formatHours(summary.totalHours)}</p>
            {skippedRows ? <p className="mt-3 text-sm text-blue-100">{skippedRows} incomplete or invalid rows were skipped.</p> : null}
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-3">
            <SummaryList title="Hours by role" items={summary.byRole} />
            <SummaryList title="Hours by person" items={summary.byPerson} />
            <SummaryList title="Hours by project" items={summary.byProject} />
          </div>
        </>
      ) : null}
    </div>
  );
}
