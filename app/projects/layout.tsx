"use client"

import type React from "react"
import { useState } from "react"
import { usePathname } from "next/navigation"
import MiniSidebar from "@/components/mini-sidebar"
import Topbar from "@/components/topbar"
import ProjectSidebar from "@/components/project-sidebar"
import CommonHeader from "@/components/common-header"

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pathname = usePathname()

  console.log("Current Pathname:", pathname);

  // Hide ProjectSidebar only on /projects
  const showProjectSidebar = pathname != "/projects/" && pathname != "/projects";
  const showCommonHeader = pathname.includes("/insights");

  return (
    <div className="h-[calc(100vh-61px)] flex bg-transparent">
      {/* <MiniSidebar activeSection="projects" /> */}

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* <Topbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} /> */}

        <div className="flex flex-1 overflow-hidden">
          {showProjectSidebar && <ProjectSidebar />}
          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            {showCommonHeader && <CommonHeader />}
            <main className="flex-1 flex flex-col overflow-hidden relative">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
