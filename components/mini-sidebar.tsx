"use client"

import { type LucideIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { APP_CONFIG } from "@/app/config/config"
import { LogOut } from "lucide-react"

interface MiniNavItem {
  icon: string | LucideIcon
  label: string
  id: string
  href: string
}

const miniNavItems: MiniNavItem[] = [
  { icon: "sparkle.svg", label: "Explore", id: "explore", href: "/" },
  { icon: "folder-white.svg", label: "Projects", id: "projects", href: "/projects" },
  { icon: "plus.svg", label: "New", id: "new", href: "/projects/project-create" },
]

export default function MiniSidebar() {
  const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX || ""

  // ✅ Stable server + client initial render
  const [activeId, setActiveId] = useState<string>("explore")
  const [mounted, setMounted] = useState(false)

  // ✅ Run ONLY on client after hydration
  useEffect(() => {
    setMounted(true)

    try {
      const stored = sessionStorage.getItem("miniSidebarActive")
      if (stored) {
        setActiveId(stored)
      }
    } catch { }
  }, [])

  // ✅ Persist active menu
  useEffect(() => {
    if (!mounted) return
    try {
      sessionStorage.setItem("miniSidebarActive", activeId)
    } catch { }
  }, [activeId, mounted])

  // Render placeholder skeleton to prevent layout shift during hydration
  if (!mounted) {
    return (
      <div className="w-20 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-3 gap-4 flex-shrink-0">
        {/* Placeholder to maintain layout dimensions during hydration */}
        <div className="w-20 h-[49px] pb-2 flex items-center justify-center border-b border-border" />
      </div>
    )
  }

  const handleSignOut = () => {
    localStorage.clear()
    sessionStorage.clear()

    // Clear cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
    })

    window.location.href = APP_CONFIG.PUBLIC_API_URL + "user.signout"
  }

  return (
    <div className="w-20 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-3 gap-4 flex-shrink-0">
      {/* Mini Logo */}
      <Link href={`/?=${Date.now()}`} onClick={() => setActiveId("explore")}>
        <div className="w-20 h-[49px] pb-2 flex items-center justify-center cursor-pointer border-b border-border">
          <Image
            src={`${assetPrefix}/assets/icons/rover_icon.svg`}
            alt="Mini Logo"
            width={24}
            height={24}
          />
        </div>
      </Link>

      {/* Mini Navigation */}
      <nav className="flex flex-col gap-4 flex-1">
        {miniNavItems.map((item) => {
          const isActive = activeId === item.id
          const href = item.href === "/" ? `/?=${Date.now()}` : item.href

          return (
            <Link
              key={item.id}
              href={href}
              onClick={() => setActiveId(item.id)}
              className="flex flex-col items-center gap-1 mb-2"
            >
              <button
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${isActive
                  ? "container-gradient text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-[#2F2E2EB3] hover:text-sidebar-primary bg-[#2F2E2E80]"
                  }`}
              >
                <Image
                  src={`${assetPrefix}/assets/icons/${item.icon}`}
                  alt={item.label}
                  width={18}
                  height={18}
                />
              </button>

              <span className="text-xs text-sidebar-foreground text-center leading-tight">
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-col items-center gap-1 mb-2">
        <button
          onClick={handleSignOut}
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer text-sidebar-foreground hover:bg-[#2F2E2EB3] hover:text-sidebar-primary bg-[#2F2E2E80]"
        >
          <LogOut size={18} />
        </button>
        <span className="text-xs text-sidebar-foreground text-center leading-tight">
          Sign out
        </span>
      </div>
    </div>
  )
}
