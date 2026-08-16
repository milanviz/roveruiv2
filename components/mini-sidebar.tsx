"use client"

import { type LucideIcon } from "lucide-react"
import { Image, Link } from "@/lib/spa-router"
import { usePathname } from "@/lib/spa-router"
import { LogOut } from "lucide-react"
import { assetPath } from "@/lib/env"
import { signOutDemo } from "@/lib/static-auth"

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

export default function MiniSidebar({ className = "", onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname()

  const handleSignOut = () => {
    signOutDemo()
  }

  return (
    <aside className={`w-20 bg-sidebar border-r border-sidebar-border flex-col items-center py-3 gap-4 flex-shrink-0 ${className}`} aria-label="Primary navigation">
      {/* Mini Logo */}
      <Link href="/" onClick={onNavigate} className="focus-ring rounded-lg">
        <div className="w-20 h-[49px] pb-2 flex items-center justify-center cursor-pointer border-b border-border">
          <Image
            src={assetPath("icons/rover_icon.svg")}
            alt="Mini Logo"
            width={24}
            height={24}
          />
        </div>
      </Link>

      {/* Mini Navigation */}
      <nav className="flex flex-col gap-4 flex-1">
        {miniNavItems.map((item) => {
          const isActive = item.id === "explore" ? pathname === "/" : item.id === "projects" ? pathname.startsWith("/projects") && !pathname.startsWith("/projects/project-create") : pathname.startsWith(item.href)
          const href = item.href

          return (
            <Link
              key={item.id}
              href={href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className="focus-ring flex flex-col items-center gap-1 mb-2 rounded-lg"
            >
              <span
                className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${isActive
                  ? "container-gradient text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-[#2F2E2EB3] hover:text-sidebar-primary bg-[#2F2E2E80]"
                  }`}
              >
                <Image
                  src={assetPath(`icons/${item.icon}`)}
                  alt={item.label}
                  width={18}
                  height={18}
                />
              </span>

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
          className="focus-ring w-11 h-11 rounded-lg flex items-center justify-center transition-colors cursor-pointer text-sidebar-foreground hover:bg-[#2F2E2EB3] hover:text-sidebar-primary bg-[#2F2E2E80]"
          aria-label="Sign out"
        >
          <LogOut size={18} />
        </button>
        <span className="text-xs text-sidebar-foreground text-center leading-tight">
          Sign out
        </span>
      </div>
    </aside>
  )
}
