"use client"

import { Card, GradientCard, CardContent } from "@/components/ui/card"
import { Share2, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/language-context"
import { useState, useEffect } from "react"
import { GetProjectsController, ShareProject, ArchiveProjects } from "@/controllers/project-controller"
import { useProjectStore } from "@/app/store/project/project.store"
import type { ProjectType } from "@/types/project-types"
import { UniversalPopup } from "./universal-popup"
import Image from "next/image"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export default function DashboardContent() {
  const router = useRouter()
  const { t } = useLanguage()

  // const [loading, setLoading] = useState<boolean>(true)

  const imageList = [
    "/prject_default2.jpg",
    "/prject_default3.jpg",
    "/prject_default4.jpg",
  ]


  const currentUser = useProjectStore((state) => state.currentUser);
  const projects = useProjectStore((state) => state.projects);
  const AiAgentList = useProjectStore((state) => state.AiAgentList);
  const setSelectedProject = useProjectStore((state) => state.setSelectedProject);
  const setSelectedAiAgent = useProjectStore((state) => state.setSelectedAiAgent);
  const sahredUsers = useProjectStore((state) => state.sahredUsers);

  useEffect(() => {
    GetProjectsController()
    setSelectedAiAgent("")
  }, [])

  const handleAgentClick = async (aiAgent: string, agentId: string) => {
    // Set the selected agent in store before navigating
    await setSelectedAiAgent(agentId);
    const slug = aiAgent.toLowerCase().replace(/\s+/g, "-")
    const params = new URLSearchParams({
      title: aiAgent,

    })
    router.push(`/projects/project-create?${params.toString()}`)
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
  const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX || "";
  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-hide">
      <div className="flex-1 p-8 space-y-12">
        <div className="text-center space-y-3 mb-20 pt-8">
          <h1 className="text-4xl m-0 font-medium text-foreground flex items-center justify-center gap-2">
            <span><Image src={`${assetPrefix}/assets/images/hand.png`} alt="Waving Hand" width={46} height={46} /></span> <p className="text-gradient">Welcome!</p>
          </h1>
          <p className="text-[28px] text-lighttext font-extralight">What would you like to start with today?</p>
        </div>

        <div className="max-w-[1400px] mx-auto">
          <div className="mb-2 flex items-center gap-6">
            <h2 className="text-xl font-none text-primary inline-block text-gradient pb-1 whitespace-nowrap">
              Create Project
            </h2>
            <div className="flex-1 border-b-[1px] border-[#2B2B2B]"></div>
          </div>
          <p className="text-[25px] text-lighttext font-extralight mb-8">Which AI Agent would you like to use?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {AiAgentList.map((agent) => {
              return (
                <GradientCard
                  key={agent.id}
                  className={`
                    ${agent.selected ? "card-bg-gradient" : "bg-[#0D0D0D]"} h-[92px] border-border hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer hover:card-bg-gradient
                  `}
                  onClick={() => handleAgentClick(agent.title, agent.id)}
                >
                  <CardContent className="p-3 h-full flex flex-row items-center gap-3">
                    <div className="flex items-center justify-center w-[63px] h-[61px] shrink-0 p-2 rounded-[9px] bg-[#2F2E2E80]">
                      <Image
                        src={`${assetPrefix}/assets/images/${agent.icon}`}
                        alt="Agent Icon"
                        width={45}
                        height={45}
                        className="block"
                      />
                    </div>

                    <div>
                      <h3 className="font-light text-foreground text-base leading-tight">
                        {agent.title}
                      </h3>
                    </div>
                  </CardContent>
                </GradientCard>

              )
            })}
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto">
          {projects.length > 0 && (            
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[12.07px] font-medium text-foreground uppercase tracking-wider">RECENT PROJECTS</h2>
              <button
                onClick={() => router.push("/projects")}
                className="text-foreground hover:text-foreground/80 text-sm font-medium flex items-center gap-1 cursor-pointer"
              >
                VIEW ALL <span>→</span>
              </button>
            </div>
          )}
          <div className="relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.slice(0, 3).map((project, ind) => {
                // Generate a random but consistent image index based on project ID
                const getRandomImage = () => {
                  let hash = 0
                  for (let i = 0; i < project.ProjectID.length; i++) {
                    hash = (hash << 5) - hash + project.ProjectID.charCodeAt(i)
                    hash |= 0
                  }
                  return imageList[Math.abs(hash) % imageList.length]
                }

                return (
                  <Card
                    onClick={() => handleProjectClick(project)}
                    key={ind}
                    className="group relative bg-background border-border hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                  >
                    <div className="flex h-[200px]">
                      {/* Left side - Project image */}

                      <div className="w-[100px] h-full flex-shrink-0 relative">
                        <Image
                          src={`${assetPrefix}/assets/images/` + getRandomImage()}
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
                          <div className="flex items-center gap-1 text-[13px] text-[#75A5ED] mb-3">
                            <span className="inline-block">⚡</span>
                            <span>{project.AIAgent}</span>
                          </div>
                          <p className="text-[13px] text-muted-foreground leading-relaxed">
                            {new DOMParser()
                              .parseFromString(project.Summary, "text/html")
                              .body.textContent
                              ?.slice(0, 75) + "..."}{/* limit to 120 chars */}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex -space-x-2">
                                  {(sahredUsers[project.ProjectID] || []).slice(0, 3).map((name: string, idx: number) => {
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
                                  {(sahredUsers[project.ProjectID] || []).length > 0 ? (
                                    <ul className="space-y-1">
                                      {(sahredUsers[project.ProjectID] || []).map((name: string, idx: number) => (
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
                            <div>
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
                            </div>
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
                    <div
                      className="underline-gradient"></div>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
