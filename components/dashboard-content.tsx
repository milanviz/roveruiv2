"use client"

import { useEffect } from "react"
import { Image, useRouter } from "@/lib/spa-router"
import { assetPath } from "@/lib/env"
import { useProjectStore } from "@/app/store/project/project.store"
import { GetProjectsController } from "@/controllers/project-controller"
import type { ProjectType } from "@/types/project-types"
import { RoverProjectCard } from "@/components/project-card"
import { CardGridSkeleton, PageState, SectionHeader } from "@/components/ui/async-state"

export default function DashboardContent() {
  const router = useRouter()
  const { projects, projectsStatus, projectsError, AiAgentList, sahredUsers, setSelectedProject, setSelectedAiAgent } = useProjectStore()

  useEffect(() => { void GetProjectsController(); setSelectedAiAgent("") }, [setSelectedAiAgent])

  const openProject = async (project: ProjectType) => {
    setSelectedProject([project])
    try {
      const response = await fetch("/api/film-projects/")
      if (response.ok) {
        const data = await response.json()
        const match = (data.projects || []).find((item: any) => item.project_id === project.ProjectID)
        if (match?.script_id) return router.push(`/projects/ask-rover?script_id=${encodeURIComponent(match.script_id)}&projectId=${encodeURIComponent(project.ProjectID)}`)
      }
    } catch { /* project id remains a valid fallback */ }
    router.push(`/projects/ask-rover?projectId=${encodeURIComponent(project.ProjectID)}`)
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="page-container space-y-10 py-8 sm:space-y-12 sm:py-12">
        <header className="text-center">
          <h1 className="flex items-center justify-center gap-2 text-3xl font-medium sm:text-4xl"><Image src={assetPath("images/hand.png")} alt="" width={42} height={42} /><span className="text-gradient">Welcome!</span></h1>
          <p className="mt-3 text-lg font-light text-lighttext sm:text-2xl">What would you like to start with today?</p>
        </header>

        <section className="space-y-5">
          <SectionHeader title="Create Project" />
          <p className="text-lg font-light text-lighttext sm:text-xl">Choose an AI specialist</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {AiAgentList.map((agent) => <button type="button" key={agent.id} onClick={() => { setSelectedAiAgent(agent.id); router.push(`/projects/project-create?title=${encodeURIComponent(agent.title)}`) }} className="focus-ring rover-surface flex min-h-24 items-center gap-3 p-3 text-left transition hover:border-primary/50 hover:bg-primary/10"><span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-white/5"><Image src={assetPath(`images/${agent.icon}`)} alt="" width={42} height={42} /></span><span className="text-sm text-foreground">{agent.title}</span></button>)}
          </div>
        </section>

        <section className="space-y-4" aria-busy={projectsStatus === "loading"}>
          <SectionHeader title="Recent Projects" action={projects.length > 0 ? <button className="focus-ring rounded-md px-2 py-1 text-xs text-foreground hover:text-primary" onClick={() => router.push("/projects")}>View all →</button> : undefined} />
          {projectsStatus === "loading" && projects.length === 0 ? <CardGridSkeleton count={3} compact /> : projectsStatus === "error" && projects.length === 0 ? <PageState kind="error" title="Projects couldn’t be loaded" description={projectsError || undefined} onRetry={() => void GetProjectsController(true)} /> : projects.length === 0 ? <PageState title="No projects yet" description="Upload a screenplay above to create your first project." /> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{projects.slice(0, 3).map((project) => <RoverProjectCard key={project.ProjectID} project={project} compact sharedUsers={sahredUsers[project.ProjectID] || []} onOpen={() => void openProject(project)} onArchived={() => GetProjectsController(true)} />)}</div>}
          {projectsStatus === "error" && projects.length > 0 && <p role="status" className="text-sm text-amber-300">Showing saved projects. Refresh failed: {projectsError}</p>}
        </section>
      </div>
    </div>
  )
}
