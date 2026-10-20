import { ProjectWorkspace } from "@/features/projects/project-workspace";
import { isLocalMockDataMode } from "@/lib/development-mode";

export default async function ProjectsPage({ searchParams }: Readonly<{ searchParams: Promise<{ project?: string }> }>) {
  const project = (await searchParams).project ?? "";
  return <ProjectWorkspace mockMode={isLocalMockDataMode} initialProjectId={project} />;
}
