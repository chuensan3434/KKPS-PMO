import { UnifiedPlanning, type PlanningView } from "@/features/planning/components/unified-planning";
import { isLocalMockDataMode } from "@/lib/development-mode";
import { redirect } from "next/navigation";

export default async function PlanningPage({ searchParams }: Readonly<{ searchParams: Promise<{ view?: string }> }>) {
  const requested = (await searchParams).view;
  if (requested === "estimation" || requested === "projects") redirect("/projects");
  const initialView: PlanningView = requested === "capacity" ? requested : "roadmap";
  return <UnifiedPlanning mockMode={isLocalMockDataMode} initialView={initialView} />;
}
