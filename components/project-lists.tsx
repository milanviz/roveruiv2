"use client"

import { useState, useMemo, use, useEffect } from "react"
import { Search, Share2, Trash2, Sparkles, TrendingUp, Target, ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useProjectStore } from "@/app/store/project/project.store"
import { UniversalPopup } from "./universal-popup"
import { GetProjectsController, ArchiveProjects, ShareProject } from "@/controllers/project-controller"
import { Card } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import type { ProjectType } from "@/types/project-types"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const ITEMS_PER_PAGE = 9

export default function ProjectLists() {
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState("")
    const [currentPage, setCurrentPage] = useState(1)

    const IMAGE_LIST = [
        "/prject_default2.jpg",
        "/prject_default3.jpg",
        "/prject_default4.jpg",
    ]

    // Generate a random but consistent image index based on project ID
    const getRandomImageForProject = (projectId: string) => {
        let hash = 0
        for (let i = 0; i < projectId.length; i++) {
            hash = (hash << 5) - hash + projectId.charCodeAt(i)
            hash |= 0
        }
        return IMAGE_LIST[Math.abs(hash) % IMAGE_LIST.length]
    }

    const { projects, sahredUsers, setSelectedProject } = useProjectStore();

    // Filter projects based on search
    const filteredProjects = useMemo(() => {
        if (!searchQuery.trim()) return projects

        const query = searchQuery.toLowerCase()
        return projects.filter((project) => {
            return (
                project.ProjectName.toLowerCase().includes(query) ||
                project.AIAgent.toLowerCase().includes(query) ||
                project.Summary.toLowerCase().includes(query)
            )
        })
    }, [searchQuery, projects])

    // Pagination
    const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE)

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages)
        }
    }, [totalPages, currentPage])

    const paginatedProjects = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        // Ensure strictly 9 items are sliced
        return filteredProjects.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredProjects, currentPage]);

    const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX || "";

    // Compute image picks for the current page based on project IDs
    const imagePicks = useMemo(() => paginatedProjects.map(p => getRandomImageForProject(p.ProjectID)), [paginatedProjects])

    // Reset to page 1 when search changes
    const handleSearch = (value: string) => {
        setSearchQuery(value)
        setCurrentPage(1)
    }

    const getCategoryIcon = (category: string) => {
        if (category.toLowerCase().includes("ai")) return Sparkles
        if (category.toLowerCase().includes("strategy")) return Target
        return TrendingUp
    }

    const handleProjectClick = async (project: ProjectType) => {
        setSelectedProject([project])

        try {
            const res = await fetch("/api/film-projects/")
            if (res.ok) {
                const data = await res.json()
                const match = (data.projects || []).find(
                    (p: any) => p.project_id === project.ProjectID || p.title === project.ProjectName
                )
                if (match?.script_id) {
                    router.push(`/projects/ask-rover?script_id=${encodeURIComponent(match.script_id)}&projectId=${project.ProjectID}`)
                    return
                }
            }
        } catch (e) {
            console.error("Failed to resolve script_id for project:", e)
        }

        router.push(`/projects/ask-rover?projectId=${project.ProjectID}`)
    }

    return (
        <div className="h-full flex flex-col bg-transparent">
            <div className="px-4 md:px-8 pt-10 md:pt-10 pb-4 md:pb-6 flex justify-center mb-2 shrink-0">
                <div className="w-full max-w-[1400px] flex flex-col md:flex-row items-center justify-between gap-4">
                    <h1 className="text-xl md:text-xl font-normal text-gradient">My Projects</h1>
                    <div className="hidden md:flex flex-1 h-px bg-border"></div>
                    <div className="relative w-full md:w-[920px] md:h-[44px]">

                        <input
                            type="text"
                            placeholder="Search Your Projects"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full h-11 pl-4 pr-11 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
                {/* Grid - Centered and Responsive */}
                <div className="px-4 md:px-8 pb-4 flex justify-center items-start min-h-[716px]">
                    {/* <div className="flex-grow px-4 md:px-8 pb-4 flex justify-center items-start"> */}
                    {paginatedProjects.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <p className="text-muted-foreground text-lg">No projects found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[15px] w-full max-w-[1400px]">
                            {paginatedProjects.map((project, i) => {
                                const sharedThisProject = sahredUsers[project.ProjectID] || [];
                                // const CategoryIcon = getCategoryIcon(project.category)
                                return (
                                    <Card
                                        onClick={() => handleProjectClick(project)}
                                        key={project.ProjectID}
                                        className="group relative bg-background border-border hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                                    >
                                        <div className="flex h-[228px]">
                                            {/* Left side - Project image                                            */}
                                            <div className="relative flex-shrink-0 w-[100px]">
                                                <Image
                                                    src={`${assetPrefix}/assets/images${imagePicks[i]}`}
                                                    alt={project.ProjectName}
                                                    fill
                                                    className="object-cover w-full h-full opacity-70"
                                                />
                                            </div>

                                            {/* Right side - Project details */}
                                            <div className="flex-1 pt-4 px-4 pb-2 flex flex-col">
                                                <div className="flex-1">
                                                    <h3 className="font-normal text-foreground text-[15px] mb-2 line-clamp-2 leading-tight">
                                                        {project.ProjectName}
                                                    </h3>
                                                    <div className="flex items-center gap-1 text-[13px] text-primary mb-3">
                                                        <span className="inline-block">⚡</span>
                                                        <span>{project.AIAgent}</span>
                                                    </div>
                                                    {/* <p className="text-[13px] text-muted-foreground line-clamp-3 leading-relaxed">
                                                    {new DOMParser().parseFromString(project.Summary, "text/html").body.textContent}
                                                </p> */}
                                                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                                                        {new DOMParser()
                                                            .parseFromString(project.Summary, "text/html")
                                                            .body.textContent
                                                            ?.slice(0, 110) + "..."}{/* limit to 120 chars */}
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-between pt-2 border-t border-border mt-auto">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="flex -space-x-2">
                                                                    {sharedThisProject.slice(0, 3).map((name: string, idx: number) => {
                                                                        const first = (name?.trim().charAt(0) ?? "").toUpperCase();
                                                                        return (
                                                                            <div
                                                                                key={idx}
                                                                                className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-card flex items-center justify-center"
                                                                            >
                                                                                <span className="text-[10px] font-semibold text-primary">
                                                                                    {first}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <div className="text-xs">
                                                                    {sharedThisProject.length > 0 ? (
                                                                        <ul className="space-y-1">
                                                                            {sharedThisProject.map((name: string, idx: number) => (
                                                                                <li key={idx}>{name}</li>
                                                                            ))}
                                                                        </ul>
                                                                    ) : (
                                                                        <p>No shared users</p>
                                                                    )}
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                    <div className="flex gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                                                        <UniversalPopup
                                                            mode="email"
                                                            title="Share Project"
                                                            description="Enter an email address to share the project."
                                                            trigger={
                                                                <button className="
                                                                w-[31.29px] 
                                                                h-[31.29px] 
                                                                flex 
                                                                items-center 
                                                                justify-center 
                                                                rounded-full 
                                                                bg-[#201F1F]/50
                                                                hover:bg-secondary
                                                                text-icon-secondary 
                                                                hover:text-destructive 
                                                                cursor-pointer
                                                            " >
                                                                    <span><Image src={`${assetPrefix}/assets/icons/share.svg`} alt="Rover Logo" width={14} height={14} /></span>
                                                                </button>
                                                            }
                                                            onSend={(email) => ShareProject(project.ProjectID, "adduser", email)}
                                                        />

                                                        <UniversalPopup
                                                            mode="delete"
                                                            title="Delete Project?"
                                                            description="This action cannot be undone."
                                                            trigger={
                                                                <button
                                                                    className="w-[31.29px] h-[31.29px] flex items-center justify-center rounded-full bg-[#201F1F]/50 hover:bg-secondary text-icon-secondary hover:text-destructive cursor-pointer"
                                                                >
                                                                    <Image
                                                                        src={`${assetPrefix}/assets/icons/archive.svg`}
                                                                        alt="Archive Icon"
                                                                        width={14}
                                                                        height={14}
                                                                    />
                                                                </button>
                                                            }
                                                            onConfirm={async () => {
                                                                await ArchiveProjects("Yes", "Archive", project.rowid ?? "");
                                                                await GetProjectsController();
                                                            }}
                                                        />

                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Gradient underline on hover */}
                                        <div className="underline-gradient"></div>
                                    </Card>
                                )
                            })}
                        </div >
                    )}
                </div >

                {/* Pagination - No border-t, centered */}
                {
                    totalPages > 1 && (
                        <div className="px-4 md:px-8 flex items-center justify-center mb-2">
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="w-10 h-10 rounded-md flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft size={20} className="text-foreground" />
                                </button>

                                {[...Array(totalPages)].map((_, i) => {
                                    const page = i + 1
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-10 h-10 rounded-md text-sm font-medium transition-all ${currentPage === page ? "bg-[#3378E0] text-white" : "text-foreground hover:bg-muted"
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    )
                                })}

                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="w-10 h-10 rounded-md flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight size={20} className="text-foreground" />
                                </button>
                            </div>
                        </div>
                    )
                }
            </div>
        </div >
    )
}
