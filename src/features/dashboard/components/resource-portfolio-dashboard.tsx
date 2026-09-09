import type { CSSProperties } from "react";
import type { ResourcePortfolio, ResourcePortfolioArea } from "../types";
import { HOURS_PER_MANDAY } from "../resource-portfolio";

const colors = ["#1d4ed8", "#0f766e", "#7c3aed", "#c2410c", "#be123c", "#0369a1", "#4d7c0f", "#a16207"];

function md(hours: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(hours / HOURS_PER_MANDAY);
}

function pct(value: number) {
  return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
}

function PortfolioTable({ title, area }: Readonly<{ title: string; area: ResourcePortfolioArea }>) {
  const projectPct = area.totalHours ? area.projectHours / area.totalHours * 100 : 0;
  const supportPct = area.totalHours ? area.supportHours / area.totalHours * 100 : 0;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">Customer portfolio in mandays</p>
      {area.rows.length ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-3">Customer</th>{["Project days", "Project %", "Support days", "Support %", "Total days", "Total %"].map((label) => <th key={label} className="px-3 py-3 text-right">{label}</th>)}
            </tr></thead>
            <tbody>
              {area.rows.map((row) => <tr key={row.customer} className="border-b border-slate-100 text-slate-700">
                <th scope="row" className="max-w-64 break-words px-3 py-3 text-left font-medium text-slate-950">{row.customer}</th>
                <td className="px-3 py-3 text-right tabular-nums">{md(row.projectHours)}</td><td className="px-3 py-3 text-right tabular-nums">{pct(row.projectPct)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{md(row.supportHours)}</td><td className="px-3 py-3 text-right tabular-nums">{pct(row.supportPct)}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-950">{md(row.totalHours)}</td><td className="px-3 py-3 text-right tabular-nums">{pct(row.totalPct)}</td>
              </tr>)}
            </tbody>
            <tfoot><tr className="bg-slate-50 font-semibold text-slate-950">
              <th className="px-3 py-3 text-left">Total</th><td className="px-3 py-3 text-right tabular-nums">{md(area.projectHours)}</td><td className="px-3 py-3 text-right tabular-nums">{pct(projectPct)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{md(area.supportHours)}</td><td className="px-3 py-3 text-right tabular-nums">{pct(supportPct)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{md(area.totalHours)}</td><td className="px-3 py-3 text-right tabular-nums">{pct(area.totalHours ? 100 : 0)}</td>
            </tr></tfoot>
          </table>
        </div>
      ) : <p className="mt-5 text-sm text-slate-500">No {title.toLowerCase()} records match the current filters.</p>}
    </section>
  );
}

function DepartmentDonut({ portfolio }: Readonly<{ portfolio: ResourcePortfolio }>) {
  let progress = 0;
  const stops = portfolio.departments.map((item, index) => {
    const start = progress;
    progress += item.percentage;
    return `${colors[index % colors.length]} ${start}% ${progress}%`;
  });
  const style = { background: portfolio.totalHours ? `conic-gradient(${stops.join(",")})` : "#e2e8f0" } as CSSProperties;
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 className="text-lg font-semibold text-slate-950">Resource Used by Department</h2>
    {portfolio.departments.length ? <div className="mt-5 grid items-center gap-6 sm:grid-cols-[180px_1fr]">
      <div role="img" aria-label="Resource use by department donut chart" className="relative mx-auto size-44 rounded-full" style={style}>
        <div className="absolute inset-9 grid place-items-center rounded-full bg-white text-center"><span><strong className="block text-xl text-slate-950">{md(portfolio.totalHours)}</strong><span className="text-xs text-slate-500">mandays</span></span></div>
      </div>
      <ul className="space-y-3">{portfolio.departments.map((item, index) => <li key={item.label} title={`${md(item.hours)} mandays · ${item.hours.toFixed(1)} hours`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 text-sm">
        <span className="mt-1 size-3 rounded-sm" style={{ backgroundColor: colors[index % colors.length] }} /><span className="break-words text-slate-700">{item.label}</span><span className="font-semibold tabular-nums text-slate-950">{pct(item.percentage)}</span>
      </li>)}</ul>
    </div> : <p className="mt-5 text-sm text-slate-500">No resource use matches the current filters.</p>}
  </section>;
}

function ProjectSupportBars({ portfolio }: Readonly<{ portfolio: ResourcePortfolio }>) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 className="text-lg font-semibold text-slate-950">Project vs Support</h2><p className="mt-1 text-sm text-slate-500">Actual mandays by service area</p>
    <div className="mt-6 space-y-6">{[["App", portfolio.app], ["Infra", portfolio.infra]].map(([label, value]) => {
      const area = value as ResourcePortfolioArea; const project = area.totalHours ? area.projectHours / area.totalHours * 100 : 0; const support = area.totalHours ? 100 - project : 0;
      return <div key={label as string}><div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-slate-950">{label as string}</span><span className="tabular-nums text-slate-500">{md(area.totalHours)} MD</span></div>
        {area.totalHours ? <div className="flex h-10 overflow-hidden rounded-lg bg-slate-100" aria-label={`${label}: ${pct(project)} project and ${pct(support)} support`}>
          <div title={`Project · ${md(area.projectHours)} MD · ${pct(project)}`} className="grid min-w-0 place-items-center bg-blue-700 text-xs font-semibold text-white" style={{ width: `${project}%` }}>{project >= 15 ? pct(project) : ""}</div>
          <div title={`Support · ${md(area.supportHours)} MD · ${pct(support)}`} className="grid min-w-0 place-items-center bg-teal-600 text-xs font-semibold text-white" style={{ width: `${support}%` }}>{support >= 15 ? pct(support) : ""}</div>
        </div> : <div className="grid h-10 place-items-center rounded-lg bg-slate-100 text-xs text-slate-500">No data</div>}
      </div>;
    })}</div>
    <div className="mt-5 flex gap-5 text-xs text-slate-600"><span className="flex items-center gap-2"><i className="size-3 rounded-sm bg-blue-700" />Project</span><span className="flex items-center gap-2"><i className="size-3 rounded-sm bg-teal-600" />Support</span></div>
  </section>;
}

export function ResourcePortfolioDashboard({ portfolio, periodLabel, estimatedMandays }: Readonly<{ portfolio: ResourcePortfolio; periodLabel: string; estimatedMandays: number | null }>) {
  const actual = portfolio.totalHours / HOURS_PER_MANDAY; const variance = estimatedMandays === null ? null : actual - estimatedMandays;
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold tracking-tight text-slate-950">Technology Service Portfolio</h2><p className="mt-1 text-sm text-slate-500">{periodLabel}</p></div>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Estimated and actual summary">
      {[["Estimated Mandays", estimatedMandays === null ? "N/A" : md(estimatedMandays * HOURS_PER_MANDAY)], ["Actual Mandays", md(portfolio.totalHours)], ["Variance Mandays", variance === null ? "N/A" : `${variance > 0 ? "+" : ""}${variance.toFixed(1)}`], ["Variance %", variance === null || !estimatedMandays ? "N/A" : `${variance > 0 ? "+" : ""}${pct(variance / estimatedMandays * 100)}`]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{value}</p></div>)}
    </section>
    <div className="grid items-start gap-6 xl:grid-cols-2"><DepartmentDonut portfolio={portfolio} /><ProjectSupportBars portfolio={portfolio} /></div>
    <PortfolioTable title="Software Development" area={portfolio.app} />
    <PortfolioTable title="Technology Infrastructure" area={portfolio.infra} />
    {portfolio.unmapped.totalHours ? <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold text-amber-950">Unmapped service area</h2><p className="mt-1 text-sm text-amber-800">{md(portfolio.unmapped.totalHours)} mandays remain included in the department and actual totals. Update the centralized team mapping to allocate these records to App or Infra.</p></section> : null}
  </div>;
}
