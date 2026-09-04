import { PageContainer } from "@/components/layout/page-container";
import { WorkSummaryDashboard } from "@/features/dashboard/components/work-summary-dashboard";

export default function DashboardPage() {
  return (
    <PageContainer
      title="Dashboard"
      description="Upload an actiTIME CSV to understand working hours by role, person, and project."
    >
      <WorkSummaryDashboard />
    </PageContainer>
  );
}
