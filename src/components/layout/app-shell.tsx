import { Navigation } from "./navigation";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[16rem_1fr]">
      <Navigation />

      <div className="min-w-0">
        <header className="hidden h-16 items-center border-b border-slate-200 bg-white px-8 lg:flex">
          <p className="text-sm font-medium text-slate-500">Project Management Office</p>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
