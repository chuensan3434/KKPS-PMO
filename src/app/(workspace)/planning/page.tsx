import { UnifiedPlanning } from "@/features/planning/components/unified-planning";
import { isLocalMockDataMode } from "@/lib/development-mode";

export default function PlanningPage() {
  return <UnifiedPlanning mockMode={isLocalMockDataMode} />;
}
