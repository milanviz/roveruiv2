"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { useRouter } from "@/lib/spa-router"
import { useProjectStore } from "@/app/store/project/project.store"
import { GetProjectsController } from "@/controllers/project-controller"
import type { ProjectType } from "@/types/project-types"
import { RoverProjectCard } from "@/components/project-card"
import { CardGridSkeleton, PageHeader, PageState } from "@/components/ui/async-state"

const ITEMS_PER_PAGE = 9

export default function ProjectLists() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const { projects, projectsStatus, projectsError, sahredUsers, setSelectedProject } = useProjectStore()

  useEffect(() => { if (projectsStatus === "idle") void GetProjectsController() }, [projectsStatus])

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return projects
    return projects.filter((project) => [project.ProjectName, project.AIAgent, project.Summary].some((value) => value.toLowerCase().includes(query)))
  }, [projects, searchQuery])
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const visibleProjects = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages) }, [currentPage, totalPages])

  const openProject = async (project: ProjectType) => {
    setSelectedProject([project])
    try {
      const response = await fetch("/api/film-projects/")
      if (response.ok) {
        const data = await response.json()
        const match = (data.projects || []).find((item: any) => item.project_id === project.ProjectID)
        if (match?.script_id) return router.push(`/projects/ask-rover?script_id=${encodeURIComponent(match.script_id)}&projectId=${encodeURIComponent(project.ProjectID)}`)
      }
    } catch { /* fall back to project id */ }
    router.push(`/projects/ask-rover?projectId=${encodeURIComponent(project.ProjectID)}`)
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="page-container space-y-6 py-8 sm:py-10" aria-busy={projectsStatus === "loading"}>
        <PageHeader title="My Projects" description="Search, share, and continue your film research." actions={<div className="relative w-full sm:w-80 lg:w-[440px]"><label htmlFor="project-search" className="sr-only">Search projects</label><input id="project-search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1) }} placeholder="Search your projects" className="focus-ring h-11 w-full rounded-lg border border-border bg-card pl-4 pr-11 text-sm text-foreground placeholder:text-muted-foreground" /><Search aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} /></div>} />

        {projectsStatus === "loading" && projects.length === 0 ? <CardGridSkeleton count={6} /> : projectsStatus === "error" && projects.length === 0 ? <PageState kind="error" title="Projects couldn’t be loaded" description={projectsError || undefined} onRetry={() => void GetProjectsController(true)} /> : projects.length === 0 ? <PageState title="No projects yet" description="Create a project to begin analyzing a screenplay." /> : visibleProjects.length === 0 ? <PageState title="No matching projects" description={`No projects match “${searchQuery}”. Try a different search.`} /> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleProjects.map((project) => <RoverProjectCard key={project.ProjectID} project={project} sharedUsers={sahredUsers[project.ProjectID] || []} onOpen={() => void openProject(project)} onArchived={() => GetProjectsController(true)} />)}</div>}

        {projectsStatus === "error" && projects.length > 0 && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"><span>Showing cached projects. Refresh failed.</span><button className="focus-ring rounded-md px-2 py-1 underline" onClick={() => void GetProjectsController(true)}>Retry</button></div>}

        {filtered.length > ITEMS_PER_PAGE && <nav aria-label="Project pages" className="flex items-center justify-center gap-1 pb-3"><button aria-label="Previous page" className="focus-ring flex size-11 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft /></button><span className="px-3 text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span><button aria-label="Next page" className="focus-ring flex size-11 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}><ChevronRight /></button></nav>}
      </div>
    </div>
  )
}
