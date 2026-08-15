import DashboardContent from "@/components/dashboard-content"
import MiniSidebar from "@/components/mini-sidebar"
import ProjectCreate from "@/components/project-create"
import ProjectDetail from "@/components/project-detail"
import ProjectLists from "@/components/project-lists"
import ProjectSidebar from "@/components/project-sidebar"
import SavedInsightsContent from "@/components/saved-insights"
import Topbar from "@/components/topbar"
import AuthProvider from "@/components/auth-provider"
import CommonHeader from "@/components/common-header"
import { LanguageProvider } from "@/lib/language-context"
import { usePathname } from "@/lib/spa-router"
import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Toaster } from "sonner"
import LoginPage from "@/components/login-page"
import { AUTH_CHANGE_EVENT, isDemoAuthenticated } from "@/lib/static-auth"

function CurrentPage() {
  const pathname = usePathname()
  const projectPage = pathname.startsWith("/projects/")
  const showProjectSidebar = projectPage && !pathname.startsWith("/projects/project-create")
  const showCommonHeader = pathname.startsWith("/projects/insights")

  let page = <DashboardContent />
  if (pathname === "/projects" || pathname === "/projects/") page = <ProjectLists />
  else if (pathname.startsWith("/projects/project-create")) page = <ProjectCreate />
  else if (pathname.startsWith("/projects/ask-rover")) page = <ProjectDetail />
  else if (pathname.startsWith("/projects/insights")) page = <SavedInsightsContent />

  return (
    <div className="flex flex-1 overflow-hidden">
      {showProjectSidebar && <ProjectSidebar className="hidden lg:flex" />}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {showCommonHeader && <CommonHeader />}
        <main className="flex-1 overflow-auto scrollbar-hide">{page}</main>
      </div>
    </div>
  )
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authenticated, setAuthenticated] = useState(isDemoAuthenticated)
  const pathname = usePathname()

  useEffect(() => {
    const updateAuthentication = () => setAuthenticated(isDemoAuthenticated())
    window.addEventListener(AUTH_CHANGE_EVENT, updateAuthentication)
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, updateAuthentication)
  }, [])

  useEffect(() => setSidebarOpen(false), [pathname])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [sidebarOpen])

  if (!authenticated) return <LoginPage />

  return (
    <LanguageProvider>
      <AuthProvider>
        <div className="relative z-10 flex h-dvh min-h-0 bg-transparent">
          <MiniSidebar className="hidden md:flex" />
          {sidebarOpen && (
            <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
              <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
              <div className="relative flex h-full w-[min(88vw,340px)] bg-[#111114] shadow-2xl">
                <MiniSidebar className="flex" onNavigate={() => setSidebarOpen(false)} />
                {pathname.startsWith("/projects/") && !pathname.startsWith("/projects/project-create") && <ProjectSidebar className="min-w-0 flex-1 border-r-0" onNavigate={() => setSidebarOpen(false)} />}
                <button onClick={() => setSidebarOpen(false)} aria-label="Close navigation" className="focus-ring absolute right-3 top-3 flex size-10 items-center justify-center rounded-lg bg-white/5 text-white"><X size={19} /></button>
              </div>
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Topbar menuOpen={sidebarOpen} onMenuClick={() => setSidebarOpen((open) => !open)} />
            <CurrentPage />
          </div>
          <Toaster richColors position="top-right" theme="dark" />
        </div>
      </AuthProvider>
    </LanguageProvider>
  )
}
