"use client"

import React, { useState, useEffect, useRef, memo, type ReactNode } from "react"
import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  User, 
  MapPin, 
  Bookmark, 
  BookOpen, 
  ArrowRight, 
  Film,
  Clock,
  Layers,
  Activity,
  Loader2,
  RefreshCw
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import type { FilmAnalysisSection } from "@/lib/film-workflows"
import { FILM_ANALYSIS_SECTIONS, fetchSummarizeWorkflow } from "@/lib/film-workflows"
import { buildSectionPromptTasks, FILM_ANALYSIS_TASKS, tasksForSection, type FilmAnalysisTask } from "@/lib/film-prompts"
import { useVizruRealtime } from "@/lib/use-vizru-realtime"

interface FilmWorkspaceProps {
  projectId: string
  scriptId?: string | null
  projectName: string
  userId?: string | null
  userEmail?: string | null
  fileName?: string | null
  fileUrl?: string | null
  generateIfMissing?: boolean
  onAskRover: (question: string) => void
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TAB_TO_SECTION: Record<string, FilmAnalysisSection> = {
  Overview: "overview",
  Story: "story",
  Characters: "characters",
  Commercial: "commercial",
  Production: "production",
  Development: "development",
  Greenlight: "greenlight",
}

const AUTO_GENERATED_SECTIONS: FilmAnalysisSection[] = ["overview", "story", "characters"]
const MANUAL_GENERATED_SECTIONS: FilmAnalysisSection[] = ["commercial", "production", "development", "greenlight"]

const SECTION_TO_TAB = Object.fromEntries(
  Object.entries(TAB_TO_SECTION).map(([tab, section]) => [section, tab]),
) as Record<FilmAnalysisSection, string>

const SECTION_LABELS: Record<string, string> = {
  overview: "Overview & Readiness",
  story: "Story & Structure",
  characters: "Character Breakdown",
  commercial: "Commercial Viability",
  production: "Production Analysis",
  development: "Development Notes",
  greenlight: "Greenlight Decision",
}

const CURRENT_SECTION_FIELDS: Partial<Record<FilmAnalysisSection, string[]>> = {
  commercial: ["commercialViability", "grossPredictedRevenue", "optimalReleaseWindow", "collectionForecast"],
  production: ["productionFeasibility"],
  development: ["developmentImpact"],
  greenlight: ["decisionMatrix", "investmentOutlook"],
}

const sectionNeedsRefresh = (section: FilmAnalysisSection, payload?: Record<string, unknown>) =>
  !!payload && (CURRENT_SECTION_FIELDS[section] || []).some((field) => !(field in payload))

const taskHasData = (taskKey: string, payload?: Record<string, unknown>) => {
  if (!payload) return false
  const fields: Record<string, string[]> = {
    overview: ["recommendation"],
    story: ["storyScorecard"],
    characters: ["charactersList"],
    "commercial-core": ["commercialViability"],
    "commercial-forecast": ["grossPredictedRevenue", "collectionForecast"],
    "commercial-audience": ["comparables", "marketingHooks"],
    "production-logistics": ["productionSummary", "locationsList"],
    "production-budget": ["productionFeasibility", "budgetBreakdown"],
    "development-notes": ["developmentNotes", "rewriteNotes"],
    "development-impact": ["developmentImpact", "draftComparison"],
    "greenlight-decision": ["recommendation", "whyItWorks"],
    "greenlight-actions": ["decisionMatrix", "investmentOutlook"],
  }
  return (fields[taskKey] || []).some((field) => field in payload)
}

const taskStatesFromSections = (
  sections: Partial<Record<FilmAnalysisSection, Record<string, unknown>>>,
) => Object.fromEntries(
  FILM_ANALYSIS_TASKS
    .filter((item) => taskHasData(item.key, sections[item.section]))
    .map((item) => [item.socketTag, "ready" as const]),
)

/** Animated shimmer bar used inside skeleton layouts. */
function ShimmerBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-md bg-gradient-to-r from-[#1a1a1f] via-[#252530] to-[#1a1a1f] animate-shimmer ${className}`}
      style={{ backgroundSize: "200% 100%" }}
    />
  )
}

function AnalysisGroupSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className={`grid gap-6 ${cards === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border bg-[#131315] p-6 space-y-4">
          <ShimmerBlock className="h-3 w-28" />
          <ShimmerBlock className="h-9 w-32" />
          <ShimmerBlock className="h-3 w-full opacity-60" />
          <ShimmerBlock className="h-3 w-4/5 opacity-40" />
        </div>
      ))}
    </div>
  )
}

function RefreshAnalysisBanner({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[#75A5ED]/25 bg-[#75A5ED]/8 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-100">New analysis metrics are available</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Refresh this dashboard to add the latest forecast and decision cards. Existing insights remain visible while it runs.
        </p>
      </div>
      <button onClick={onRefresh} className="focus-ring inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#75A5ED]/30 bg-[#75A5ED]/15 px-4 text-xs font-semibold text-[#9bc1f7] hover:bg-[#75A5ED]/25">
        <RefreshCw className="size-3.5" /> Refresh metrics
      </button>
    </div>
  )
}

const numberOrZero = (value: unknown) => {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""))
  return Number.isFinite(number) ? number : 0
}

const crore = (value: unknown) => `₹${numberOrZero(value).toFixed(1)} Cr`

function SectionSkeleton({ sectionName }: { sectionName?: string }) {
  const label = sectionName ? SECTION_LABELS[sectionName] || sectionName : "this section"
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <ShimmerBlock className="h-5 w-48" />
          <ShimmerBlock className="h-3 w-72 opacity-60" />
        </div>
        <ShimmerBlock className="h-8 w-24 rounded-full" />
      </div>

      {/* Main card skeleton — score + bars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#131315] border border-border rounded-xl p-6 space-y-5">
          <ShimmerBlock className="h-3 w-32" />
          <div className="flex items-baseline gap-3">
            <ShimmerBlock className="h-12 w-20" />
            <ShimmerBlock className="h-4 w-28 opacity-50" />
          </div>
          <div className="space-y-2">
            <ShimmerBlock className="h-3 w-full" />
            <ShimmerBlock className="h-3 w-5/6" />
            <ShimmerBlock className="h-3 w-4/6" />
          </div>
          <div className="flex gap-4 pt-1">
            <ShimmerBlock className="h-3 w-24" />
            <ShimmerBlock className="h-3 w-28" />
          </div>
        </div>

        {/* Side card — aspect scores */}
        <div className="bg-[#131315] border border-border rounded-xl p-5 space-y-4">
          <ShimmerBlock className="h-3 w-28" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3">
              <ShimmerBlock className="h-3 w-24 shrink-0" />
              <ShimmerBlock className="h-2.5 flex-1 rounded-full" />
              <ShimmerBlock className="h-3 w-8 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom section skeleton — two column cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#131315] border border-border rounded-xl p-5 space-y-4">
          <ShimmerBlock className="h-4 w-36" />
          <ShimmerBlock className="h-3 w-full" />
          <div className="space-y-3 pt-1">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3 items-start">
                <ShimmerBlock className="h-8 w-8 rounded-md shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <ShimmerBlock className="h-3 w-3/4" />
                  <ShimmerBlock className="h-2.5 w-full opacity-50" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#131315] border border-border rounded-xl p-5 space-y-4">
          <ShimmerBlock className="h-4 w-40" />
          <div className="space-y-3 pt-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <ShimmerBlock className="h-3 w-20 shrink-0" />
                <ShimmerBlock className="h-2.5 flex-1 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status line */}
      <div className="flex items-center justify-center gap-3 pt-4 pb-2">
        <Loader2 className="w-4 h-4 animate-spin text-[#75A5ED]" />
        <p className="text-sm text-muted-foreground">
          Analyzing screenplay — generating <span className="text-slate-300 font-medium">{label}</span>…
        </p>
      </div>
    </div>
  )
}

function SectionStatus({
  loading,
  error,
  onRetry,
  ready,
  hasData,
  children,
  sectionName,
}: {
  loading: boolean
  error: string | null
  onRetry: () => void
  ready: boolean
  hasData: boolean
  children: ReactNode
  sectionName?: string
}) {
  if (error && !ready && !hasData && !loading) {
    const label = sectionName ? SECTION_LABELS[sectionName] || sectionName : "this section"
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-amber-400" />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-sm font-medium text-slate-200">
            Couldn&apos;t generate {label}
          </p>
          <p className="text-xs text-muted-foreground max-w-md">{error}</p>
        </div>
        <button
          onClick={onRetry}
          className="mt-1 px-4 py-2 text-xs font-medium rounded-lg border border-[#75A5ED]/30 bg-[#75A5ED]/10 hover:bg-[#75A5ED]/20 text-[#75A5ED] flex items-center gap-2 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry Analysis
        </button>
      </div>
    )
  }

  if (!ready && !hasData) {
    return (
      <div className="relative">
        <SectionSkeleton sectionName={sectionName} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-6">
          {loading && (
            <span className="inline-flex items-center gap-2 text-xs text-[#8cb6f4]">
              <Loader2 className="size-3.5 animate-spin" /> Updating analysis groups…
            </span>
          )}
          {error && (
            <span className="inline-flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle className="size-3.5" /> {error}
            </span>
          )}
        </div>
        <button
          onClick={onRetry}
          title="Force retry analysis for this section"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#1a1a1f] border border-border text-muted-foreground hover:text-foreground hover:bg-[#252530] transition-all cursor-pointer shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {error ? "Retry Missing Analysis" : "Re-analyze Section"}
        </button>
      </div>
      {children}
    </div>
  )
}

const FilmWorkspace = memo(function FilmWorkspace({
  projectId,
  scriptId,
  projectName,
  userId,
  userEmail,
  fileName,
  fileUrl,
  generateIfMissing = false,
  onAskRover,
  activeTab,
  setActiveTab
}: FilmWorkspaceProps) {
  const [metadata, setMetadata] = useState({
    title: projectName || "",
    language: "",
    genre: "",
    targetMarket: "",
    releaseStrategy: "",
    expectedBudget: "",
    pages: 0,
    runtimeMinutes: 0,
  })
  const [analysisReport, setAnalysisReport] = useState<any>({})
  const [loadingSections, setLoadingSections] = useState<Record<string, boolean>>({})
  const [sectionErrors, setSectionErrors] = useState<Record<string, string | null>>({})
  const [readySections, setReadySections] = useState<Record<string, boolean>>({})
  const [taskStates, setTaskStates] = useState<Record<string, "queued" | "loading" | "ready" | "error">>({})
  const [hydrated, setHydrated] = useState(false)
  const [generationEnabled, setGenerationEnabled] = useState(false)
  const [hydrationAttempt, setHydrationAttempt] = useState(0)
  
  const inflightRef = useRef<Map<string, Promise<void>>>(new Map())
  const taskQueuesRef = useRef<Map<FilmAnalysisSection, Array<FilmAnalysisTask & { prompt: string }>>>(new Map())
  const sectionPayloadsRef = useRef<Partial<Record<FilmAnalysisSection, Record<string, unknown>>>>({})
  const dashboardSavedRef = useRef(false)
  const readySectionsRef = useRef(readySections)
  readySectionsRef.current = readySections
  const taskStatesRef = useRef(taskStates)
  taskStatesRef.current = taskStates
  const fileUrlRef = useRef<string | null>(fileUrl || null)

  useEffect(() => {
    if (fileUrl) fileUrlRef.current = fileUrl
  }, [fileUrl])

  const applyMetadata = (parsed: Record<string, any>) => {
    setMetadata(prev => ({
      ...prev,
      title: parsed.title || parsed.screenplay_title || parsed.file_name || prev.title,
      language: parsed.language || parsed.screenplay_language || prev.language,
      genre: parsed.genre || prev.genre,
      targetMarket: parsed.targetMarket || parsed.target_market || parsed.target_market_industry || prev.targetMarket,
      releaseStrategy: parsed.releaseStrategy || parsed.release_strategy || prev.releaseStrategy,
      expectedBudget: parsed.expectedBudget || parsed.expected_budget || prev.expectedBudget,
      pages: parsed.pages || parsed.attributes?.pages || prev.pages,
      runtimeMinutes: parsed.runtimeMinutes || parsed.attributes?.runtimeMinutes || prev.runtimeMinutes,
    }))
  }

  const persistPartialProgress = () => {
    if (!projectId) return
    try {
      localStorage.setItem(`film_dashboard_progress_${projectId}`, JSON.stringify({
        project_id: projectId,
        file_full_url: fileUrlRef.current || "",
        sections: sectionPayloadsRef.current,
      }))
    } catch (error) {
      console.error("Failed to cache film dashboard progress:", error)
    }
  }

  useEffect(() => {
    if (projectName) {
      setMetadata(prev => ({ ...prev, title: projectName }));
    }
  }, [projectName]);

  const triggerNextTask = async (section: FilmAnalysisSection): Promise<void> => {
    if (tasksForSection(section).some((task) => inflightRef.current.has(task.socketTag))) return
    const queue = taskQueuesRef.current.get(section) || []
    const nextTask = queue[0]
    if (!nextTask) {
      taskQueuesRef.current.delete(section)
      return
    }

    taskQueuesRef.current.set(section, queue.slice(1))
    const nextTaskStates = { ...taskStatesRef.current, [nextTask.socketTag]: "loading" as const }
    taskStatesRef.current = nextTaskStates
    setTaskStates(nextTaskStates)
    setLoadingSections(prev => ({ ...prev, [section]: true }))
    inflightRef.current.set(nextTask.socketTag, Promise.resolve())

    try {
      await fetchSummarizeWorkflow(fileUrlRef.current!, nextTask.prompt, nextTask.socketTag)
    } catch (error: any) {
      console.error(`Failed to trigger ${nextTask.key}:`, error)
      failTask(nextTask, error?.message || `Failed to start ${nextTask.key.replaceAll("-", " ")}.`)
    }
  }

  const failTask = (task: FilmAnalysisTask, message: string) => {
    const nextTaskStates = { ...taskStatesRef.current, [task.socketTag]: "error" as const }
    taskStatesRef.current = nextTaskStates
    setTaskStates(nextTaskStates)
    inflightRef.current.delete(task.socketTag)
    setLoadingSections(prev => ({
      ...prev,
      [task.section]: tasksForSection(task.section).some((item) =>
        nextTaskStates[item.socketTag] === "loading" || nextTaskStates[item.socketTag] === "queued"
      ),
    }))
    setSectionErrors(prev => ({ ...prev, [task.section]: message }))
    void triggerNextTask(task.section)
  }

  /** Merge one task's socket payload into its parent dashboard section. */
  const applyTaskPayload = (task: FilmAnalysisTask, payload: any) => {
    const outputStr: unknown = payload?.output ?? payload
    let parsed: Record<string, any> | null = null

    if (outputStr && typeof outputStr === "string" && outputStr.trim() !== "") {
      try { parsed = JSON.parse(outputStr) } catch { parsed = null }
    } else if (outputStr && typeof outputStr === "object") {
      parsed = outputStr as Record<string, any>
    }

    if (!parsed) {
      failTask(task, `No data returned for ${task.key.replaceAll("-", " ")}.`)
      return
    }

    setAnalysisReport((prev: any) => {
      const next = { ...prev, ...parsed }
      try { localStorage.setItem("temp_film_analysis", JSON.stringify(next)) } catch { }
      return next
    })
    sectionPayloadsRef.current[task.section] = {
      ...(sectionPayloadsRef.current[task.section] || {}),
      ...parsed,
    }
    persistPartialProgress()
    applyMetadata(parsed)

    const nextTaskStates = { ...taskStatesRef.current, [task.socketTag]: "ready" as const }
    taskStatesRef.current = nextTaskStates
    setTaskStates(nextTaskStates)
    inflightRef.current.delete(task.socketTag)

    const sectionTasks = tasksForSection(task.section)
    const complete = sectionTasks.every((item) => nextTaskStates[item.socketTag] === "ready")
    const stillLoading = sectionTasks.some((item) =>
      nextTaskStates[item.socketTag] === "loading" || nextTaskStates[item.socketTag] === "queued"
    )
    setLoadingSections(prev => ({ ...prev, [task.section]: stillLoading }))
    if (complete) {
      setReadySections(prev => {
        const next = { ...prev, [task.section]: true }
        readySectionsRef.current = next
        return next
      })
      setSectionErrors(prev => ({ ...prev, [task.section]: null }))
    }
    void triggerNextTask(task.section)
  }

  // Every prompt task has a stable realtime tag, so responses can arrive out of order.
  FILM_ANALYSIS_TASKS.forEach(task => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useVizruRealtime(task.socketTag, (payload: any) => {
      console.log(`[FilmWorkspace] socket → ${task.socketTag}`, payload)
      applyTaskPayload(task, payload)
    })
  })

  const analyzeSection = async (section: FilmAnalysisSection, force = false) => {
    if (!fileUrlRef.current) {
      // Try to fetch fileUrl if missing
      if (scriptId) {
        try {
          const { fetchMetadataWorkflow } = await import('@/lib/film-workflows');
          const { fileUrl } = await fetchMetadataWorkflow(scriptId);
          if (fileUrl) fileUrlRef.current = fileUrl;
        } catch(e) {}
      }
      
      if (!fileUrlRef.current) {
         setSectionErrors(prev => ({ ...prev, [section]: "Missing file URL for analysis." }));
         return;
      }
    }
    
    if (!force && readySectionsRef.current[section]) return;
    const sectionTasks = tasksForSection(section)
    if (sectionTasks.some((task) => inflightRef.current.has(task.socketTag)) || taskQueuesRef.current.has(section)) return;

    setLoadingSections(prev => ({ ...prev, [section]: true }));
    const retryFailedOnly = force && !!sectionErrors[section]
    setSectionErrors(prev => ({ ...prev, [section]: null }));
    if (force) {
      dashboardSavedRef.current = false
      setReadySections(prev => {
        const next = { ...prev, [section]: false };
        readySectionsRef.current = next;
        return next;
      });
    }

    try {
      const allTasks = buildSectionPromptTasks(section, {
          title: metadata.title,
          language: metadata.language,
          genre: metadata.genre,
          target_market: metadata.targetMarket,
          release_strategy: metadata.releaseStrategy,
          expected_budget: metadata.expectedBudget,
      });
      const tasksToRun = retryFailedOnly
        ? allTasks.filter((task) => taskStatesRef.current[task.socketTag] === "error")
        : allTasks

      const nextTaskStates = { ...taskStatesRef.current }
      tasksToRun.forEach((task) => {
        nextTaskStates[task.socketTag] = "queued"
      })
      taskStatesRef.current = nextTaskStates
      setTaskStates(nextTaskStates)
      taskQueuesRef.current.set(section, tasksToRun)

      // Start one task only. Its socket result advances this section's queue.
      await triggerNextTask(section)
    } catch (err: any) {
      console.error(`Failed to trigger analysis for ${section}:`, err);
      setSectionErrors(prev => ({ ...prev, [section]: err.message || "Failed to start analysis" }));
      setLoadingSections(prev => ({ ...prev, [section]: false }));
    }
    // Loading stays true until every sequential task's socket payload arrives.
  }

  // Load a saved dashboard before fetching metadata or triggering generation.
  useEffect(() => {
    let mounted = true;
    const resolvedEmail = userEmail || localStorage.getItem("rover_user_email") || ""

    setHydrated(false)
    setGenerationEnabled(false)
    setReadySections({})
    readySectionsRef.current = {}
    setTaskStates({})
    taskStatesRef.current = {}
    sectionPayloadsRef.current = {}
    dashboardSavedRef.current = false
    inflightRef.current.clear()
    taskQueuesRef.current.clear()
    fileUrlRef.current = fileUrl || null
    setAnalysisReport({})
    setSectionErrors({})
    setLoadingSections({})
    setMetadata({
      title: projectName || "",
      language: "",
      genre: "",
      targetMarket: "",
      releaseStrategy: "",
      expectedBudget: "",
      pages: 0,
      runtimeMinutes: 0,
    })
    
    try {
      const tempMetaRaw = localStorage.getItem("temp_film_metadata");
      const tempMeta = JSON.parse(tempMetaRaw || "null")
      if (tempMeta) {
        const parsed = tempMeta;
        if (parsed.scriptId === scriptId) {
          applyMetadata(parsed);
        }
      }

      const tempAnalysis = localStorage.getItem("temp_film_analysis");
      const belongsToCurrentProject =
        tempMeta?.projectId === projectId || (scriptId && tempMeta?.scriptId === scriptId)
      if (tempAnalysis && belongsToCurrentProject) {
        const parsed = JSON.parse(tempAnalysis);
        setAnalysisReport(parsed);
      }
    } catch(e) {}
    
    const hydrate = async () => {
      const workflows = await import('@/lib/film-workflows')
      const applySavedDashboard = (saved: Awaited<ReturnType<typeof workflows.fetchSavedFilmDashboard>>) => {
        if (!saved) return false
        sectionPayloadsRef.current = saved.sections
        const savedTaskStates = taskStatesFromSections(saved.sections)
        setTaskStates(savedTaskStates)
        taskStatesRef.current = savedTaskStates
        dashboardSavedRef.current = true
        setGenerationEnabled(false)
        if (saved.file_full_url) fileUrlRef.current = saved.file_full_url
        const merged = Object.assign({}, ...FILM_ANALYSIS_SECTIONS.map((section) => saved.sections[section]))
        setAnalysisReport(merged)
        FILM_ANALYSIS_SECTIONS.forEach((section) => applyMetadata(saved.sections[section]))
        const complete = Object.fromEntries(
          FILM_ANALYSIS_SECTIONS.map((section) => [section, true]),
        )
        setReadySections(complete)
        readySectionsRef.current = complete
        setHydrated(true)
        return true
      }

      const applyPartialProgress = (progress: any) => {
        if (!progress?.sections || typeof progress.sections !== "object") return false
        const availableSections = FILM_ANALYSIS_SECTIONS.filter((section) => {
          const value = progress.sections[section]
          return value && typeof value === "object" && !Array.isArray(value)
        })
        if (availableSections.length === 0) return false
        sectionPayloadsRef.current = Object.fromEntries(
          availableSections.map((section) => [section, progress.sections[section]]),
        )
        const partialTaskStates = taskStatesFromSections(sectionPayloadsRef.current)
        setTaskStates(partialTaskStates)
        taskStatesRef.current = partialTaskStates
        if (progress.file_full_url) fileUrlRef.current = progress.file_full_url
        const merged = Object.assign({}, ...availableSections.map((section) => progress.sections[section]))
        setAnalysisReport(merged)
        availableSections.forEach((section) => applyMetadata(progress.sections[section]))
        const complete = Object.fromEntries(availableSections.map((section) => [section, true]))
        setReadySections(complete)
        readySectionsRef.current = complete
        return true
      }

      let savedLookupError: unknown = null
      try {
        const saved = await workflows.fetchSavedFilmDashboard(
          resolvedEmail,
          projectId,
          hydrationAttempt > 0,
        )
        if (!mounted) return
        if (applySavedDashboard(saved)) return
      } catch (error) {
        savedLookupError = error
        console.error("Saved dashboard lookup failed:", error)
      }

      // Preserve the no-regeneration behavior in this browser if the remote
      // read workflow is temporarily unavailable.
      try {
        const cached = JSON.parse(localStorage.getItem(`film_dashboard_${projectId}`) || "null")
        if (mounted && applySavedDashboard(cached)) return
      } catch (error) {
        console.error("Cached dashboard lookup failed:", error)
      }

      try {
        const progress = JSON.parse(localStorage.getItem(`film_dashboard_progress_${projectId}`) || "null")
        if (mounted) applyPartialProgress(progress)
      } catch (error) {
        console.error("Partial dashboard progress lookup failed:", error)
      }

      if (generateIfMissing && scriptId) {
        try {
          const result = await workflows.fetchMetadataWorkflow(scriptId)
          if (!mounted) return
          if (result.metadata) applyMetadata(result.metadata as Record<string, any>)
          if (result.fileUrl) fileUrlRef.current = result.fileUrl
        } catch (error) {
          console.error("Live metadata fetch failed:", error)
        }
      }
      if (!mounted) return

      if (generateIfMissing) {
        setGenerationEnabled(true)
      } else {
        const message = savedLookupError
          ? "Could not load this project's saved analysis. Retry after the connection is restored."
          : "No saved analysis exists for this project."
        setSectionErrors(Object.fromEntries(
          FILM_ANALYSIS_SECTIONS.map((section) => [section, message]),
        ))
      }
      setHydrated(true)
    }

    hydrate()

    return () => { mounted = false; };
  }, [scriptId, projectId, projectName, userEmail, fileUrl, generateIfMissing, hydrationAttempt])

  // Generate only the first three dashboards automatically, in strict order.
  // The remaining dashboards require an explicit user action below.
  useEffect(() => {
    if (!hydrated || !generationEnabled || inflightRef.current.size > 0) return
    const nextSection = AUTO_GENERATED_SECTIONS.find(
      (section) => !readySectionsRef.current[section],
    )
    if (nextSection) analyzeSection(nextSection)
  }, [hydrated, generationEnabled, readySections]);

  // Persist once, after all seven socket responses have filled the dashboard.
  useEffect(() => {
    if (!hydrated || dashboardSavedRef.current || !projectId) return
    const complete = FILM_ANALYSIS_SECTIONS.every(
      (section) => readySections[section] && sectionPayloadsRef.current[section],
    )
    if (!complete || !fileUrlRef.current) return

    const resolvedEmail = userEmail || localStorage.getItem("rover_user_email") || ""
    const resolvedUserId = userId || localStorage.getItem("rover_user_id") || ""
    if (!resolvedEmail || !resolvedUserId) return

    const completedDashboard = {
      user_id: resolvedUserId,
      user_email: resolvedEmail,
      project_id: projectId,
      file_name: fileName || metadata.title || projectName,
      file_full_url: fileUrlRef.current || "",
      sections: sectionPayloadsRef.current as Record<FilmAnalysisSection, Record<string, unknown>>,
    }
    try {
      localStorage.setItem(`film_dashboard_${projectId}`, JSON.stringify(completedDashboard))
    } catch (error) {
      console.error("Failed to cache completed film dashboard:", error)
    }

    dashboardSavedRef.current = true
    import('@/lib/film-workflows').then(({ saveFilmDashboard }) =>
      saveFilmDashboard(completedDashboard),
    ).catch((error) => {
      dashboardSavedRef.current = false
      console.error("Failed to save completed film dashboard:", error)
    })
  }, [readySections, hydrated, projectId, userId, userEmail, fileName, metadata.title, projectName])

  const handleSaveToInsights = (item: { Key: string; Question: string; Answer: string; Tags: string }) => {
    if (typeof window !== "undefined") {
      try {
        const insightsKey = `rover_insights_${projectId}`
        const current = localStorage.getItem(insightsKey)
        const list = current ? JSON.parse(current) : []

        if (list.some((i: any) => i.Key === item.Key)) {
          toast.info("This finding is already saved to insights.")
          return
        }

        const newItem = {
          ProjectID: projectId,
          Source: "Film Intelligence Analysis",
          Key: item.Key,
          QueryType: true,
          SourceID: "film-analysis",
          SourceName: "Film Intelligence Workflow",
          Question: item.Question,
          Answer: item.Answer,
          UpdatedBy: "guest@hirover.ai",
          UpdatedOn: new Date().toISOString(),
          Tags: item.Tags,
          UpVotedCount: 1,
          UpvotedJSON: '["guest@hirover.ai"]',
          SectorFlag: 1,
          VectorFlag: "1",
          RecommendedQuestions: "[]",
          rowID: "row-ins-" + Date.now(),
          jsCodes: [],
          QID: "q-film-" + Date.now(),
          Actions: { messages: [] }
        }

        list.unshift(newItem)
        localStorage.setItem(insightsKey, JSON.stringify(list))
        toast.success("Saved to Insights successfully!")
      } catch (e) {
        console.error("Failed to save insight:", e)
        toast.error("Failed to save to insights.")
      }
    }
  }

  const activeSection = TAB_TO_SECTION[activeTab]
  const sectionLoading = activeSection ? !!loadingSections[activeSection] : false
  const sectionError = activeSection ? sectionErrors[activeSection] || null : null
  const sectionReady = activeSection ? !!readySections[activeSection] : true
  const readyDashboardCount = FILM_ANALYSIS_SECTIONS.filter((section) => readySections[section]).length
  const automaticDashboardsReady = AUTO_GENERATED_SECTIONS.every((section) => !!readySections[section])
  const allDashboardsReady = hydrated && FILM_ANALYSIS_SECTIONS.every((section) => !!readySections[section])

  useEffect(() => {
    if (activeTab === "Ask Rover" && !allDashboardsReady) setActiveTab("Overview")
  }, [activeTab, allDashboardsReady, setActiveTab])

  // --- DATA (Fallback to empty states if not yet analyzed) ---
  const recommendation = analysisReport?.recommendation || {
    status: "—", score: 0, confidence: "—", summary: ""
  }

  const scores = analysisReport?.scores || {
    story: 0, commercial: 0, production: 0, audience: 0, originality: 0, risk: 0
  }

  const storyScorecard = analysisReport?.storyScorecard || null

  const productionSummary = analysisReport?.productionSummary || (analysisReport?.attributes ? {
    shootDays: analysisReport.attributes.shootDays || 0,
    locations: analysisReport.attributes.locations || 0,
    nightScenes: analysisReport.attributes.nightScenes || 0,
    actionSequences: analysisReport.attributes.actionSequences || 0,
    majorCharacters: analysisReport.attributes.majorCast || 0,
    extras: analysisReport.attributes.extras || 0,
    vfxScenes: analysisReport.attributes.vfxScenes || 0,
    songs: analysisReport.attributes.songs || 0
  } : {
    shootDays: 0, locations: 0, nightScenes: 0, actionSequences: 0,
    majorCharacters: 0, extras: 0, vfxScenes: 0, songs: 0
  })

  const risks: any[] = analysisReport?.risks || []

  const opportunities: any[] = analysisReport?.opportunities || []

  const timelineEvents: any[] = (analysisReport?.timelineEvents || []).map((e: any) => ({
    label: e.label || e.title || "",
    page: typeof e.page === "number" ? e.page : parseInt(String(e.page).replace(/\D/g, "")) || 1,
    tension: e.tension || 0,
    desc: e.desc || e.description || ""
  }))

  const tensionPoints: { x: number; y: number; label: string }[] = (() => {
    const source: any[] = analysisReport?.tensionCurve?.length
      ? analysisReport.tensionCurve
      : timelineEvents
    if (!source.length) return []
    return source.map((pt: any, i: number, arr: any[]) => {
      const tension = Number(pt.tension ?? 0)
      const x = arr.length === 1 ? 0 : (i / (arr.length - 1)) * 800
      const y = 200 - Math.max(0, Math.min(100, tension)) * 1.8
      return { x, y, label: String(pt.label || pt.title || "") }
    })
  })()

  const tensionPath = tensionPoints.length
    ? tensionPoints.map((p: { x: number; y: number }, i: number) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ")
    : ""
  const tensionArea = tensionPoints.length
    ? `M 0,200 ${tensionPoints.map((p: { x: number; y: number }) => `L ${p.x},${p.y}`).join(" ")} L 800,200 Z`
    : ""

  const indianCinemaSignals: any[] = analysisReport?.indianCinemaSignals || (analysisReport?.cinemaEvaluation ? [
    { name: "Hero Introduction Block", rating: analysisReport.cinemaEvaluation.heroIntro, explanation: analysisReport.cinemaEvaluation.heroIntroDesc },
    { name: "Interval Cliffhanger", rating: analysisReport.cinemaEvaluation.intervalCliffhanger, explanation: analysisReport.cinemaEvaluation.intervalCliffhangerDesc },
    { name: "Climax Emotional Payoff", rating: analysisReport.cinemaEvaluation.climaxEmotionalPayoff, explanation: analysisReport.cinemaEvaluation.climaxEmotionalPayoffDesc },
    { name: "Mass Moments", rating: analysisReport.cinemaEvaluation.massMoments, explanation: analysisReport.cinemaEvaluation.massMomentsDesc },
    { name: "Songs Integration", rating: analysisReport.cinemaEvaluation.songsIntegration, explanation: analysisReport.cinemaEvaluation.songsIntegrationDesc }
  ] : [])

  const charactersList: any[] = (analysisReport?.charactersList || []).map((c: any) => ({
    name: c.name,
    role: c.role,
    description: c.description || c.desc || "",
    presence: c.presence,
    dialogue: c.dialogue || c.dialogues || "",
    arc: c.arc,
    casting: c.casting,
    goal: c.goal,
    motivation: c.motivation,
    conflict: c.conflict,
    transformation: c.transformation || c.resolution || ""
  }))

  const comparables: any[] = (analysisReport?.comparables || []).map((c: any) => ({
    title: c.title || c.name || "",
    narrative: typeof c.narrative === "string" ? c.narrative : `${c.narrative || c.narrativeSimilarity || 0}%`,
    audience: typeof c.audience === "string" ? c.audience : `${c.audience || c.audienceMatch || 0}%`,
    production: typeof c.production === "string" ? c.production : `${c.production || c.costMatch || 0}%`,
    market: typeof c.market === "string" ? c.market : `${c.market || c.marketFit || 0}%`,
    explanation: c.explanation || c.context || ""
  }))

  const distributionPotentials = analysisReport?.distributionPotentials || {
    theatrical: 0, ott: 0, panIndia: 0
  }

  const commercialViability = analysisReport?.commercialViability || {
    score: 0, confidence: "—", verdict: "Awaiting analysis", rationale: ""
  }
  const grossPredictedRevenue = analysisReport?.grossPredictedRevenue || {
    low: 0, likely: 0, high: 0, confidence: "—", assumptions: []
  }
  const optimalReleaseWindow = analysisReport?.optimalReleaseWindow || {
    window: "Not specified", season: "", rationale: "", avoid: []
  }
  const collectionForecast = analysisReport?.collectionForecast || { regions: [], otherMarkets: null }
  const audienceMetrics = analysisReport?.audienceMetrics || {
    primaryAudience: "Not specified", primaryMarket: "Not specified", secondaryMarket: "Not specified", metrics: []
  }

  const marketingHooks: any[] = analysisReport?.marketingHooks || []

  const viralMoments: any[] = analysisReport?.viralMoments || []

  const locationsList: any[] = analysisReport?.locationsList || []

  const castPlanning: any[] = (analysisReport?.castPlanning || []).map((c: any) => ({
    character: c.character || c.name || "",
    starDependency: c.starDependency || c.star || "",
    performance: c.performance || c.requirement || "",
    shootDays: c.shootDays || c.days || 0
  }))

  const budgetBreakdown: any[] = (analysisReport?.budgetBreakdown || []).map((b: any) => ({
    category: b.category,
    min: typeof b.min === "number" ? b.min : parseFloat(String(b.min).replace(/[^0-9.]/g, "")) || 0,
    max: typeof b.max === "number" ? b.max : parseFloat(String(b.max).replace(/[^0-9.]/g, "")) || 0,
    confidence: b.confidence
  }))
  const productionFeasibility = analysisReport?.productionFeasibility || {
    score: 0, confidence: "—", summary: "", bottlenecks: [], savings: []
  }
  const budgetInfo = analysisReport?.budgetInfo || { min: 0, max: 0, confidence: "—", costDrivers: [] }

  const developmentNotes: any[] = (analysisReport?.developmentNotes || analysisReport?.rewriteNotes || []).map((n: any) => ({
    priority: n.priority,
    title: n.title,
    description: n.description || n.summary || "",
    scene: n.scene || n.target || "",
    evidence: n.evidence || n.before || "",
    actionable: n.actionable || n.action || ""
  }))

  const draftComparison: any[] = analysisReport?.draftComparison || []
  const developmentImpact = analysisReport?.developmentImpact || {
    readinessScore: 0, topPriority: "Not specified", expectedCommercialLift: "—", expectedCostImpact: "—", summary: ""
  }

  const whyItWorks: string[] = analysisReport?.whyItWorks || []

  const killRisks: { title: string; severity: string; summary: string }[] = (analysisReport?.killRisks || []).map((r: any) => ({
    title: r.title || "",
    severity: r.severity || "Medium",
    summary: r.summary || r.description || "",
  }))

  const nextSteps: { step: string; owner: string; timing: string }[] = (analysisReport?.nextSteps || []).map((s: any, idx: number) => ({
    step: s.step || s.title || `Step ${idx + 1}`,
    owner: s.owner || "",
    timing: s.timing || "",
  }))
  const decisionMatrix = analysisReport?.decisionMatrix || { creative: 0, commercial: 0, production: 0, readiness: 0 }
  const investmentOutlook = analysisReport?.investmentOutlook || {
    riskLevel: "—", returnPotential: "—", capitalFit: "Not specified", conditions: []
  }

  const taskReady = (key: string) => {
    const task = FILM_ANALYSIS_TASKS.find((item) => item.key === key)
    if (!task) return false
    return taskStates[task.socketTag] === "ready" || taskHasData(key, sectionPayloadsRef.current[task.section])
  }
  const taskLoading = (key: string) => {
    const task = FILM_ANALYSIS_TASKS.find((item) => item.key === key)
    return !!task && (taskStates[task.socketTag] === "loading" || taskStates[task.socketTag] === "queued")
  }
  const needsRefresh = (section: FilmAnalysisSection) =>
    !loadingSections[section] && sectionNeedsRefresh(section, sectionPayloadsRef.current[section])

  const logline = analysisReport?.logline || ""
  const synopsis = analysisReport?.synopsis || ""

  const retryActiveSection = () => {
    if (!generationEnabled && !sectionReady && !(activeSection && sectionPayloadsRef.current[activeSection])) {
      setHydrationAttempt((attempt) => attempt + 1)
      return
    }
    if (activeSection) analyzeSection(activeSection, true)
  }

  // --- RENDERING TABS ---

  return (
    <div className={`flex flex-col overflow-hidden bg-transparent ${activeTab === "Ask Rover" ? "h-auto shrink-0" : "h-full flex-1"}`}>
      {/* Dynamic Tab Selector */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-[#0a0a0a]/80 px-4 pb-3 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="scrollbar-hide flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
          {["Overview", "Story", "Characters", "Commercial", "Production", "Development", "Greenlight"].map(tab => {
            const sec = TAB_TO_SECTION[tab]
            const busy = !!(loadingSections[sec] && !readySections[sec])
            const unavailable = !readySections[sec] && !loadingSections[sec] && !sectionPayloadsRef.current[sec]
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                disabled={unavailable}
                aria-disabled={unavailable}
                aria-current={activeTab === tab ? "page" : undefined}
                title={unavailable ? busy ? `${tab} dashboard is being generated` : `${tab} dashboard is not generated yet` : `Open ${tab} dashboard`}
                className={`focus-ring min-h-10 px-4 py-2 rounded-lg text-sm transition-all flex-shrink-0 flex items-center cursor-pointer font-medium relative ${
                  unavailable
                    ? "cursor-not-allowed border border-transparent text-muted-foreground/35 opacity-60"
                    : activeTab === tab
                    ? "bg-secondary text-[#75A5ED] border border-border"
                    : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-[#1a1a1f]/50"
                }`}
              >
                {tab === "Overview" && <Layers className="w-4 h-4 mr-2" />}
                {tab === "Story" && <Activity className="w-4 h-4 mr-2" />}
                {tab === "Characters" && <User className="w-4 h-4 mr-2" />}
                {tab === "Commercial" && <TrendingUp className="w-4 h-4 mr-2" />}
                {tab === "Production" && <Film className="w-4 h-4 mr-2" />}
                {tab === "Development" && <BookOpen className="w-4 h-4 mr-2" />}
                {tab === "Greenlight" && <CheckCircle className="w-4 h-4 mr-2" />}
                {tab}
                {busy && <Loader2 className="w-3.5 h-3.5 ml-2 animate-spin text-[#75A5ED]" />}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setActiveTab("Ask Rover")}
          disabled={!allDashboardsReady}
          aria-disabled={!allDashboardsReady}
          title={allDashboardsReady ? "Ask AI about this film" : `Ask AI unlocks when all dashboards are generated (${readyDashboardCount}/${FILM_ANALYSIS_SECTIONS.length})`}
          className={`focus-ring min-h-10 shrink-0 px-3 sm:px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 cursor-pointer font-medium border border-border/80 ${
            !allDashboardsReady
              ? "cursor-not-allowed bg-secondary/50 text-muted-foreground/35 opacity-60"
              : activeTab === "Ask Rover"
              ? "bg-[#75A5ED]/20 text-[#75A5ED]"
              : "bg-secondary text-foreground hover:bg-muted"
          }`}
        >
          {allDashboardsReady ? <Sparkles className="w-4 h-4 text-[#75A5ED]" /> : <Loader2 className="w-4 h-4 animate-spin" />}
          <span className="hidden sm:inline">Ask AI</span>
        </button>
      </div>

      {hydrated && generationEnabled && automaticDashboardsReady && !allDashboardsReady && (
        <div className="border-b border-border bg-[#0a0a0a]/65 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-2">
            <span className="mr-1 text-xs text-muted-foreground">Generate remaining dashboards:</span>
            {MANUAL_GENERATED_SECTIONS.filter((section) => !readySections[section]).map((section) => {
              const busy = !!loadingSections[section]
              const anotherSectionIsRunning = inflightRef.current.size > 0 && !busy
              const label = SECTION_TO_TAB[section]
              return (
                <button
                  key={section}
                  onClick={() => analyzeSection(section)}
                  disabled={busy || anotherSectionIsRunning}
                  title={sectionErrors[section] || `Generate the ${label} dashboard`}
                  className="focus-ring flex min-h-9 items-center gap-1.5 rounded-lg border border-[#75A5ED]/25 bg-[#75A5ED]/10 px-3 py-1.5 text-xs font-medium text-[#8cb6f4] transition hover:bg-[#75A5ED]/20 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  {busy ? `Generating ${label}…` : `Generate ${label}`}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Tab Panels */}
      {activeTab !== "Ask Rover" && <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-custom px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div className="mx-auto max-w-[1200px] space-y-10 pb-24">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "Overview" && (
            <SectionStatus
              loading={sectionLoading}
              error={sectionError}
              onRetry={retryActiveSection}
              ready={sectionReady}
              hasData={!!(activeSection && sectionPayloadsRef.current[activeSection])}
              sectionName="overview"
            >
            <div className="space-y-6">
              {/* Top Summary Card */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Greenlight Recommendation status */}
                <Card className="lg:col-span-2 bg-[#131315] border-border overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4">
                    <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full text-xs font-semibold tracking-wider">
                      {recommendation.status}
                    </span>
                  </div>
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Greenlight Readiness</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-gradient">{recommendation.score}</span>
                      <span className="text-sm text-muted-foreground">/ 100 Overall Score</span>
                    </div>
                    <p className="text-slate-200 text-sm leading-relaxed break-words whitespace-pre-wrap">
                      {recommendation.summary}
                    </p>
                    <div className="flex items-center gap-6 pt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span>Confidence: <strong>{recommendation.confidence}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-purple-400" />
                        <span>Expected Budget: <strong>{metadata.expectedBudget}</strong></span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Score Chart Radar/Meters */}
                <Card className="bg-[#131315] border-border">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Core Aspect Scores</h3>
                    <div className="space-y-3">
                      {[
                        { label: "Story & Structure", score: scores.story, color: "bg-blue-400" },
                        { label: "Commercial Potential", score: scores.commercial, color: "bg-emerald-400" },
                        { label: "Production Feasibility", score: scores.production, color: "bg-purple-400" },
                        { label: "Audience Engagement", score: scores.audience, color: "bg-amber-400" },
                        { label: "Originality & Novelty", score: scores.originality, color: "bg-pink-400" }
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-light">
                            <span className="text-slate-400">{item.label}</span>
                            <span className="text-foreground font-medium">{item.score}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full ${item.color}`} style={{ width: `${item.score}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Executive Coverage */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 bg-[#131315] border-border">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-200">Executive Script Coverage</h3>
                      <button
                        onClick={() => handleSaveToInsights({
                          Key: "Executive Summary",
                          Question: "Show me the synopsis and details for " + metadata.title,
                          Answer: `**Logline**: ${logline}\n\n**Synopsis**: ${synopsis}`,
                          Tags: "Screenplay, Overview"
                        })}
                        className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Bookmark className="w-3.5 h-3.5" /> Save Summary
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs text-muted-foreground uppercase font-bold block mb-1">LOGLINE</span>
                        <p className="text-sm text-slate-300 italic break-words whitespace-pre-wrap">
                          {logline || "Logline will appear once analysis completes."}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase font-bold block mb-1">SYNOPSIS</span>
                        <p className="text-sm text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
                          {synopsis || "Synopsis will appear once analysis completes."}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Metadata details */}
                <Card className="bg-[#131315] border-border">
                  <CardContent className="p-6 space-y-4 text-sm">
                    <h3 className="text-sm font-semibold text-slate-200 mb-2">Screenplay Attributes</h3>
                    <div className="space-y-3.5">
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">Title</span>
                        <span className="text-foreground text-xs font-semibold">{metadata.title}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">Language</span>
                        <span className="text-foreground text-xs font-semibold">{metadata.language}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">Genre</span>
                        <span className="text-foreground text-xs font-semibold">{metadata.genre}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">Screenplay Pages</span>
                        <span className="text-foreground text-xs font-semibold">{metadata.pages} pages</span>
                      </div>
                      {/* <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">Est. Runtime</span>
                        <span className="text-foreground text-xs font-semibold">{metadata.runtimeMinutes} minutes</span>
                      </div> */}
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">Primary Market</span>
                        <span className="text-foreground text-xs font-semibold">{metadata.targetMarket}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">Release Strategy</span>
                        <span className="text-foreground text-xs font-semibold">{metadata.releaseStrategy}</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => onAskRover(`Why is the expected budget estimated at ${metadata.expectedBudget} for this film?`)}
                        disabled={!allDashboardsReady}
                        title={!allDashboardsReady ? "Available after all dashboards are generated" : undefined}
                        className="w-full py-2 bg-secondary hover:bg-muted text-xs rounded border border-border text-center text-[#75A5ED] font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Ask Rover about Budget
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Risks & Opportunities Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Risks */}
                <Card className="bg-[#131315] border-border">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" /> Top Risks
                    </h3>
                    <div className="space-y-4">
                      {risks.map((risk, idx) => (
                        <div key={idx} className="p-3 bg-[#191919] border border-border/50 rounded-lg space-y-2 relative">
                          <span className="absolute top-3 right-3 text-[10px] px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400">
                            {risk.severity} Severity
                          </span>
                          <h4 className="text-xs font-semibold text-foreground pr-16">{risk.title}</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed break-words whitespace-pre-wrap">{risk.summary}</p>
                          <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
                            <span>Ref: {risk.evidence}</span>
                            <button
                              onClick={() => handleSaveToInsights({
                                Key: `Risk - ${risk.title}`,
                                Question: `What is the risk regarding: ${risk.title}?`,
                                Answer: `**Risk**: ${risk.title}\n**Severity**: ${risk.severity}\n**Details**: ${risk.summary}\n**Evidence**: ${risk.evidence}`,
                                Tags: "Risk, Screenplay"
                              })}
                              className="text-[#75A5ED] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Bookmark className="w-3 h-3" /> Save Insight
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Opportunities */}
                <Card className="bg-[#131315] border-border">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" /> Opportunities & Potentials
                    </h3>
                    <div className="space-y-4">
                      {opportunities.map((opp, idx) => (
                        <div key={idx} className="p-3 bg-[#191919] border border-border/50 rounded-lg space-y-2">
                          <h4 className="text-xs font-semibold text-foreground">{opp.title}</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed break-words whitespace-pre-wrap">{opp.summary}</p>
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => handleSaveToInsights({
                                Key: `Opportunity - ${opp.title}`,
                                Question: `What is the commercial opportunity for: ${opp.title}?`,
                                Answer: `**Opportunity**: ${opp.title}\n**Explanation**: ${opp.summary}`,
                                Tags: "Opportunity, Commercial"
                              })}
                              className="text-[10px] text-[#75A5ED] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Bookmark className="w-3 h-3" /> Save Insight
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
            </SectionStatus>
          )}

          {/* TAB 2: STORY & STRUCTURE */}
          {activeTab === "Story" && (
            <SectionStatus
              loading={sectionLoading}
              error={sectionError}
              onRetry={retryActiveSection}
              ready={sectionReady}
              hasData={!!(activeSection && sectionPayloadsRef.current[activeSection])}
              sectionName="story"
            >
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
                {/* Metric Summary Card */}
                <Card className="bg-[#131315] border-border p-6 flex flex-col gap-3 min-h-[140px] h-auto overflow-visible">
                  <div>
                    <h4 className="text-xs text-muted-foreground uppercase font-bold mb-1">Story Score</h4>
                    <span className="text-4xl font-bold text-blue-400">{scores.story}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed break-words">
                    Structure and interval/climax evaluation from the screenplay.
                  </p>
                </Card>
                <Card className="bg-[#131315] border-border p-6 flex flex-col gap-3 min-h-[140px] h-auto overflow-visible">
                  <div>
                    <h4 className="text-xs text-muted-foreground uppercase font-bold mb-1">Originality</h4>
                    <span className="text-4xl font-bold text-pink-400">{scores.originality}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed break-words">
                    Originality relative to genre conventions in this script.
                  </p>
                </Card>
                <Card className="bg-[#131315] border-border p-6 flex flex-col gap-3 min-h-[140px] h-auto overflow-visible">
                  <div>
                    <h4 className="text-xs text-muted-foreground uppercase font-bold mb-1">Structural Pacing</h4>
                    <span className="text-2xl font-bold text-purple-400 leading-tight break-words">
                      {(() => {
                        const raw = String(storyScorecard?.structuralPacing || "—")
                        return raw.length > 24 ? raw.slice(0, 24).trim() + "…" : raw
                      })()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed break-words whitespace-pre-wrap">
                    {storyScorecard?.structuralPacingNotes ||
                      (String(storyScorecard?.structuralPacing || "").length > 24
                        ? storyScorecard?.structuralPacing
                        : "Pacing notes grounded in scene structure.")}
                  </p>
                </Card>
                <Card className="bg-[#131315] border-border p-6 flex flex-col gap-3 min-h-[140px] h-auto overflow-visible">
                  <div>
                    <h4 className="text-xs text-muted-foreground uppercase font-bold mb-1">Climax Build</h4>
                    <span className="text-2xl font-bold text-orange-400 leading-tight break-words">
                      {(() => {
                        const raw = String(storyScorecard?.climaxBuild || "—")
                        return raw.length > 24 ? raw.slice(0, 24).trim() + "…" : raw
                      })()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed break-words whitespace-pre-wrap">
                    {storyScorecard?.climaxBuildNotes ||
                      (String(storyScorecard?.climaxBuild || "").length > 24
                        ? storyScorecard?.climaxBuild
                        : "Climax escalation from the screenplay analysis.")}
                  </p>
                </Card>
              </div>

              {/* Screenplay Tension SVG Chart */}
              <Card className="bg-[#131315] border-border">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-200">Screenplay Tension / Intensity Curve</h3>
                  <div className="w-full bg-[#191919] border border-border/60 rounded-xl p-4 pb-3 space-y-3 overflow-visible">
                    <div className="w-full h-[180px] relative">
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#75A5ED" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#75A5ED" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        
                        <line x1="0" y1="20" x2="800" y2="20" stroke="#222" strokeDasharray="3" />
                        <line x1="0" y1="100" x2="800" y2="100" stroke="#222" strokeDasharray="3" />
                        <line x1="0" y1="180" x2="800" y2="180" stroke="#222" strokeDasharray="3" />

                        {tensionArea && (
                          <path d={tensionArea} fill="url(#chart-grad)" />
                        )}
                        {tensionPath && (
                          <path
                            d={tensionPath}
                            fill="none"
                            stroke="#75A5ED"
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                        )}
                        {tensionPoints.map((pt, i) => (
                          <circle key={i} cx={pt.x} cy={pt.y} r="5" fill="#131315" stroke="#75A5ED" strokeWidth="2.5" />
                        ))}
                      </svg>
                    </div>

                    <div className="w-full flex flex-wrap gap-x-3 gap-y-2 justify-between text-[10px] text-muted-foreground px-1">
                      {(tensionPoints.length ? tensionPoints : [{ label: "Opening" }, { label: "Climax" }, { label: "Resolution" }]).map((pt, i) => (
                        <span key={i} className="max-w-[9rem] break-words leading-snug text-center flex-1 min-w-[4.5rem]">
                          {pt.label || `Beat ${i + 1}`}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Story Timeline Milestones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-[#131315] border-border">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-200">Timeline Analysis</h3>
                    <div className="relative border-l border-border/80 ml-3 pl-6 space-y-5">
                      {timelineEvents.map((evt, idx) => (
                        <div key={idx} className="relative">
                          {/* Circle marker */}
                          <div className={`absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full border-2 ${
                            evt.tension > 90 ? "bg-red-400 border-red-400" : "bg-blue-400 border-blue-400"
                          } z-10`} />
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs mb-1">
                            <span className="font-semibold text-foreground break-words">{evt.label}</span>
                            <span className="text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0 w-fit">
                              Page {evt.page} (Tension: {evt.tension}%)
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed break-words whitespace-pre-wrap">{evt.desc}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Indian Cinema Signals */}
                <Card className="bg-[#131315] border-border">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-200">Indian Cinema Signal Evaluation</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Custom workflow analytics tailored for commercial success metrics in regional and domestic markets.
                    </p>
                    <div className="space-y-3 pt-2">
                      {indianCinemaSignals.map((sig, idx) => (
                        <div key={idx} className="flex flex-col gap-1 p-2 bg-[#191919]/60 rounded-lg border border-border/40 overflow-visible">
                          <div className="flex justify-between items-start gap-2 text-xs">
                            <span className="font-medium text-slate-300 break-words">{sig.name}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              sig.rating === "Excellent" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                              sig.rating === "Good" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                              "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                            }`}>
                              {sig.rating}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed break-words whitespace-pre-wrap">{sig.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
            </SectionStatus>
          )}

          {/* TAB 3: CHARACTERS */}
          {activeTab === "Characters" && (
            <SectionStatus
              loading={sectionLoading}
              error={sectionError}
              onRetry={retryActiveSection}
              ready={sectionReady}
              hasData={!!(activeSection && sectionPayloadsRef.current[activeSection])}
              sectionName="characters"
            >
            <div className="space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Character Breakdown & Dialogue Shares</h3>
                  <p className="text-xs text-muted-foreground">Overview of script dominance, presence metrics, and arc values.</p>
                </div>
                <button
                  onClick={() => onAskRover(`Compare the character goals and motivations in ${metadata.title}.`)}
                  disabled={!allDashboardsReady}
                  title={!allDashboardsReady ? "Available after all dashboards are generated" : undefined}
                  className="px-3 py-1.5 bg-[#75A5ED]/20 hover:bg-[#75A5ED]/30 text-xs text-[#75A5ED] rounded border border-[#75A5ED]/30 flex items-center gap-1.5 cursor-pointer font-medium disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Analyze Goals Comparison
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                {charactersList.map((char, idx) => (
                  <Card key={idx} className="bg-[#131315] border-border hover:border-border/80 transition-all flex flex-col justify-between h-auto overflow-visible">
                    <CardContent className="p-5 space-y-4">
                      {/* Name Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-foreground break-words">{char.name}</h4>
                          <span className="text-[10px] text-muted-foreground tracking-wider uppercase font-semibold break-words">{char.role}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          char.casting === "Critical" ? "bg-red-500/10 text-red-400 border border-red-500/25" :
                          char.casting === "High" ? "bg-orange-500/10 text-orange-400 border border-orange-500/25" :
                          "bg-blue-500/10 text-blue-400 border border-blue-500/25"
                        }`}>
                          Casting: {char.casting}
                        </span>
                      </div>

                      {/* Stat figures */}
                      <div className="grid grid-cols-3 gap-2 text-center bg-[#191919] p-2 rounded-lg border border-border/40">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Presence</span>
                          <span className="text-xs font-semibold text-slate-200">{char.presence}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Dialogues</span>
                          <span className="text-xs font-semibold text-slate-200">{char.dialogue}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Arc</span>
                          <span className="text-xs font-semibold text-slate-200">{char.arc}</span>
                        </div>
                      </div>

                      {/* Summary fields */}
                      <p className="text-xs text-muted-foreground leading-relaxed break-words whitespace-pre-wrap">{char.description}</p>
                      
                      <div className="space-y-2 text-xs pt-1 border-t border-border/30">
                        <div>
                          <strong className="text-slate-400 block text-[10px]">GOAL</strong>
                          <span className="text-slate-200">{char.goal}</span>
                        </div>
                        <div>
                          <strong className="text-slate-400 block text-[10px]">MOTIVATION</strong>
                          <span className="text-slate-200">{char.motivation}</span>
                        </div>
                        <div>
                          <strong className="text-slate-400 block text-[10px]">CONFLICT</strong>
                          <span className="text-slate-200">{char.conflict}</span>
                        </div>
                        <div>
                          <strong className="text-slate-400 block text-[10px]">RESOLUTION</strong>
                          <span className="text-slate-200">{char.resolution}</span>
                        </div>
                      </div>

                    </CardContent>

                    <div className="p-4 bg-[#191919]/40 border-t border-border flex items-center justify-between">
                      <button
                        onClick={() => handleSaveToInsights({
                          Key: `${char.name} Character Card`,
                          Question: `Show details of character: ${char.name}?`,
                          Answer: `**Character**: ${char.name}\n**Role**: ${char.role}\n**Description**: ${char.description}\n**Dialogue Share**: ${char.dialogue}\n**Goal**: ${char.goal}\n**Motivation**: ${char.motivation}`,
                          Tags: "Characters, Screenplay"
                        })}
                        className="text-[10px] text-[#75A5ED] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Bookmark className="w-3.5 h-3.5" /> Save Card
                      </button>
                      <button
                        onClick={() => onAskRover(`How does ${char.name}'s character arc evolve through the screenplay?`)}
                        disabled={!allDashboardsReady}
                        title={!allDashboardsReady ? "Available after all dashboards are generated" : undefined}
                        className="text-[10px] text-slate-400 hover:text-foreground flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span>Ask Rover</span> <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>

            </div>
            </SectionStatus>
          )}

          {/* TAB 4: COMMERCIAL */}
          {activeTab === "Commercial" && (
            <SectionStatus
              loading={sectionLoading}
              error={sectionError}
              onRetry={retryActiveSection}
              ready={sectionReady}
              hasData={!!(activeSection && sectionPayloadsRef.current[activeSection])}
              sectionName="commercial"
            >
              <div className="space-y-8">
                {needsRefresh("commercial") && <RefreshAnalysisBanner onRefresh={() => analyzeSection("commercial", true)} />}

                {taskLoading("commercial-core") ? <AnalysisGroupSkeleton cards={3} /> : (
                  <section className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#75A5ED]">Market position</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-100">Commercial viability</h3>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
                      <Card className="border-[#75A5ED]/25 bg-gradient-to-br from-[#172033] to-[#131315] p-6 md:col-span-2">
                        <div className="flex items-start justify-between gap-6">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{commercialViability.verdict}</p>
                            <p className="mt-3 text-5xl font-bold text-[#8cb6f4]">{commercialViability.score || "—"}<span className="text-lg text-muted-foreground">/100</span></p>
                          </div>
                          <span className="rounded-full border border-border bg-black/20 px-3 py-1 text-[10px] font-semibold text-slate-300">{commercialViability.confidence} confidence</span>
                        </div>
                        <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-300">{commercialViability.rationale || "Refresh this analysis to generate the commercial viability rationale."}</p>
                      </Card>
                      {[
                        { label: "Theatrical", value: distributionPotentials.theatrical, color: "text-emerald-400" },
                        { label: "OTT", value: distributionPotentials.ott, color: "text-blue-400" },
                        { label: "Pan-India", value: distributionPotentials.panIndia, color: "text-amber-400" },
                      ].map((item) => (
                        <Card key={item.label} className="border-border bg-[#131315] p-6">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{item.label} potential</p>
                          <p className={"mt-4 text-4xl font-bold " + item.color}>{item.value || 0}%</p>
                          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-current" style={{ width: item.value + "%" }} />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {taskLoading("commercial-forecast") ? <AnalysisGroupSkeleton cards={3} /> : (
                  <section className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#75A5ED]">Planning estimate</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-100">Revenue and release outlook</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Heuristic screenplay-based ranges—not live box-office forecasts.</p>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-3">
                      <Card className="border-border bg-[#131315] p-6">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Likely gross revenue</p>
                        <p className="mt-3 text-3xl font-bold text-emerald-400">{crore(grossPredictedRevenue.likely)}</p>
                        <p className="mt-2 text-xs text-slate-400">{crore(grossPredictedRevenue.low)} – {crore(grossPredictedRevenue.high)}</p>
                        <p className="mt-4 text-[11px] text-muted-foreground">{grossPredictedRevenue.confidence} confidence</p>
                      </Card>
                      <Card className="border-border bg-[#131315] p-6 lg:col-span-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Optimal release window</p>
                        <div className="mt-3 flex flex-wrap items-baseline gap-3">
                          <p className="text-2xl font-bold text-[#8cb6f4]">{optimalReleaseWindow.window}</p>
                          {optimalReleaseWindow.season && <span className="rounded-full bg-[#75A5ED]/10 px-3 py-1 text-xs text-[#9bc1f7]">{optimalReleaseWindow.season}</span>}
                        </div>
                        <p className="mt-4 text-sm leading-6 text-slate-300">{optimalReleaseWindow.rationale || "Refresh this analysis to generate release guidance."}</p>
                        {!!optimalReleaseWindow.avoid?.length && <p className="mt-3 text-xs text-amber-400">Avoid: {optimalReleaseWindow.avoid.join(", ")}</p>}
                      </Card>
                    </div>

                    <Card className="border-border bg-[#131315]">
                      <CardContent className="space-y-5 p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-100">Expected collection by market</h3>
                            <p className="mt-1 text-xs text-muted-foreground">Top regions with leading state and district estimates in INR crore.</p>
                          </div>
                          {collectionForecast.otherMarkets && <span className="text-xs text-slate-400">Other markets: {crore(collectionForecast.otherMarkets.likely)}</span>}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          {(collectionForecast.regions || []).map((region: any) => (
                            <div key={region.region} className="rounded-lg border border-border/70 bg-[#191919] p-4">
                              <p className="text-xs font-semibold text-slate-300">{region.region}</p>
                              <p className="mt-2 text-xl font-bold text-emerald-400">{crore(region.likely)}</p>
                              <p className="mt-1 text-[10px] text-muted-foreground">{crore(region.low)} – {crore(region.high)}</p>
                            </div>
                          ))}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[720px] text-left text-xs">
                            <thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                              <tr><th className="pb-3">Region</th><th className="pb-3">State</th><th className="pb-3">Key districts / cities</th><th className="pb-3 text-right">Likely collection</th></tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {(collectionForecast.regions || []).flatMap((region: any) =>
                                (region.states || []).map((state: any) => (
                                  <tr key={region.region + state.state}>
                                    <td className="py-3 text-muted-foreground">{region.region}</td>
                                    <td className="py-3 font-medium text-slate-200">{state.state}</td>
                                    <td className="py-3 text-slate-400">{(state.keyDistricts || []).map((district: any) => district.district + " (" + crore(district.likely) + ")").join(" · ") || "—"}</td>
                                    <td className="py-3 text-right font-semibold text-emerald-400">{crore(state.likely)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </section>
                )}

                {taskLoading("commercial-audience") ? <AnalysisGroupSkeleton cards={2} /> : (
                  <section className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-3">
                      <Card className="border-border bg-[#131315] p-6">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Audience fit</p>
                        <dl className="mt-5 space-y-4 text-xs">
                          <div><dt className="text-muted-foreground">Primary audience</dt><dd className="mt-1 text-sm font-medium text-slate-200">{audienceMetrics.primaryAudience}</dd></div>
                          <div><dt className="text-muted-foreground">Primary market</dt><dd className="mt-1 text-sm font-medium text-slate-200">{audienceMetrics.primaryMarket}</dd></div>
                          <div><dt className="text-muted-foreground">Secondary market</dt><dd className="mt-1 text-sm font-medium text-slate-200">{audienceMetrics.secondaryMarket}</dd></div>
                        </dl>
                      </Card>
                      <Card className="border-border bg-[#131315] p-6 lg:col-span-2">
                        <h3 className="text-sm font-semibold text-slate-100">Comparable films</h3>
                        <div className="mt-4 space-y-4">
                          {comparables.map((comp, index) => (
                            <div key={index} className="grid gap-2 border-b border-border/40 pb-4 last:border-0 last:pb-0 sm:grid-cols-[minmax(120px,0.7fr)_1fr]">
                              <div><p className="font-semibold text-slate-200">{comp.title}</p><p className="mt-1 text-[10px] text-[#8cb6f4]">Market fit {comp.market}</p></div>
                              <p className="leading-5 text-muted-foreground">{comp.explanation}</p>
                            </div>
                          ))}
                          {!comparables.length && <p className="text-xs text-muted-foreground">No comparable titles generated yet.</p>}
                        </div>
                      </Card>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                      {[
                        { title: "Key marketing hooks", items: marketingHooks },
                        { title: "Trailer and viral moments", items: viralMoments },
                      ].map((group) => (
                        <Card key={group.title} className="border-border bg-[#131315] p-6">
                          <h3 className="text-sm font-semibold text-slate-100">{group.title}</h3>
                          <div className="mt-5 space-y-4">
                            {group.items.map((item: any, index: number) => <div key={index}><p className="text-xs font-semibold text-slate-200">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p></div>)}
                            {!group.items.length && <p className="text-xs text-muted-foreground">No insights generated yet.</p>}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </SectionStatus>
          )}
          {/* TAB 5: PRODUCTION & BUDGET */}
          {activeTab === "Production" && (
            <SectionStatus
              loading={sectionLoading}
              error={sectionError}
              onRetry={retryActiveSection}
              ready={sectionReady}
              hasData={!!(activeSection && sectionPayloadsRef.current[activeSection])}
              sectionName="production"
            >
              <div className="space-y-8">
                {needsRefresh("production") && <RefreshAnalysisBanner onRefresh={() => analyzeSection("production", true)} />}

                {taskLoading("production-budget") ? <AnalysisGroupSkeleton cards={3} /> : (
                  <section className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#75A5ED]">Feasibility</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-100">Budget and execution outlook</h3>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-3">
                      <Card className="border-[#75A5ED]/25 bg-gradient-to-br from-[#172033] to-[#131315] p-6 lg:col-span-2">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Production feasibility</p>
                            <p className="mt-3 text-5xl font-bold text-[#8cb6f4]">{productionFeasibility.score || "—"}<span className="text-lg text-muted-foreground">/100</span></p>
                          </div>
                          <span className="w-fit rounded-full border border-border bg-black/20 px-3 py-1 text-[10px] font-semibold text-slate-300">{productionFeasibility.confidence} confidence</span>
                        </div>
                        <p className="mt-5 text-sm leading-6 text-slate-300">{productionFeasibility.summary || "Refresh this analysis to generate a production feasibility assessment."}</p>
                      </Card>
                      <Card className="border-border bg-[#131315] p-6">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estimated budget</p>
                        <p className="mt-4 text-2xl font-bold text-emerald-400">{crore(budgetInfo.min)} – {crore(budgetInfo.max)}</p>
                        <p className="mt-3 text-xs text-muted-foreground">{budgetInfo.confidence} confidence</p>
                      </Card>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                      <Card className="border-border bg-[#131315] p-6">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><AlertTriangle className="size-4 text-amber-400" /> Execution bottlenecks</h4>
                        <ul className="mt-4 space-y-3 text-xs leading-5 text-muted-foreground">{(productionFeasibility.bottlenecks || []).map((item: string, index: number) => <li key={index} className="border-l-2 border-amber-400/40 pl-3">{item}</li>)}{!productionFeasibility.bottlenecks?.length && <li>No bottlenecks generated yet.</li>}</ul>
                      </Card>
                      <Card className="border-border bg-[#131315] p-6">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Sparkles className="size-4 text-emerald-400" /> Cost-saving opportunities</h4>
                        <ul className="mt-4 space-y-3 text-xs leading-5 text-muted-foreground">{(productionFeasibility.savings || []).map((item: string, index: number) => <li key={index} className="border-l-2 border-emerald-400/40 pl-3">{item}</li>)}{!productionFeasibility.savings?.length && <li>No savings generated yet.</li>}</ul>
                      </Card>
                    </div>
                  </section>
                )}

                {taskLoading("production-logistics") ? <AnalysisGroupSkeleton cards={3} /> : (
                  <section className="space-y-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#75A5ED]">Production footprint</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-100">Schedule and resource demands</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {[
                        { label: "Shoot days", val: productionSummary.shootDays, icon: Clock, color: "text-blue-400" },
                        { label: "Locations", val: productionSummary.locations, icon: MapPin, color: "text-emerald-400" },
                        { label: "Night scenes", val: productionSummary.nightScenes, icon: Activity, color: "text-purple-400" },
                        { label: "Action blocks", val: productionSummary.actionSequences, icon: Film, color: "text-red-400" },
                        { label: "Major cast", val: productionSummary.majorCharacters, icon: User, color: "text-pink-400" },
                        { label: "VFX scenes", val: productionSummary.vfxScenes, icon: Sparkles, color: "text-cyan-400" },
                        { label: "Extras", val: productionSummary.extras, icon: User, color: "text-orange-400" },
                        { label: "Songs", val: productionSummary.songs, icon: Layers, color: "text-amber-400" },
                      ].map((item) => (
                        <Card key={item.label} className="border-border bg-[#131315] p-5">
                          <item.icon className={"size-5 " + item.color} />
                          <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                          <p className="mt-1 text-2xl font-bold text-slate-100">{item.val}</p>
                        </Card>
                      ))}
                    </div>
                    <div className="grid gap-6 xl:grid-cols-2">
                      <Card className="border-border bg-[#131315]">
                        <CardContent className="p-6">
                          <h3 className="text-sm font-semibold text-slate-100">Location complexity</h3>
                          <div className="mt-5 overflow-x-auto">
                            <table className="w-full min-w-[520px] text-left text-xs">
                              <thead className="border-b border-border text-[10px] uppercase text-muted-foreground"><tr><th className="pb-3">Location</th><th className="pb-3 text-center">Scenes</th><th className="pb-3 text-center">Days</th><th className="pb-3 text-right">Complexity</th></tr></thead>
                              <tbody className="divide-y divide-border/40">{locationsList.map((loc, index) => <tr key={index}><td className="py-3 font-medium text-slate-200">{loc.name}<span className="block text-[10px] font-normal text-muted-foreground">{loc.type}</span></td><td className="py-3 text-center text-slate-400">{loc.scenes}</td><td className="py-3 text-center text-slate-400">{loc.shootDays}</td><td className="py-3 text-right text-[#8cb6f4]">{loc.complexity}</td></tr>)}</tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-border bg-[#131315]">
                        <CardContent className="p-6">
                          <h3 className="text-sm font-semibold text-slate-100">Cast and performance demands</h3>
                          <div className="mt-5 space-y-4">{castPlanning.map((cast, index) => <div key={index} className="grid gap-2 border-b border-border/40 pb-4 last:border-0 sm:grid-cols-[1fr_auto]"><div><p className="text-xs font-semibold text-slate-200">{cast.character}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{cast.performance}</p></div><div className="text-left sm:text-right"><p className="text-xs text-[#8cb6f4]">{cast.starDependency}</p><p className="mt-1 text-[10px] text-muted-foreground">{cast.shootDays} days</p></div></div>)}</div>
                        </CardContent>
                      </Card>
                    </div>
                  </section>
                )}

                {!taskLoading("production-budget") && (
                  <Card className="border-border bg-[#131315]">
                    <CardContent className="space-y-5 p-6">
                      <div><h3 className="text-sm font-semibold text-slate-100">Budget allocation</h3><p className="mt-1 text-xs text-muted-foreground">Screenplay-based ranges in INR crore.</p></div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[620px] text-left text-xs">
                          <thead className="border-b border-border text-[10px] uppercase text-muted-foreground"><tr><th className="pb-3">Category</th><th className="pb-3 text-center">Minimum</th><th className="pb-3 text-center">Maximum</th><th className="pb-3 text-right">Confidence</th></tr></thead>
                          <tbody className="divide-y divide-border/40">{budgetBreakdown.map((row, index) => <tr key={index}><td className="py-3 font-medium text-slate-200">{row.category}</td><td className="py-3 text-center text-slate-400">{crore(row.min)}</td><td className="py-3 text-center text-slate-400">{crore(row.max)}</td><td className="py-3 text-right text-[#8cb6f4]">{row.confidence}</td></tr>)}</tbody>
                        </table>
                      </div>
                      {!!budgetInfo.costDrivers?.length && <div className="grid gap-4 border-t border-border/50 pt-5 md:grid-cols-3">{budgetInfo.costDrivers.map((driver: any, index: number) => <div key={index}><p className="text-xs font-semibold text-slate-200">{driver.name} <span className="font-normal text-amber-400">· {driver.severity}</span></p><p className="mt-1 text-xs leading-5 text-muted-foreground">{driver.explanation}</p></div>)}</div>}
                    </CardContent>
                  </Card>
                )}
              </div>
            </SectionStatus>
          )}
          {/* TAB 6: DEVELOPMENT NOTES */}
          {activeTab === "Development" && (
            <SectionStatus
              loading={sectionLoading}
              error={sectionError}
              onRetry={retryActiveSection}
              ready={sectionReady}
              hasData={!!(activeSection && sectionPayloadsRef.current[activeSection])}
              sectionName="development"
            >
              <div className="space-y-8">
                {needsRefresh("development") && <RefreshAnalysisBanner onRefresh={() => analyzeSection("development", true)} />}

                {taskLoading("development-impact") ? <AnalysisGroupSkeleton cards={3} /> : (
                  <section className="space-y-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#75A5ED]">Development readiness</p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-100">Projected rewrite impact</h3>
                      </div>
                      <button onClick={() => onAskRover(`Turn the top critical development note for ${metadata.title} into a detailed rewrite outline.`)} disabled={!allDashboardsReady} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#75A5ED]/30 bg-[#75A5ED]/15 px-4 text-xs font-semibold text-[#9bc1f7] disabled:opacity-40"><Sparkles className="size-3.5" /> Generate rewrite outline</button>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                      <Card className="border-[#75A5ED]/25 bg-gradient-to-br from-[#172033] to-[#131315] p-6 md:col-span-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Readiness score</p>
                        <div className="mt-3 flex items-end gap-4"><p className="text-5xl font-bold text-[#8cb6f4]">{developmentImpact.readinessScore || "—"}<span className="text-lg text-muted-foreground">/100</span></p><span className="mb-1 rounded-full bg-secondary px-3 py-1 text-[10px] text-slate-300">{developmentImpact.expectedCommercialLift} commercial lift</span></div>
                        <p className="mt-5 text-sm leading-6 text-slate-300">{developmentImpact.summary || "Refresh this analysis to estimate rewrite impact."}</p>
                      </Card>
                      <Card className="border-border bg-[#131315] p-6"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top priority</p><p className="mt-4 text-lg font-semibold leading-6 text-slate-100">{developmentImpact.topPriority}</p></Card>
                      <Card className="border-border bg-[#131315] p-6"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cost impact</p><p className="mt-4 text-3xl font-bold text-amber-400">{developmentImpact.expectedCostImpact}</p><p className="mt-3 text-xs text-muted-foreground">Projected direction after rewrites</p></Card>
                    </div>

                    <Card className="border-border bg-[#131315]">
                      <CardContent className="space-y-5 p-6">
                        <div><h3 className="text-sm font-semibold text-slate-100">Current-to-proposed changes</h3><p className="mt-1 text-xs text-muted-foreground">Projected deltas—not a comparison against an uploaded second draft.</p></div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[720px] text-left text-xs">
                            <thead className="border-b border-border text-[10px] uppercase text-muted-foreground"><tr><th className="pb-3">Aspect</th><th className="pb-3">Current state</th><th className="pb-3">Proposed direction</th><th className="pb-3">Expected impact</th></tr></thead>
                            <tbody className="divide-y divide-border/40">{draftComparison.map((row: any, index: number) => <tr key={index}><td className="py-3 font-medium text-slate-200">{row.aspect}</td><td className="py-3 pr-5 text-slate-400">{row.current}</td><td className="py-3 pr-5 text-emerald-400">{row.proposed}</td><td className="py-3 text-muted-foreground">{row.impact}</td></tr>)}</tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </section>
                )}

                {taskLoading("development-notes") ? <AnalysisGroupSkeleton cards={2} /> : (
                  <section className="space-y-5">
                    <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#75A5ED]">Rewrite roadmap</p><h3 className="mt-1 text-lg font-semibold text-slate-100">Prioritized development notes</h3><p className="mt-1 text-xs text-muted-foreground">Producer-focused actions grounded in screenplay scenes.</p></div>
                    <div className="space-y-5">
                      {developmentNotes.map((note, index) => (
                        <Card key={index} className="border-border bg-[#131315]">
                          <CardContent className="p-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="max-w-3xl">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${note.priority === "CRITICAL" ? "border-red-500/30 bg-red-500/10 text-red-400" : note.priority === "RECOMMENDED" ? "border-blue-500/30 bg-blue-500/10 text-blue-400" : "border-border bg-secondary text-slate-400"}`}>{note.priority}</span>
                                  <span className="text-[10px] font-mono text-muted-foreground">{note.scene}</span>
                                </div>
                                <h4 className="mt-4 text-base font-semibold text-slate-100">{note.title}</h4>
                                <p className="mt-2 text-sm leading-6 text-slate-300">{note.description}</p>
                              </div>
                              <button onClick={() => handleSaveToInsights({ Key: `Script Note - ${note.title}`, Question: `What is the development note on: ${note.title}?`, Answer: `**Priority**: ${note.priority}\n**Target**: ${note.scene}\n**Suggestion**: ${note.description}\n**Actionable**: ${note.actionable}`, Tags: "Development, Script Notes" })} className="inline-flex shrink-0 items-center gap-2 text-xs text-[#8cb6f4] hover:underline"><Bookmark className="size-3.5" /> Save note</button>
                            </div>
                            <div className="mt-6 grid gap-5 rounded-xl border border-border/50 bg-[#191919] p-5 md:grid-cols-2">
                              <div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current script state</p><p className="mt-2 text-xs leading-5 text-slate-300">{note.evidence}</p></div>
                              <div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target action</p><p className="mt-2 text-xs leading-5 text-[#9bc1f7]">{note.actionable}</p></div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {!developmentNotes.length && <Card className="border-dashed border-border bg-[#131315] p-8 text-center text-xs text-muted-foreground">No development notes generated yet.</Card>}
                    </div>
                  </section>
                )}
              </div>
            </SectionStatus>
          )}
          {/* TAB 7: GREENLIGHT REPORT */}
          {activeTab === "Greenlight" && (
            <SectionStatus
              loading={sectionLoading}
              error={sectionError}
              onRetry={retryActiveSection}
              ready={sectionReady}
              hasData={!!(activeSection && sectionPayloadsRef.current[activeSection])}
              sectionName="greenlight"
            >
              <div className="space-y-8">
                {needsRefresh("greenlight") && <RefreshAnalysisBanner onRefresh={() => analyzeSection("greenlight", true)} />}

                <div className="flex flex-col gap-5 rounded-2xl border border-[#75A5ED]/25 bg-gradient-to-r from-blue-950/60 via-purple-950/30 to-[#131315] p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8cb6f4]">Executive decision</p><h3 className="mt-2 text-xl font-semibold text-slate-100">Greenlight memo</h3><p className="mt-1 text-xs text-muted-foreground">Creative, commercial, production, and readiness synthesis.</p></div>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => toast.success("Coverage report saved successfully to E-book drafts!")} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#75A5ED] px-4 text-xs font-semibold text-zinc-950 hover:bg-blue-400"><Bookmark className="size-3.5" /> Save memo</button>
                    <button onClick={() => onAskRover("Summarize the entire Greenlight report into a 500-word executive brief for producers.")} disabled={!allDashboardsReady} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-secondary px-4 text-xs font-semibold text-slate-100 disabled:opacity-40"><Sparkles className="size-3.5 text-[#8cb6f4]" /> Create briefing</button>
                  </div>
                </div>

                {taskLoading("greenlight-decision") ? <AnalysisGroupSkeleton cards={2} /> : (
                  <section className="grid gap-6 lg:grid-cols-3">
                    <Card className="border-[#75A5ED]/25 bg-[#131315] p-6">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recommended action</p>
                      <p className={`mt-5 break-words text-3xl font-extrabold ${recommendation.status?.toUpperCase() === "GREENLIGHT" ? "text-emerald-400" : recommendation.status?.toUpperCase() === "PASS" ? "text-red-400" : "text-amber-400"}`}>{recommendation.status}</p>
                      <div className="mt-5 flex items-center gap-3"><span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-[#8cb6f4]">Score {recommendation.score}/100</span><span className="text-xs text-muted-foreground">{recommendation.confidence} confidence</span></div>
                      <p className="mt-5 border-t border-border/60 pt-5 text-sm leading-6 text-slate-300">{recommendation.summary}</p>
                    </Card>
                    <Card className="border-border bg-[#131315] p-6 lg:col-span-2">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><CheckCircle className="size-4 text-emerald-400" /> Why this screenplay works</h4>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        {whyItWorks.map((item, index) => <div key={index} className="rounded-lg border border-border/60 bg-[#191919] p-4"><span className="text-[10px] font-bold text-emerald-400">0{index + 1}</span><p className="mt-2 text-xs leading-5 text-slate-300">{item}</p></div>)}
                        {!whyItWorks.length && <p className="text-xs text-muted-foreground">Strengths will appear after analysis.</p>}
                      </div>
                    </Card>
                  </section>
                )}

                {taskLoading("greenlight-actions") ? <AnalysisGroupSkeleton cards={3} /> : (
                  <section className="space-y-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#75A5ED]">Decision matrix</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-100">Investment and execution conditions</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: "Creative", value: decisionMatrix.creative, color: "bg-blue-400" },
                        { label: "Commercial", value: decisionMatrix.commercial, color: "bg-emerald-400" },
                        { label: "Production", value: decisionMatrix.production, color: "bg-purple-400" },
                        { label: "Readiness", value: decisionMatrix.readiness, color: "bg-amber-400" },
                      ].map((item) => (
                        <Card key={item.label} className="border-border bg-[#131315] p-5">
                          <div className="flex items-end justify-between"><p className="text-xs font-semibold text-slate-300">{item.label}</p><p className="text-xl font-bold text-slate-100">{item.value || 0}</p></div>
                          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary"><div className={"h-full rounded-full " + item.color} style={{ width: item.value + "%" }} /></div>
                        </Card>
                      ))}
                    </div>

                    <div className="grid gap-6 lg:grid-cols-3">
                      <Card className="border-border bg-[#131315] p-6">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Investment outlook</p>
                        <dl className="mt-5 space-y-4 text-xs">
                          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Risk level</dt><dd className="font-semibold text-amber-400">{investmentOutlook.riskLevel}</dd></div>
                          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Return potential</dt><dd className="font-semibold text-emerald-400">{investmentOutlook.returnPotential}</dd></div>
                          <div><dt className="text-muted-foreground">Capital fit</dt><dd className="mt-2 leading-5 text-slate-300">{investmentOutlook.capitalFit}</dd></div>
                        </dl>
                        {!!investmentOutlook.conditions?.length && <ul className="mt-5 space-y-2 border-t border-border/50 pt-5 text-xs leading-5 text-muted-foreground">{investmentOutlook.conditions.map((item: string, index: number) => <li key={index}>• {item}</li>)}</ul>}
                      </Card>
                      <Card className="border-border bg-[#131315] p-6 lg:col-span-2">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><AlertTriangle className="size-4 text-red-400" /> What could kill the project</h4>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">{killRisks.map((risk, index) => <div key={index} className="rounded-lg border border-red-500/15 bg-red-500/5 p-4"><p className="text-xs font-semibold text-slate-200">{risk.title} <span className="font-normal text-red-400">· {risk.severity}</span></p><p className="mt-2 text-xs leading-5 text-muted-foreground">{risk.summary}</p></div>)}{!killRisks.length && <p className="text-xs text-muted-foreground">No kill risks identified yet.</p>}</div>
                      </Card>
                    </div>

                    <Card className="border-border bg-[#131315]">
                      <CardContent className="p-6">
                        <h3 className="text-sm font-semibold text-slate-100">Recommended next steps</h3>
                        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                          {nextSteps.map((step, index) => <div key={index} className="flex gap-4"><div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#75A5ED]/30 bg-[#75A5ED]/10 text-xs font-bold text-[#8cb6f4]">{index + 1}</div><div><p className="text-xs font-semibold text-slate-200">{step.step}</p>{(step.owner || step.timing) && <p className="mt-1 text-[10px] text-muted-foreground">{[step.owner, step.timing].filter(Boolean).join(" · ")}</p>}</div></div>)}
                          {!nextSteps.length && <p className="text-xs text-muted-foreground">Next steps will appear after analysis.</p>}
                        </div>
                      </CardContent>
                    </Card>
                  </section>
                )}
              </div>
            </SectionStatus>
          )}

        </div>
      </div>}
    </div>
  )
})

export default FilmWorkspace
