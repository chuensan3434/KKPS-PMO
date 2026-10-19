import { PageContainer } from "@/components/layout/page-container";
import { WorkSummaryDashboard } from "@/features/dashboard/components/work-summary-dashboard";
import { PortfolioOverview } from "@/features/dashboard/components/portfolio-overview";
import { isLocalMockDataMode } from "@/lib/development-mode";

export default function DashboardPage() {
  return (
    <PageContainer
      eyebrow="Portfolio intelligence"
      title="Overview"
      description="See project readiness and confirmed capacity exceptions from canonical planning data."
    >
      <PortfolioOverview mockMode={isLocalMockDataMode} />
      <details className="surface mt-6 p-5 sm:p-6"><summary className="cursor-pointer text-lg font-extrabold">Actual effort from actiTIME</summary><p className="mt-2 text-sm text-[var(--muted)]">Optional session-only analysis. Actuals remain separate from planned Project effort.</p><div className="mt-5"><WorkSummaryDashboard /></div></details>
    </PageContainer>
  );
}
