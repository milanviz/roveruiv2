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
import {
  STATIC_FILM_ANALYSIS,
  STATIC_FILM_METADATA,
} from "@/lib/static-film-data"

interface FilmWorkspaceProps {
  projectId: string
  scriptId?: string | null
  projectName: string
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

function SectionStatus({
  loading,
  error,
  onRetry,
  ready,
  children,
}: {
  loading: boolean
  error: string | null
  onRetry: () => void
  ready: boolean
  children: ReactNode
}) {
  if (loading && !ready) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-[#75A5ED]" />
        <p className="text-sm">Analyzing screenplay for this section…</p>
        <p className="text-xs opacity-70">Other tabs stay available while this runs.</p>
      </div>
    )
  }

  if (error && !ready) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <AlertTriangle className="w-8 h-8 text-amber-400" />
        <p className="text-sm text-slate-200">Couldn’t generate this section</p>
        <p className="text-xs text-muted-foreground max-w-md text-center">{error}</p>
        <button
          onClick={onRetry}
          className="mt-2 px-3 py-1.5 text-xs rounded-lg border border-border bg-secondary hover:bg-muted flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry analysis
        </button>
      </div>
    )
  }

  return <>{children}</>
}

const FilmWorkspace = memo(function FilmWorkspace({
  projectId,
  scriptId,
  projectName,
  onAskRover,
  activeTab,
  setActiveTab
}: FilmWorkspaceProps) {
  // Demo mode: always serve curated static analysis for ஆண் பாவம்
  const useMocks = true

  const [metadata, setMetadata] = useState({
    title: projectName || STATIC_FILM_METADATA.title,
    language: STATIC_FILM_METADATA.language,
    genre: STATIC_FILM_METADATA.genre,
    targetMarket: STATIC_FILM_METADATA.targetMarket,
    releaseStrategy: STATIC_FILM_METADATA.releaseStrategy,
    expectedBudget: STATIC_FILM_METADATA.expectedBudget,
    pages: STATIC_FILM_METADATA.pages,
    runtimeMinutes: STATIC_FILM_METADATA.runtimeMinutes,
  })
  const [analysisReport, setAnalysisReport] = useState<any>(STATIC_FILM_ANALYSIS)
  const [loadingSections, setLoadingSections] = useState<Record<string, boolean>>({})
  const [sectionErrors, setSectionErrors] = useState<Record<string, string | null>>({})
  const [readySections, setReadySections] = useState<Record<string, boolean>>({
    overview: true,
    story: true,
    characters: true,
    commercial: true,
    production: true,
    development: true,
    greenlight: true,
  })
  const [hydrated, setHydrated] = useState(false)
  const inflightRef = useRef<Map<string, Promise<void>>>(new Map())
  const readySectionsRef = useRef(readySections)
  readySectionsRef.current = readySections

  const applyMetadata = (parsed: Record<string, any>) => {
    setMetadata(prev => ({
      ...prev,
      title: parsed.title || parsed.screenplay_title || prev.title,
      language: parsed.language || parsed.screenplay_language || prev.language,
      genre: parsed.genre || prev.genre,
      targetMarket: parsed.targetMarket || parsed.target_market || parsed.target_market_industry || prev.targetMarket,
      releaseStrategy: parsed.releaseStrategy || parsed.release_strategy || prev.releaseStrategy,
      expectedBudget: parsed.expectedBudget || parsed.expected_budget || prev.expectedBudget,
      pages: parsed.pages || parsed.attributes?.pages || prev.pages,
      runtimeMinutes: parsed.runtimeMinutes || parsed.attributes?.runtimeMinutes || prev.runtimeMinutes,
    }))
  }

  const markSectionsFromAnalysis = (analysis: any) => {
    if (!analysis?.sections || typeof analysis.sections !== "object") return
    const nextReady: Record<string, boolean> = {}
    for (const key of Object.keys(analysis.sections)) {
      if (analysis.sections[key]?.data) nextReady[key] = true
    }
    if (Object.keys(nextReady).length) {
      setReadySections(prev => {
        const next = { ...prev, ...nextReady }
        readySectionsRef.current = next
        return next
      })
    }
  }

  const analyzeSection = async (_section: FilmAnalysisSection, _force = false) => {
    // Static demo — analysis is preloaded; no live workflow calls.
    return
  }

  useEffect(() => {
    applyMetadata({
      ...STATIC_FILM_METADATA,
      title: projectName || STATIC_FILM_METADATA.title,
    })
    setAnalysisReport(STATIC_FILM_ANALYSIS)
    markSectionsFromAnalysis(STATIC_FILM_ANALYSIS)
    setHydrated(true)
  }, [scriptId, projectId, projectName])

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
  const sectionReady = useMocks || (activeSection ? !!readySections[activeSection] : true)

  // --- DATA (static ஆண் பாவம் analysis) ---
  const recommendation = analysisReport?.recommendation || STATIC_FILM_ANALYSIS.recommendation || {
    status: "—", score: 0, confidence: "—", summary: ""
  }

  const scores = analysisReport?.scores || STATIC_FILM_ANALYSIS.scores || {
    story: 0, commercial: 0, production: 0, audience: 0, originality: 0, risk: 0
  }

  const storyScorecard = analysisReport?.storyScorecard || STATIC_FILM_ANALYSIS.storyScorecard || null

  const productionSummary = analysisReport?.productionSummary || (analysisReport?.attributes ? {
    shootDays: analysisReport.attributes.shootDays || 0,
    locations: analysisReport.attributes.locations || 0,
    nightScenes: analysisReport.attributes.nightScenes || 0,
    actionSequences: analysisReport.attributes.actionSequences || 0,
    majorCharacters: analysisReport.attributes.majorCast || 0,
    extras: analysisReport.attributes.extras || 0,
    vfxScenes: analysisReport.attributes.vfxScenes || 0,
    songs: analysisReport.attributes.songs || 0
  } : (STATIC_FILM_ANALYSIS.productionSummary || {
    shootDays: 0, locations: 0, nightScenes: 0, actionSequences: 0,
    majorCharacters: 0, extras: 0, vfxScenes: 0, songs: 0
  }))

  const risks: any[] = analysisReport?.risks || STATIC_FILM_ANALYSIS.risks || []

  const opportunities: any[] = analysisReport?.opportunities || STATIC_FILM_ANALYSIS.opportunities || []

  const timelineEvents: any[] = (analysisReport?.timelineEvents || STATIC_FILM_ANALYSIS.timelineEvents || []).map((e: any) => ({
    label: e.label || e.title || "",
    page: typeof e.page === "number" ? e.page : parseInt(String(e.page).replace(/\D/g, "")) || 1,
    tension: e.tension || 0,
    desc: e.desc || e.description || ""
  }))

  const tensionPoints: { x: number; y: number; label: string }[] = (() => {
    const source: any[] = analysisReport?.tensionCurve?.length
      ? analysisReport.tensionCurve
      : (STATIC_FILM_ANALYSIS.tensionCurve as any[])?.length
        ? (STATIC_FILM_ANALYSIS.tensionCurve as any[])
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
  ] : (STATIC_FILM_ANALYSIS.indianCinemaSignals || []))

  const charactersList: any[] = (analysisReport?.charactersList || STATIC_FILM_ANALYSIS.charactersList || []).map((c: any) => ({
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

  const comparables: any[] = (analysisReport?.comparables || STATIC_FILM_ANALYSIS.comparables || []).map((c: any) => ({
    title: c.title || c.name || "",
    narrative: typeof c.narrative === "string" ? c.narrative : `${c.narrative || c.narrativeSimilarity || 0}%`,
    audience: typeof c.audience === "string" ? c.audience : `${c.audience || c.audienceMatch || 0}%`,
    production: typeof c.production === "string" ? c.production : `${c.production || c.costMatch || 0}%`,
    market: typeof c.market === "string" ? c.market : `${c.market || c.marketFit || 0}%`,
    explanation: c.explanation || c.context || ""
  }))

  const distributionPotentials = analysisReport?.distributionPotentials || STATIC_FILM_ANALYSIS.distributionPotentials || {
    theatrical: 0, ott: 0, panIndia: 0
  }

  const marketingHooks: any[] = analysisReport?.marketingHooks || STATIC_FILM_ANALYSIS.marketingHooks || []

  const viralMoments: any[] = analysisReport?.viralMoments || STATIC_FILM_ANALYSIS.viralMoments || []

  const locationsList: any[] = analysisReport?.locationsList || STATIC_FILM_ANALYSIS.locationsList || []

  const castPlanning: any[] = (analysisReport?.castPlanning || STATIC_FILM_ANALYSIS.castPlanning || []).map((c: any) => ({
    character: c.character || c.name || "",
    starDependency: c.starDependency || c.star || "",
    performance: c.performance || c.requirement || "",
    shootDays: c.shootDays || c.days || 0
  }))

  const budgetBreakdown: any[] = (analysisReport?.budgetBreakdown || STATIC_FILM_ANALYSIS.budgetBreakdown || []).map((b: any) => ({
    category: b.category,
    min: typeof b.min === "number" ? b.min : parseFloat(String(b.min).replace(/[^0-9.]/g, "")) || 0,
    max: typeof b.max === "number" ? b.max : parseFloat(String(b.max).replace(/[^0-9.]/g, "")) || 0,
    confidence: b.confidence
  }))

  const developmentNotes: any[] = (analysisReport?.developmentNotes || analysisReport?.rewriteNotes || STATIC_FILM_ANALYSIS.developmentNotes || STATIC_FILM_ANALYSIS.rewriteNotes || []).map((n: any) => ({
    priority: n.priority,
    title: n.title,
    description: n.description || n.summary || "",
    scene: n.scene || n.target || "",
    evidence: n.evidence || n.before || "",
    actionable: n.actionable || n.action || ""
  }))

  const draftComparison: any[] = analysisReport?.draftComparison || STATIC_FILM_ANALYSIS.draftComparison || []

  const whyItWorks: string[] = analysisReport?.whyItWorks || STATIC_FILM_ANALYSIS.whyItWorks || []

  const killRisks: { title: string; severity: string; summary: string }[] = (analysisReport?.killRisks || STATIC_FILM_ANALYSIS.killRisks || []).map((r: any) => ({
    title: r.title || "",
    severity: r.severity || "Medium",
    summary: r.summary || r.description || "",
  }))

  const nextSteps: { step: string; owner: string; timing: string }[] = (analysisReport?.nextSteps || STATIC_FILM_ANALYSIS.nextSteps || []).map((s: any, idx: number) => ({
    step: s.step || s.title || `Step ${idx + 1}`,
    owner: s.owner || "",
    timing: s.timing || "",
  }))

  const logline = analysisReport?.logline || STATIC_FILM_ANALYSIS.logline || ""
  const synopsis = analysisReport?.synopsis || STATIC_FILM_ANALYSIS.synopsis || ""

  const retryActiveSection = () => {
    if (activeSection) analyzeSection(activeSection, true)
  }

  // --- RENDERING TABS ---

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-transparent">
      {/* Dynamic Tab Selector */}
      <div className="px-8 pb-3 border-b border-border flex items-center justify-between flex-wrap gap-4 bg-[#0a0a0a]/80 sticky top-0 z-10 backdrop-blur-md">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
          {["Overview", "Story", "Characters", "Commercial", "Production", "Development", "Greenlight"].map(tab => {
            const sec = TAB_TO_SECTION[tab]
            const busy = !!(scriptId && loadingSections[sec] && !readySections[sec])
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm transition-all flex-shrink-0 flex items-center cursor-pointer font-medium relative ${
                  activeTab === tab
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
          className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 cursor-pointer font-medium border border-border/80 ${
            activeTab === "Ask Rover"
              ? "bg-[#75A5ED]/20 text-[#75A5ED]"
              : "bg-secondary text-foreground hover:bg-muted"
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#75A5ED]" />
          Ask Rover Chat
        </button>
      </div>

      {/* Main Tab Panels */}
      <div className="flex-1 overflow-y-auto scrollbar-custom px-8 py-6">
        <div className="max-w-[1100px] mx-auto space-y-8 pb-20">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "Overview" && (
            <SectionStatus
              loading={sectionLoading}
              error={sectionError}
              onRetry={retryActiveSection}
              ready={sectionReady}
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
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">Est. Runtime</span>
                        <span className="text-foreground text-xs font-semibold">{metadata.runtimeMinutes} minutes</span>
                      </div>
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
                        className="w-full py-2 bg-secondary hover:bg-muted text-xs rounded border border-border text-center text-[#75A5ED] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
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
            >
            <div className="space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Character Breakdown & Dialogue Shares</h3>
                  <p className="text-xs text-muted-foreground">Overview of script dominance, presence metrics, and arc values.</p>
                </div>
                <button
                  onClick={() => onAskRover(`Compare the character goals and motivations in ${metadata.title}.`)}
                  className="px-3 py-1.5 bg-[#75A5ED]/20 hover:bg-[#75A5ED]/30 text-xs text-[#75A5ED] rounded border border-[#75A5ED]/30 flex items-center gap-1.5 cursor-pointer font-medium"
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
                        className="text-[10px] text-slate-400 hover:text-foreground flex items-center gap-1 cursor-pointer"
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
            >
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                {/* Theatrical Potential */}
                <Card className="bg-[#131315] border-border p-6 flex flex-col gap-3 min-h-[140px] h-auto overflow-visible">
                  <div>
                    <h4 className="text-xs text-muted-foreground uppercase font-bold mb-1">Theatrical Potential</h4>
                    <span className="text-4xl font-bold text-emerald-400">{distributionPotentials.theatrical}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed break-words">
                    Theatrical outlook for {metadata.targetMarket || "the primary market"} based on this screenplay.
                  </p>
                </Card>
                {/* OTT Potential */}
                <Card className="bg-[#131315] border-border p-6 flex flex-col gap-3 min-h-[140px] h-auto overflow-visible">
                  <div>
                    <h4 className="text-xs text-muted-foreground uppercase font-bold mb-1">OTT Potential</h4>
                    <span className="text-4xl font-bold text-blue-400">{distributionPotentials.ott}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed break-words">
                    Streaming suitability for this genre and narrative tone.
                  </p>
                </Card>
                {/* Pan-India Potential */}
                <Card className="bg-[#131315] border-border p-6 flex flex-col gap-3 min-h-[140px] h-auto overflow-visible">
                  <div>
                    <h4 className="text-xs text-muted-foreground uppercase font-bold mb-1">Pan-India Reach</h4>
                    <span className="text-4xl font-bold text-amber-400">{distributionPotentials.panIndia}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed break-words">
                    Cross-market expansion potential beyond the primary territory.
                  </p>
                </Card>
              </div>

              {/* Comparables Table */}
              <Card className="bg-[#131315] border-border">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-200">Comparable Narrative & Market Analyses</h3>
                  <p className="text-xs text-muted-foreground">
                    Historical box office performers with similar parameters. No plagiarism matching; values correspond strictly to market performance and structure comparables.
                  </p>
                  
                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border/80 text-muted-foreground">
                          <th className="pb-3 font-semibold">COMPARABLE FILM</th>
                          <th className="pb-3 font-semibold text-center">NARRATIVE SIMILARITY</th>
                          <th className="pb-3 font-semibold text-center">AUDIENCE MATCH</th>
                          <th className="pb-3 font-semibold text-center">PRODUCTION COST MATCH</th>
                          <th className="pb-3 font-semibold text-center">MARKET FIT</th>
                          <th className="pb-3 font-semibold pl-4">EXPLANATION / CONTEXT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {comparables.map((comp, idx) => (
                          <tr key={idx} className="hover:bg-secondary/20">
                            <td className="py-3.5 font-medium text-foreground">{comp.title}</td>
                            <td className="py-3.5 text-center text-blue-400 font-semibold">{comp.narrative}</td>
                            <td className="py-3.5 text-center text-purple-400 font-semibold">{comp.audience}</td>
                            <td className="py-3.5 text-center text-emerald-400 font-semibold">{comp.production}</td>
                            <td className="py-3.5 text-center text-amber-400 font-semibold">{comp.market}</td>
                            <td className="py-3.5 pl-4 text-muted-foreground leading-relaxed max-w-xs">{comp.explanation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Marketing Hooks & Target Market */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-[#131315] border-border">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-200">Key Marketing Hooks</h3>
                    <ul className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                      {marketingHooks.length === 0 && (
                        <li className="text-muted-foreground">No marketing hooks generated yet.</li>
                      )}
                      {marketingHooks.map((hook: any, idx: number) => (
                        <li key={idx}>
                          <strong className="text-foreground block">{hook.title}</strong>
                          {hook.description}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-[#131315] border-border">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-200">Trailer & Viral Moments</h3>
                    <ul className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                      {viralMoments.length === 0 && (
                        <li className="text-muted-foreground">No viral moments generated yet.</li>
                      )}
                      {viralMoments.map((moment: any, idx: number) => (
                        <li key={idx}>
                          <strong className="text-foreground block">{moment.title}</strong>
                          {moment.description}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

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
            >
            <div className="space-y-6">
              
              {/* Counts Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
                {[
                  { label: "Shoot Days", val: productionSummary.shootDays, icon: Clock, color: "text-blue-400" },
                  { label: "Locations", val: productionSummary.locations, icon: MapPin, color: "text-emerald-400" },
                  { label: "Night Scenes", val: productionSummary.nightScenes, icon: Activity, color: "text-purple-400" },
                  { label: "Action Blks", val: productionSummary.actionSequences, icon: Film, color: "text-red-400" },
                  { label: "Major Cast", val: productionSummary.majorCharacters, icon: User, color: "text-pink-400" },
                  { label: "VFX Scenes", val: productionSummary.vfxScenes, icon: Sparkles, color: "text-cyan-400" },
                  { label: "Extras", val: productionSummary.extras, icon: User, color: "text-orange-400" },
                  { label: "Songs", val: productionSummary.songs, icon: Layers, color: "text-amber-400" }
                ].map((item, idx) => (
                  <Card key={idx} className="bg-[#131315] border-border text-center p-3">
                    <item.icon className={`w-5 h-5 mx-auto mb-2 ${item.color}`} />
                    <span className="text-[10px] text-muted-foreground block">{item.label}</span>
                    <span className="text-sm font-semibold text-slate-100">{item.val}</span>
                  </Card>
                ))}
              </div>

              {/* Locations Table */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-[#131315] border-border">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-200">Location Breakdown & Complexity</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border/80 text-muted-foreground">
                            <th className="pb-3 font-semibold">LOCATION NAME</th>
                            <th className="pb-3 font-semibold text-center">SCENE COUNT</th>
                            <th className="pb-3 font-semibold text-center">EST. SHOOT DAYS</th>
                            <th className="pb-3 font-semibold text-center">COMPLEXITY</th>
                            <th className="pb-3 font-semibold text-right">TYPE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {locationsList.map((loc, idx) => (
                            <tr key={idx} className="hover:bg-secondary/10">
                              <td className="py-2.5 font-medium text-slate-200">{loc.name}</td>
                              <td className="py-2.5 text-center text-slate-300">{loc.scenes}</td>
                              <td className="py-2.5 text-center text-slate-300">{loc.shootDays}</td>
                              <td className="py-2.5 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  loc.complexity === "High" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                                  loc.complexity === "Medium" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" :
                                  "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                }`}>
                                  {loc.complexity}
                                </span>
                              </td>
                              <td className="py-2.5 text-right text-muted-foreground">{loc.type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Cast Planning */}
                <Card className="bg-[#131315] border-border">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-200">Talent/Cast & Performance Demands</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border/80 text-muted-foreground">
                            <th className="pb-3 font-semibold">CHARACTER</th>
                            <th className="pb-3 font-semibold">STAR DEPENDENCY</th>
                            <th className="pb-3 font-semibold text-center">EST. DAYS</th>
                            <th className="pb-3 font-semibold pl-2">ROLE REQUIREMENT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {castPlanning.map((cast, idx) => (
                            <tr key={idx} className="hover:bg-secondary/10">
                              <td className="py-2.5 font-medium text-slate-200">{cast.character}</td>
                              <td className="py-2.5 text-xs text-blue-400 font-semibold">{cast.starDependency}</td>
                              <td className="py-2.5 text-center text-slate-300">{cast.shootDays}</td>
                              <td className="py-2.5 pl-2 text-muted-foreground leading-normal max-w-xs">{cast.performance}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Budget Breakdown Table */}
              <Card className="bg-[#131315] border-border">
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200">Budget Breakdown Estimates</h3>
                      <p className="text-xs text-muted-foreground">Confidence limits generated by structural analysis of pages, stunt, and location demands.</p>
                    </div>
                    <button
                      onClick={() => handleSaveToInsights({
                        Key: "Budget Analysis Summary",
                        Question: "Give me the budget details for " + metadata.title,
                        Answer: `**Total Est. Budget**: ${metadata.expectedBudget} \n\n**Cast**: ₹4.0–6.0 Cr \n**Crew & Technical**: ₹2.5–3.5 Cr \n**Locations & Sets**: ₹2.0–3.0 Cr \n**Post / Marketing**: ₹2.0–3.0 Cr`,
                        Tags: "Production, Budget"
                      })}
                      className="px-2.5 py-1.5 bg-secondary text-xs rounded hover:bg-muted border border-border flex items-center gap-1.5 cursor-pointer font-medium"
                    >
                      <Bookmark className="w-3.5 h-3.5" /> Save Budget Insight
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border/80 text-muted-foreground">
                          <th className="pb-3 font-semibold">BUDGET CATEGORY</th>
                          <th className="pb-3 font-semibold text-center">MIN ESTIMATE</th>
                          <th className="pb-3 font-semibold text-center">MAX ESTIMATE</th>
                          <th className="pb-3 font-semibold text-center">CONFIDENCE</th>
                          <th className="pb-3 font-semibold text-right">ESTIMATION INDEX</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {budgetBreakdown.map((row, idx) => (
                          <tr key={idx} className="hover:bg-secondary/10">
                            <td className="py-3 font-medium text-slate-200">{row.category}</td>
                            <td className="py-3 text-center text-slate-300">₹{row.min.toFixed(2)} Cr</td>
                            <td className="py-3 text-center text-slate-300">₹{row.max.toFixed(2)} Cr</td>
                            <td className="py-3 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                row.confidence === "High" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                              }`}>
                                {row.confidence}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden inline-block align-middle">
                                <div className="h-full bg-blue-400" style={{ width: `${(row.min / 2.5) * 100}%` }}></div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

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
            >
            <div className="space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Actionable Script & Rewrite Notes</h3>
                  <p className="text-xs text-muted-foreground">Producer-focused suggestions to improve audience scores and lower production risks.</p>
                </div>
                <button
                  onClick={() => onAskRover(`Turn the top critical development note for ${metadata.title} into a detailed rewrite outline.`)}
                  className="px-3 py-1.5 bg-[#75A5ED]/20 hover:bg-[#75A5ED]/30 text-xs text-[#75A5ED] rounded border border-[#75A5ED]/30 flex items-center gap-1.5 cursor-pointer font-medium"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Generate Rewrite Outline
                </button>
              </div>

              <div className="space-y-4">
                {developmentNotes.map((note, idx) => (
                  <Card key={idx} className="bg-[#131315] border-border hover:border-border/80 transition-all">
                    <CardContent className="p-5 space-y-4">
                      {/* Priority Tag header */}
                      <div className="flex justify-between items-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          note.priority === "CRITICAL" ? "bg-red-500/10 text-red-400 border border-red-500/30" :
                          note.priority === "RECOMMENDED" ? "bg-blue-500/10 text-blue-400 border border-blue-500/30" :
                          "bg-zinc-500/10 text-zinc-400 border border-zinc-500/30"
                        }`}>
                          {note.priority} PRIORITY
                        </span>
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded font-mono">
                          Target: {note.scene}
                        </span>
                      </div>

                      {/* Info block */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-foreground">{note.title}</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{note.description}</p>
                      </div>

                      {/* Evidence Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-[#191919] border border-border/50 rounded-lg text-xs leading-relaxed">
                        <div>
                          <strong className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Current Script State</strong>
                          <span className="text-slate-200">{note.evidence}</span>
                        </div>
                        <div>
                          <strong className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Suggested Target Action</strong>
                          <span className="text-[#75A5ED]">{note.actionable}</span>
                        </div>
                      </div>
                    </CardContent>

                    <div className="p-4 bg-[#191919]/40 border-t border-border flex items-center justify-between">
                      <button
                        onClick={() => handleSaveToInsights({
                          Key: `Script Note - ${note.title}`,
                          Question: `What is the development note on: ${note.title}?`,
                          Answer: `**Priority**: ${note.priority}\n**Target**: ${note.scene}\n**Suggestion**: ${note.description}\n**Actionable**: ${note.actionable}`,
                          Tags: "Development, Script Notes"
                        })}
                        className="text-[10px] text-[#75A5ED] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Bookmark className="w-3.5 h-3.5" /> Save Script Note
                      </button>
                      <button
                        onClick={() => onAskRover(`What specific changes can we make to resolve: "${note.title}"?`)}
                        className="text-[10px] text-slate-400 hover:text-foreground flex items-center gap-1 cursor-pointer"
                      >
                        <span>Ask Rover to Rewrite</span> <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Draft Comparison */}
              <Card className="bg-[#131315] border-border mt-8">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-200">Script Draft Comparison & Deltas</h3>
                  <p className="text-xs text-muted-foreground">Track modifications across script versions. Compare performance metrics and budget deltas side-by-side.</p>
                  
                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border/80 text-muted-foreground text-[11px]">
                          <th className="pb-3 font-semibold">ASPECT</th>
                          <th className="pb-3 font-semibold text-center">CURRENT</th>
                          <th className="pb-3 font-semibold text-center">PROPOSED</th>
                          <th className="pb-3 font-semibold pl-4">IMPACT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {draftComparison.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-muted-foreground">
                              Draft comparison will appear when development analysis includes revision deltas.
                            </td>
                          </tr>
                        )}
                        {draftComparison.map((row: any, idx: number) => (
                          <tr key={idx} className="hover:bg-secondary/10">
                            <td className="py-3 font-medium text-slate-200">{row.aspect}</td>
                            <td className="py-3 text-center text-slate-400">{row.current}</td>
                            <td className="py-3 text-center text-emerald-400 font-semibold">{row.proposed}</td>
                            <td className="py-3 pl-4 text-muted-foreground max-w-xs">{row.impact}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

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
            >
            <div className="space-y-6">
              
              {/* Executive Header Banner */}
              <div className="bg-gradient-to-r from-blue-900/40 via-purple-900/20 to-zinc-900/10 border border-[#75A5ED]/20 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-slate-100">Executive Greenlight Memo</h3>
                  <p className="text-xs text-[#75A5ED]">Vizru Workflow Screenplay Evaluation Matrix</p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      toast.success("Coverage report saved successfully to E-book drafts!")
                      setActiveTab("Overview")
                    }}
                    className="px-4 py-2 bg-[#75A5ED] text-zinc-900 rounded-lg hover:bg-blue-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Bookmark className="w-4 h-4" /> Save Coverage Memo
                  </button>
                  
                  <button
                    onClick={() => onAskRover("Summarize the entire Greenlight report into a 500-word executive brief for producers.")}
                    className="px-4 py-2 bg-secondary border border-border text-foreground hover:bg-muted text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-[#75A5ED]" /> Briefing
                  </button>
                </div>
              </div>

              {/* Core Greenlight analysis */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                
                {/* Score and action */}
                <Card className="bg-[#131315] border-border text-center flex flex-col justify-between gap-4 p-6 min-h-[200px] h-auto overflow-visible">
                  <div className="space-y-2">
                    <h4 className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Recommended Next Action</h4>
                    <span className="text-2xl sm:text-3xl font-extrabold text-[#75A5ED] block pt-2 break-words leading-tight">{recommendation.status}</span>
                    <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded inline-block">
                      Score {recommendation.score}/100
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground pt-4 border-t border-border/60">
                    Confidence: <strong>{recommendation.confidence}</strong>
                    <br />
                    <span className="text-slate-300 mt-2 block leading-relaxed break-words whitespace-pre-wrap">{recommendation.summary}</span>
                  </div>
                </Card>

                {/* Why it works */}
                <Card className="bg-[#131315] border-border p-6 md:col-span-2 flex flex-col justify-between min-h-[200px] h-auto overflow-visible">
                  <div>
                    <h4 className="text-xs text-emerald-400 uppercase font-bold tracking-widest mb-3 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-emerald-400" /> Why this screenplay works
                    </h4>
                    <ul className="space-y-3.5 text-xs text-muted-foreground leading-relaxed list-disc pl-4">
                      {whyItWorks.length === 0 && <li>Insights will appear after greenlight analysis.</li>}
                      {whyItWorks.map((item, idx) => (
                        <li key={idx} className="break-words whitespace-pre-wrap">
                          <span className="text-slate-200">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </div>

              {/* Exposure matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Killers */}
                <Card className="bg-[#131315] border-border">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" /> What could kill this project
                    </h3>
                    <ul className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                      {killRisks.length === 0 && <li>No kill risks identified yet.</li>}
                      {killRisks.map((risk, idx) => (
                        <li key={idx}>
                          <strong className="text-foreground block">{risk.title} <span className="text-red-400 font-normal">({risk.severity})</span></strong>
                          {risk.summary}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Next Steps outline */}
                <Card className="bg-[#131315] border-border">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-200">Recommended Production Steps</h3>
                    <div className="space-y-4 text-xs">
                      {nextSteps.length === 0 && (
                        <p className="text-muted-foreground">Next steps will appear after greenlight analysis.</p>
                      )}
                      {nextSteps.map((s, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-[#75A5ED] shrink-0">{idx + 1}</div>
                          <div>
                            <strong className="text-foreground block">{s.step}</strong>
                            {(s.owner || s.timing) && (
                              <span className="text-muted-foreground">
                                {[s.owner, s.timing].filter(Boolean).join(" · ")}
                              </span>
                            )}
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

        </div>
      </div>
    </div>
  )
})

export default FilmWorkspace
