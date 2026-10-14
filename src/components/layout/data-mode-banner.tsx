import { dataModeLabel, isLocalMockDataMode } from "@/lib/development-mode";

export function DataModeBanner() {
  return (
    <div className={`border-b px-4 py-2 text-center text-xs font-semibold ${isLocalMockDataMode ? "border-amber-300 bg-amber-100 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
      Data source: {dataModeLabel}
      {isLocalMockDataMode ? " · Changes stay in this browser and are not saved to Supabase." : " · Supabase authentication and RLS apply."}
    </div>
  );
}
