import { UnifiedPlanning, type PlanningView } from "@/features/planning/components/unified-planning";
import { isLocalMockDataMode } from "@/lib/development-mode";

export default async function PlanningPage({ searchParams }: Readonly<{ searchParams: Promise<{ view?: string }> }>) {
  const requested = (await searchParams).view;
  const initialView: PlanningView = requested === "estimation" || requested === "capacity" || requested === "projects" || requested === "squads" ? requested : "roadmap";
  return <UnifiedPlanning mockMode={isLocalMockDataMode} initialView={initialView} />;
}
