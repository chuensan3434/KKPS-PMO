import { dataModeLabel, isDemoMode } from "@/lib/development-mode";

export function DataModeBanner() {
  return (
    <div className={`border-b px-4 py-2 text-center text-xs font-semibold ${isDemoMode ? "border-amber-300 bg-amber-100 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
      {isDemoMode ? "Demo Mode — Data saved in this browser" : `Data source: ${dataModeLabel} · Supabase authentication and RLS apply.`}
    </div>
  );
}
