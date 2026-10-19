import { redirect } from "next/navigation";

export default async function ProjectsPage({ searchParams }: Readonly<{ searchParams: Promise<{ view?: string }> }>) {
  const legacyView = (await searchParams).view;
  const view = legacyView === "squads" ? "squads" : legacyView === "effort" ? "estimation" : "projects";
  redirect(`/planning?view=${view}`);
}
