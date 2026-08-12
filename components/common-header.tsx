"use client"

import React from "react"
import { useProjectStore } from "@/app/store/project/project.store"
import { ProjectType } from "@/types/project-types"

const CommonHeader: React.FC = () => {
  const selectedProject = useProjectStore((state) => state.selectedProject[0] as ProjectType | undefined)

  // Return empty placeholder with same dimensions to prevent layout jump
  if (!selectedProject) {
    return <header className="w-full h-16 bg-transparent flex items-center px-8" />
  }

  return (
    <header className="w-full h-16 bg-transparent flex items-center px-8">
      <h1 className="text-lg font-normal text-foreground">
        {selectedProject.ProjectName.length > 200
          ? `${selectedProject.ProjectName.slice(0, 200)}…`
          : selectedProject.ProjectName}
      </h1>
    </header>
  )
}

export default CommonHeader