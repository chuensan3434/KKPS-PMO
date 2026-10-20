import { Navigation } from "./navigation";
import { DataModeBanner } from "./data-mode-banner";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <Navigation />
      <main className="min-w-0"><DataModeBanner />{children}</main>
    </div>
  );
}
