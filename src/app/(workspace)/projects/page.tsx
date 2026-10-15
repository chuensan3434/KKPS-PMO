import { ProjectMaster } from "@/features/resource-capacity/project-master";
import { isLocalMockDataMode } from "@/lib/development-mode";

export default function ProjectsPage() {
  return <ProjectMaster mockMode={isLocalMockDataMode} />;
}
