"use client"

import type React from "react"
import { useState } from "react"
import { usePathname } from "next/navigation"
import MiniSidebar from "./mini-sidebar"
import Sidebar from "./sidebar"
import Topbar from "./topbar"
import DashboardContent from "./dashboard-content"
import ProjectSidebar from "./project-sidebar"

export default function DashboardLayout({
  content,
  activeSection,
}: { content?: React.ReactNode; activeSection?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const domainOnly = segments.length <= 1;
  const isProjectPage = pathname?.includes("/projects/") && pathname?.includes("/detail")

  return (
    // <div className="flex h-screen bg-background">
    <div className="flex h-screen bg-transparent">

      {/* <MiniSidebar activeSection={activeSection || "explore"} /> */}

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* <Topbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} /> */}

        <div className="flex flex-1 overflow-hidden">
          {isProjectPage ? (
            <ProjectSidebar />
          ) :

            domainOnly ? null : (
              <ProjectSidebar />
              // <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
            )}

          {/* Content */}
          <main className="flex-1 overflow-auto scrollbar-hide">{content || <DashboardContent />}</main>
        </div>
      </div>
    </div>
  )
}
