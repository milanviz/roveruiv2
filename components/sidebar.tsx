"use client"

import Link from "next/link"
import {
  type LucideIcon,
  Compass,
  Heart,
  Folder,
  Plus,
  HelpCircle,
  Shield,
  BookOpen,
  Video,
  Lightbulb,
  Newspaper,
  Bell,
} from "lucide-react"

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

interface NavSection {
  label: string
  items: NavItem[]
}

interface NavItem {
  label: string
  icon: LucideIcon
  href: string
}



export default function Sidebar({ isOpen }: SidebarProps) {
  const navSections: NavSection[] = [
  {
    label: "Explore",
    items: [
      { label: "Explore Rover", icon: Compass, href: "/" },
      { label: "Wellness Hub", icon: Heart, href: "/" },
    ],
  },
  {
    label: "Projects",
    items: [
      { label: "Projects", icon: Folder, href: "/" },
      { label: "New", icon: Plus, href: "/" },
    ],
  },
  {
    label: "Resources & Learning",
    items: [
      { label: "Videos", icon: Video, href: "/" },
      { label: "Mind Map", icon: Lightbulb, href: "/" },
      { label: "Knowledge Base", icon: Compass, href: "/" },
    ],
  },
  {
    label: "Updates & Insights",
    items: [
      { label: "News", icon: Newspaper, href: "/" },
      { label: "Blog", icon: BookOpen, href: "/" },
      { label: "Announcements", icon: Bell, href: "/" },
    ],
  },
]

  return (
    <aside
      className={`bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col overflow-hidden ${isOpen ? "w-64" : "w-0"
        }`}
    >
      <div className="flex flex-col gap-4 p-4 flex-shrink-0">
        <button className="w-full bg-primary text-sidebar-primary-foreground px-3 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 justify-center">
          <Plus size={16} />
          Get Started
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-6 space-y-8 scrollbar-hide">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="text-xs font-semibold text-sidebar-accent-foreground uppercase tracking-widest mb-3 px-2">
              {section.label}
            </p>
            <div className="space-y-1">
              {section.items.map((item, idx) => {
                const Icon = item.icon
                return (
                  <Link
                    key={`${section.label}-${item.href}-${idx}`}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary group"
                  >
                    <Icon size={20} className="flex-shrink-0" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-sidebar-border p-2">
        <div className="space-y-1">
          <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
            <HelpCircle size={20} className="flex-shrink-0" />
            <span className="text-sm">Help</span>
          </button>
          <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
            <Shield size={20} className="flex-shrink-0" />
            <span className="text-sm">Privacy & Policy</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
