"use client"

import React from "react"
import { useProjectStore } from "@/app/store/project/project.store"
import { ProjectType } from "@/types/project-types"

const CommonHeader: React.FC = () => {
  const selectedProject = useProjectStore((state) => state.selectedProject[0] as ProjectType | undefined)

  // Return empty placeholder with same dimensions to prevent layout jump
  if (!selectedProject) {
    return <header className="flex h-16 w-full items-center bg-transparent px-4 sm:px-6 lg:px-8" />
  }

  return (
    <header className="flex h-16 w-full items-center bg-transparent px-4 sm:px-6 lg:px-8">
      <h1 className="truncate text-base font-normal text-foreground sm:text-lg" title={selectedProject.ProjectName}>
        {selectedProject.ProjectName.length > 200
          ? `${selectedProject.ProjectName.slice(0, 200)}…`
          : selectedProject.ProjectName}
      </h1>
    </header>
  )
}

export default CommonHeader
