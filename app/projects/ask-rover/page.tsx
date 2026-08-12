import { Suspense } from "react";
import ProjectDetail from "@/components/project-detail";

export default function ProjectDetailPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center">Loading...</div>}>
            <ProjectDetail />
        </Suspense>
    );
}