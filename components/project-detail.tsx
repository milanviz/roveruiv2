"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Film, Plus, Search, X } from "lucide-react"
import { useSearchParams, Link } from "@/lib/spa-router"
import { useProjectStore } from "@/app/store/project/project.store"
import type { ProjectType } from "@/types/project-types"
import type { ChatTurn } from "@/types/chat"
import FilmWorkspace from "./FilmWorkspace"
import ChatWorkspace from "./ChatWorkspace"
import { GetChatHistory, SaveToinsights, getMessageResponse, stopStreaming, translateAnswer } from "@/controllers/ask-rover-controller"

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

export default function ProjectDetail() {
  const searchParams = useSearchParams()
  const scriptId = searchParams.get("script_id") || searchParams.get("scriptId")
  const urlProjectId = searchParams.get("projectId") || ""
  const generateIfMissing = searchParams.get("generate") === "1"
  const projects = useProjectStore((state) => state.projects)
  const selectedProject = useProjectStore((state) => state.selectedProject[0] as ProjectType | undefined)
  const setSelectedProject = useProjectStore((state) => state.setSelectedProject)
  const [projectTitle, setProjectTitle] = useState(selectedProject?.ProjectName || "")
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [projectSearch, setProjectSearch] = useState("")
  const [filmTab, setFilmTab] = useState("Overview")
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyAttempt, setHistoryAttempt] = useState(0)
  const [active, setActive] = useState(false)
  const [source, setSource] = useState("Public")
  const requestRef = useRef(0)

  const isFilmProject = selectedProject?.AIAgent === "Film Intelligence Specialist" || Boolean(scriptId)
  const filteredProjects = useMemo(() => projects.filter((project) =>
    `${project.ProjectName} ${project.AIAgent}`.toLowerCase().includes(projectSearch.toLowerCase()),
  ), [projects, projectSearch])

  useEffect(() => setFilmTab("Overview"), [selectedProject?.ProjectID])

  useEffect(() => {
    if (!scriptId) return
    let cancelled = false
    fetch(`/api/film-projects/${encodeURIComponent(scriptId)}/`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((data) => {
        if (cancelled || !data.project) return
        const row = data.project
        const title = selectedProject?.ProjectName || row.title || data.metadata?.title || data.metadata?.screenplay_title || row.file_name || "Film Project"
        setProjectTitle(title)
        if (!selectedProject || selectedProject.ProjectID !== row.project_id) {
          setSelectedProject([{ ProjectID: row.project_id || `script-${scriptId}`, ProjectName: title, Summary: row.genre ? `${row.genre} screenplay analysis` : "Film Intelligence project", AIAgent: "Film Intelligence Specialist", CreatedBy: selectedProject?.CreatedBy || "", CreatedOn: row.created_at || new Date().toISOString().slice(0, 10), rowid: row.project_id || scriptId } as ProjectType])
        }
      })
      .catch((error) => console.error("Failed to hydrate film project", error))
    return () => { cancelled = true }
  }, [scriptId])

  useEffect(() => {
    if (!projectMenuOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setProjectMenuOpen(false) }
    document.addEventListener("keydown", close)
    return () => document.removeEventListener("keydown", close)
  }, [projectMenuOpen])

  useEffect(() => {
    const projectId = selectedProject?.ProjectID
    const loadId = ++requestRef.current
    stopStreaming()
    setActive(false)
    setTurns([])
    setHistoryError(null)
    setHistoryLoading(Boolean(projectId))
    setProjectTitle(selectedProject?.ProjectName || "")
    if (!projectId) return

    GetChatHistory(projectId, () => {})
      .then((result) => {
        if (requestRef.current !== loadId) return
        const loaded: ChatTurn[] = result.history.flatMap((item: any, index: number) => {
          const questionId = `history-${projectId}-${index}`
          const saved = Boolean(item.count && Number(item.count) > 0)
          return [
            { id: `${questionId}-user`, role: "user" as const, status: "complete" as const, content: item.question, questionId },
            { id: `${questionId}-assistant`, role: "assistant" as const, status: "complete" as const, content: item.answer, questionId, qid: item.qid, userlist: item.userlist, count: item.count, saved },
          ]
        })
        setTurns(loaded)
      })
      .catch((error) => {
        if (requestRef.current === loadId) setHistoryError(error instanceof Error ? error.message : "Unable to load chat history.")
      })
      .finally(() => {
        if (requestRef.current === loadId) setHistoryLoading(false)
      })

    return () => {
      if (requestRef.current === loadId) requestRef.current++
      stopStreaming()
    }
  }, [selectedProject?.ProjectID, historyAttempt])

  const send = useCallback((question: string) => {
    if (!selectedProject || active || !question.trim()) return
    const requestId = ++requestRef.current
    const questionId = makeId()
    const assistantId = `${questionId}-assistant`
    setTurns((current) => [...current,
      { id: `${questionId}-user`, role: "user", status: "complete", content: question.trim(), questionId, source },
      { id: assistantId, role: "assistant", status: "pending", content: "", questionId, source },
    ])
    setActive(true)

    const updateAssistant = (patch: Partial<ChatTurn>) => {
      if (requestRef.current !== requestId) return
      setTurns((current) => current.map((turn) => turn.id === assistantId ? { ...turn, ...patch } : turn))
    }
    void getMessageResponse(question.trim(), source, selectedProject, {
      onStart: () => updateAssistant({ status: "pending" }),
      onChunk: (content) => updateAssistant({ status: "streaming", content }),
      onComplete: (content) => { updateAssistant({ status: "complete", content }); if (requestRef.current === requestId) setActive(false) },
      onCancel: (content) => { updateAssistant({ status: "cancelled", content }); if (requestRef.current === requestId) setActive(false) },
      onError: (error, partial) => { updateAssistant({ status: "error", content: partial, error }); if (requestRef.current === requestId) setActive(false) },
    })
  }, [selectedProject, active, source])

  const stop = useCallback(() => {
    stopStreaming()
    // Abort callbacks retain partial content and own the final status.
  }, [])

  const originalQuestion = useCallback((assistant: ChatTurn) =>
    turns.find((turn) => turn.role === "user" && turn.questionId === assistant.questionId)?.content || "",
  [turns])

  const save = useCallback((turn: ChatTurn) => {
    const nextSaved = !turn.saved
    setTurns((current) => current.map((item) => item.id === turn.id ? { ...item, saved: nextSaved } : item))
    void SaveToinsights(turn.qid || "", turn.userlist || "", turn.count || "", nextSaved)
  }, [])

  const translate = useCallback((turn: ChatTurn) => {
    if (turn.translated) {
      setTurns((current) => current.map((item) => item.id === turn.id ? { ...item, translated: undefined } : item))
      return
    }
    void translateAnswer(turn.content, (text, code) => {
      setTurns((current) => current.map((item) => item.id === turn.id ? { ...item, translated: { text, code } } : item))
    }, (error) => console.error("Translation failed", error))
  }, [])

  const chooseProject = (project: ProjectType) => {
    stopStreaming()
    requestRef.current++
    setActive(false)
    setSelectedProject([project])
    setProjectMenuOpen(false)
    setProjectSearch("")
    setFilmTab("Overview")
  }

  const film = <FilmWorkspace
    projectId={urlProjectId || selectedProject?.ProjectID || ""}
    scriptId={scriptId}
    projectName={projectTitle}
    userId={selectedProject?.user_id}
    userEmail={selectedProject?.user_email || selectedProject?.CreatedBy}
    fileName={selectedProject?.file_name}
    fileUrl={selectedProject?.file_full_url}
    generateIfMissing={generateIfMissing}
    onAskRover={(question) => { setFilmTab("Ask Rover"); window.setTimeout(() => send(question), 0) }}
    activeTab={filmTab}
    setActiveTab={setFilmTab}
  />

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-black/10">
      <header className="relative z-30 shrink-0 px-4 pb-3 pt-5 sm:px-6 lg:px-8">
        <button onClick={() => setProjectMenuOpen((open) => !open)} className="focus-ring flex max-w-[min(100%,900px)] items-center gap-2 rounded-lg text-left" aria-expanded={projectMenuOpen}>
          <h1 className="truncate text-lg font-normal text-foreground">{projectTitle || "Select a project"}</h1><ChevronDown size={20} className="shrink-0 text-muted-foreground" />
        </button>
        {projectMenuOpen && <div className="rover-surface absolute left-4 top-full w-[min(480px,calc(100vw-2rem))] overflow-hidden sm:left-6" role="dialog" aria-label="Select project">
          <div className="flex items-center justify-between border-b border-white/10 p-3"><span className="text-sm">All projects</span><Link href="/projects/project-create" className="focus-ring flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black"><Plus size={14} /> New project</Link></div>
          <div className="p-3"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} /><input autoFocus value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="Search projects" className="h-10 w-full rounded-lg border border-white/10 bg-black/20 pl-9 pr-3 text-sm outline-none focus:border-[#8f85ff]/60" /></div>
            <div className="mt-2 max-h-[min(50vh,360px)] space-y-1 overflow-y-auto">{filteredProjects.map((project) => <button key={project.ProjectID} onClick={() => chooseProject(project)} className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/[.05]"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#776af2]/10 text-[#9e96ff]">{project.AIAgent === "Film Intelligence Specialist" ? <Film size={15} /> : "✦"}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm">{project.ProjectName}</span><span className="block truncate text-xs text-muted-foreground">{project.AIAgent}</span></span>{project.ProjectID === selectedProject?.ProjectID && <Check size={15} />}</button>)}{filteredProjects.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No projects found</p>}</div>
          </div>
          <button onClick={() => setProjectMenuOpen(false)} aria-label="Close project selector" className="focus-ring absolute right-2 top-2 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/10 sm:hidden"><X size={16} /></button>
        </div>}
      </header>

      {isFilmProject ? <div className="flex min-h-0 flex-1 flex-col">{film}{filmTab === "Ask Rover" && <ChatWorkspace projectName={projectTitle} turns={turns} loading={historyLoading} historyError={historyError} active={active} source={source} onSourceChange={setSource} onSend={send} onStop={stop} onRetryHistory={() => setHistoryAttempt((value) => value + 1)} onSave={save} onTranslate={translate} onRegenerate={(turn) => send(originalQuestion(turn))} />}</div> : <ChatWorkspace projectName={projectTitle} turns={turns} loading={historyLoading} historyError={historyError} active={active} source={source} onSourceChange={setSource} onSend={send} onStop={stop} onRetryHistory={() => setHistoryAttempt((value) => value + 1)} onSave={save} onTranslate={translate} onRegenerate={(turn) => send(originalQuestion(turn))} />}
    </div>
  )
}
