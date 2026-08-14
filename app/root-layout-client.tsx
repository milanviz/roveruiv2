"use client"

import "@/lib/mock-fetch"
import type React from "react"
import { useState } from "react"
import MiniSidebar from "@/components/mini-sidebar"
import Topbar from "@/components/topbar"

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen bg-transparent">
      {/* Mini Sidebar - Always Visible */}
      <MiniSidebar />

      {/* Main Layout */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar - Always Visible */}
        <Topbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        {/* Content Area */}
        <div className="flex-1 overflow-auto scrollbar-hide">
          {children}
        </div>
      </div>
    </div>
  )
}
