import { Suspense } from "react";
import ProjectCreate from "@/components/project-create";

export default function ProjectDetailPage() {
  return (
    <Suspense>
      <ProjectCreate />
    </Suspense>
  );
}
