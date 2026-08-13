"use client"

import {
  ChevronDown,
  Download,
  Share2,
  Trash2,
  Archive,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Globe,
  Paperclip,
  Send,
  Star,
  FileText,
  Briefcase,
  TrendingUp,
  PieChart,
  GitCompare,
  ArrowRight,
  Edit3,
  Pin,
  Bookmark,
  Languages,
  Copy,
  RotateCcw,
  StickyNote,
  MessageSquarePlus,
  Search,
  Check,
  Plus,
  CloudHail,
  ArrowDown,
} from "lucide-react"
import { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect, forwardRef, useImperativeHandle, memo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useProjectStore } from "@/app/store/project/project.store";
import { ProjectType } from "@/types/project-types"
import MarkdownRenderer from "./markdownrenderer";
import { getMessageResponse, stopStreaming, translateAnswer } from "@/controllers/ask-rover-controller";
import { SaveToinsights, GetChatHistory } from "@/controllers/ask-rover-controller";
import { UniversalPopup } from "./universal-popup";
import { GetProjectsController, ShareProject, ArchiveProjects } from "@/controllers/project-controller"
import Image from "next/image"
import ChatLoader from "./loader/loader";
import FilmWorkspace from "./FilmWorkspace";

const ROTATING_TITLES = ["Ask ROVER Anything", "Discover. Analyse. Improve.", "Explore. Learn. Thrive."]
const ROTATING_PLACEHOLDERS = [
  "How can AI improve customer engagement?",
  "Explain recent trends in the EV market.",
  "What are the top innovations in renewable energy?",
  "How to identify market gaps using data analytics?",
]

// Memoize heavy renderer to avoid re-renders when parent updates
const MemoizedMarkdownRenderer = memo(MarkdownRenderer)

type TextareaController = {
  send: () => void
}

type UncontrolledTextareaProps = {
  initialValue?: string
  placeholder?: string
  className?: string
  onSend: (text: string) => void
  onBlurSync?: (text: string) => void
  domRef?: React.RefObject<HTMLTextAreaElement | null>
  sendMessage: boolean
}

const UncontrolledTextarea = forwardRef<TextareaController, UncontrolledTextareaProps>(
  ({ initialValue = "", placeholder = "", className = "", onSend, onBlurSync, domRef, sendMessage }, ref) => {
    const fallbackRef = useRef<HTMLTextAreaElement | null>(null)
    const internalRef = domRef || fallbackRef
    const [hasText, setHasText] = useState<boolean>(initialValue.length > 0)

    useImperativeHandle(ref, () => ({
      send: () => {
        const value = internalRef.current?.value ?? ""
        if (!value.trim()) return
        onSend(value.trim())
        if (internalRef.current) internalRef.current.value = ""
        setHasText(false)
      },
    }), [onSend])

    return (
      <textarea
        ref={internalRef}
        defaultValue={initialValue}
        placeholder={placeholder}
        className={className}
        onChange={(e) => setHasText(e.currentTarget.value.length > 0)}
        onBlur={() => onBlurSync?.(internalRef.current?.value ?? "")}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !sendMessage) {
            e.preventDefault()
            const value = internalRef.current?.value ?? ""
            if (value.trim()) {
              onSend(value.trim())
              if (internalRef.current) internalRef.current.value = ""
              setHasText(false)
            }
          }
        }}
      />
    )
  }
)


export default function ProjectDetail() {
  const searchParams = useSearchParams()
  const scriptIdFromUrl = searchParams.get("script_id") || searchParams.get("scriptId")

  const [hoveredQuestion, setHoveredQuestion] = useState<number | null>(null)
  const [savedAnswers, setSavedAnswers] = useState<Set<number>>(new Set())
  const [translatedAnswers, setTranslatedAnswers] = useState<Map<number, { text: string; code: string }>>(new Map())
  const [copiedAnswer, setCopiedAnswer] = useState<number | null>(null)

  const [copied, setCopied] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  // Use CSS-only hover visuals to avoid render churn
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [selectedVisibility, setSelectedVisibility] = useState("Public")
  const [selectedIcon, setSelectedIcon] = useState("public.png")
  const [activeTab, setActiveTab] = useState("Inspiration")
  const [activeFilmTab, setActiveFilmTab] = useState("Overview")
  const [isChatMode, setIsChatMode] = useState<boolean | string>("")
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [messages, setMessages] = useState<Array<{
    question: string;
    answer: string;
    qid: string;
    userlist: string;
    count: string
  }>>([])
  const [isTyping, setIsTyping] = useState(false)
  const [currentInput, setCurrentInput] = useState("")
  const [typingText, setTypingText] = useState("")
  const [pendingQuestion, setPendingQuestion] = useState("")

  const [projectSearch, setProjectSearch] = useState("")
  const projectSearchRef = useRef<HTMLInputElement | null>(null)
  const searchDebounceRef = useRef<number | null>(null)
  const [selectedProjectTitle, setSelectedProjectTitle] = useState("")
  const [isChatActive, setIsChatActive] = useState(false)

  const [pausePlaceholderAnimation, setPausePlaceholderAnimation] = useState(false)
  const [sendMessage, setSendMessage] = useState(false)
  const [readyForSendMessage, setReadyForSendMessage] = useState(false)
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)

  const modalRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const currentAnswerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Animation refs to avoid re-renders during animations
  const animationStateRef = useRef({
    currentTitleIndex: 0,
    currentPlaceholderIndex: 0,
    titleFade: true,
    placeholderFade: true,
  })
  const titleElementRef = useRef<HTMLDivElement>(null)
  const placeholderElementRef = useRef<HTMLTextAreaElement>(null)
  const mainTextareaControllerRef = useRef<TextareaController | null>(null)
  const chatTextareaControllerRef = useRef<TextareaController | null>(null)
  const chatDomRef = useRef<HTMLTextAreaElement>(null)
  const isUserAtBottomRef = useRef(true)

  // Memoized chatOptions to prevent recreating on every render
  const chatOptions = useMemo(() => [
    { option: "Public", icon: "public.png" },
    { option: "Documents", icon: "Document.png" },
    { option: "Insights", icon: "Saved_Insights.png" },
  ], [])
  const appendMessages = useCallback((incoming: any) => {
    if (typeof incoming === "function") {
      setMessages((prev) => {
        const res = incoming(prev)
        if (!res) return prev

        if (Array.isArray(res) && res.length >= prev.length) {
          let isPrefix = true
          for (let i = 0; i < prev.length; i++) {
            if (JSON.stringify(prev[i]) !== JSON.stringify(res[i])) {
              isPrefix = false
              break
            }
          }
          if (isPrefix) return res
        }

        const toAppend = Array.isArray(res) ? res : [res]
        const seen = new Set(prev.map((m) => (m.question || "") + "||" + (m.answer || "")))
        const filtered = toAppend.filter((m) => {
          const key = (m.question || "") + "||" + (m.answer || "")
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        return [...prev, ...filtered]
      })
    } else {
      setMessages((prev) => {
        if (!incoming) return prev
        const incomingArr = Array.isArray(incoming) ? incoming : [incoming]
        const seen = new Set(prev.map((m) => (m.question || "") + "||" + (m.answer || "")))
        const filtered = incomingArr.filter((m) => {
          const key = (m.question || "") + "||" + (m.answer || "")
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        if (filtered.length === 0) return prev
        return [...prev, ...filtered]
      })
    }

    // scroll to bottom after DOM updates (no animation)
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
    }, 0)
  }, [])

  const projects = useProjectStore((state) => state.projects);
  const setSelectedProject = useProjectStore((state) => state.setSelectedProject);
  // Select the active project directly from the store so the component
  // only re-runs effects when the project's identity (or its ID) changes.
  const selectedProject = useProjectStore((state) => state.selectedProject[0] as ProjectType | undefined);
  const isFilmProject = selectedProject?.AIAgent === "Film Intelligence Specialist" || Boolean(scriptIdFromUrl);

  // When landing with ?script_id=, hydrate selected project from SQLite if needed
  useEffect(() => {
    if (!scriptIdFromUrl) return

    let cancelled = false
    const hydrateFromScriptId = async () => {
      try {
        const res = await fetch(`/api/film-projects/${encodeURIComponent(scriptIdFromUrl)}/`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        const row = data.project
        if (!row) return

        const title =
          selectedProject?.ProjectName ||
          row.title ||
          data.metadata?.title ||
          data.metadata?.screenplay_title ||
          data.metadata?.file_name ||
          row.file_name ||
          "Film Project"

        setSelectedProjectTitle(title)

        // If store project doesn't match, synthesize a film project entry
        if (!selectedProject || selectedProject.ProjectID !== row.project_id) {
          setSelectedProject([
            {
              ProjectID: row.project_id || `script-${scriptIdFromUrl}`,
              ProjectName: title,
              Summary: row.genre ? `${row.genre} screenplay analysis` : "Film Intelligence project",
              AIAgent: "Film Intelligence Specialist",
              CreatedBy: selectedProject?.CreatedBy || "",
              CreatedOn: row.created_at || new Date().toISOString().split("T")[0],
              rowid: row.project_id || scriptIdFromUrl,
            } as ProjectType,
          ])
        }
      } catch (e) {
        console.error("Failed to hydrate project from script_id:", e)
      }
    }

    hydrateFromScriptId()
    return () => {
      cancelled = true
    }
  }, [scriptIdFromUrl])

  // Dynamic questions state for Popular Research Topics
  const [tabQuestions, setTabQuestions] = useState<Record<string, string[]>>({});

  // Ensure activeTab is valid for the current project
  useEffect(() => {
    const availableTabs = Object.keys(tabQuestions);
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    } else if (availableTabs.length > 0 && activeTab === "Inspiration" && !availableTabs.includes("Inspiration")) {
      // If "Inspiration" (default) is not in the list, switch to the first available one
      setActiveTab(availableTabs[0]);
    }
  }, [tabQuestions, activeTab]);

  // debug: removed verbose logging to avoid noise during renders
  // console.log('projectParamData--------------', projectParamData);

  const filteredProjects = projects.filter(
    (project) =>
      project.ProjectName.toLowerCase().includes(projectSearch.toLowerCase()) ||
      project.AIAgent.toLowerCase().includes(projectSearch.toLowerCase()),
  )

  // Pagination settings: show 4 projects per page
  const projectsPerPage = 4
  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage)
  const startIndex = (currentPage - 1) * projectsPerPage
  const pageProjects = filteredProjects.slice(startIndex, startIndex + projectsPerPage)

  // If filteredProjects changes such that currentPage is out of range, clamp it.
  useEffect(() => {
    if (totalPages === 0) {
      setCurrentPage(1)
    } else if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  const handleProjectSelect = (project: ProjectType) => {
    setSelectedProject([project])
    setSelectedProjectTitle(project.ProjectName)
    setIsModalOpen(false)
    setIsChatMode(false)
    setMessages([])
    setCurrentInput("")
    setProjectSearch("")
  }

  const handleSave = useCallback((index: number, qid: string, userlist: string, count: string) => {
    const isSaved = savedAnswers.has(index)
    const newIsSaved = !isSaved

    setSavedAnswers((prev) => {
      const newSet = new Set(prev)
      if (newIsSaved) {
        newSet.add(index)
      } else {
        newSet.delete(index)
      }
      return newSet
    })

    SaveToinsights(qid, userlist, count, newIsSaved)
  }, [savedAnswers])

  const handleTranslate = useCallback((index: number) => {
    const isCurrentlyTranslated = translatedAnswers.has(index);

    if (isCurrentlyTranslated) {
      // Toggle back to original
      setTranslatedAnswers((prev) => {
        const newMap = new Map(prev);
        newMap.delete(index);
        return newMap;
      });
    } else {
      // Translate
      const originalAnswer = messages[index]?.answer || "";
      translateAnswer(
        originalAnswer,
        (translatedText, languageCode) => {
          setTranslatedAnswers((prev) => {
            const newMap = new Map(prev);
            newMap.set(index, { text: translatedText, code: languageCode });
            return newMap;
          });
        },
        (error) => {
          console.error("Translation failed:", error);
          // Silently fail - do not show translation
        }
      );
    }
  }, [translatedAnswers, messages])

  const handleCopyAnswer = useCallback((index: number) => {
    const answer = new DOMParser()
      .parseFromString(messages[index].answer, "text/html")
      .body.textContent || "";

    navigator.clipboard.writeText(answer);

    setCopiedAnswer(index);
    setTimeout(() => setCopiedAnswer(null), 2000);
  }, [messages])

  const handleCopy = useCallback((index: number) => {
    setCopied(index)
    setTimeout(() => setCopied(null), 2000)
  }, [])

  const toggleModal = useCallback(() => {
    setIsModalOpen(!isModalOpen)
  }, [isModalOpen])

  const handleQuestionClick = useCallback(async (question: string) => {
    setIsChatMode(true)
    setCurrentInput("")
    setPendingQuestion(question)
    if (!selectedProject) {
      console.warn("No project selected - cannot send question")
      return
    }

    getMessageResponse(
      question,
      selectedVisibility,
      selectedProject,
      isTyping,
      setIsTyping,
      currentAnswerRef,
      setTypingText,
      appendMessages,
      setPendingQuestion,
      setIsChatActive,
      setSendMessage,
      setReadyForSendMessage
    );
    isUserAtBottomRef.current = true;
  }, [selectedVisibility, selectedProject, isTyping, appendMessages])

  const handleSendMessage = useCallback(async (text?: string) => {
    setIsChatActive(true)
    const question = (text ?? "").trim()
    if (!question) return
    setIsChatMode(true)
    setPendingQuestion(question)
    setCurrentInput("")
    setReadyForSendMessage(false)
    if (!selectedProject) {
      console.warn("No project selected - cannot send question")
      return
    }

    getMessageResponse(
      question,
      selectedVisibility,
      selectedProject,
      isTyping,
      setIsTyping,
      currentAnswerRef,
      setTypingText,
      appendMessages,
      setPendingQuestion,
      setIsChatActive,
      setSendMessage,
      setReadyForSendMessage
    )
    isUserAtBottomRef.current = true;
  }, [selectedVisibility, selectedProject, isTyping, appendMessages])

  const ChatWith = useCallback((selectedOption: string, optionIcon: string) => {
    setSelectedVisibility(selectedOption)
    setSelectedIcon(optionIcon)
    setIsDropdownOpen(false)
  }, [])

  /* handleScroll removed - using existing definition below */

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    // Also ensure container scrolls to max
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  // input typing is handled by UncontrolledTextarea to avoid parent re-renders

  // Title rotation animation - using DOM refs to avoid re-renders
  useLayoutEffect(() => {
    if (isChatMode || !titleElementRef.current) return

    const titleInterval = setInterval(() => {
      // Update fade out
      if (titleElementRef.current) {
        titleElementRef.current.style.opacity = "0"
      }

      setTimeout(() => {
        // Update title index in ref
        animationStateRef.current.currentTitleIndex =
          (animationStateRef.current.currentTitleIndex + 1) % ROTATING_TITLES.length

        // Update title text in DOM
        if (titleElementRef.current) {
          titleElementRef.current.textContent = ROTATING_TITLES[animationStateRef.current.currentTitleIndex]
          titleElementRef.current.style.opacity = "1"
        }
      }, 500)
    }, 4000)

    return () => clearInterval(titleInterval)
  }, [isChatMode])

  // Placeholder rotation animation - using DOM refs to avoid re-renders
  useLayoutEffect(() => {
    if (isChatMode || pausePlaceholderAnimation || (placeholderElementRef.current?.value || "").length > 0 || !placeholderElementRef.current) return

    const placeholderInterval = setInterval(() => {
      // Abort animation if user has typed something
      if (placeholderElementRef.current && placeholderElementRef.current.value.length > 0) return

      // Update fade out
      if (placeholderElementRef.current) {
        placeholderElementRef.current.style.opacity = "0"
      }

      setTimeout(() => {
        // Update placeholder index in ref
        animationStateRef.current.currentPlaceholderIndex =
          (animationStateRef.current.currentPlaceholderIndex + 1) % ROTATING_PLACEHOLDERS.length

        // Update placeholder text in DOM
        if (placeholderElementRef.current) {
          placeholderElementRef.current.placeholder = ROTATING_PLACEHOLDERS[animationStateRef.current.currentPlaceholderIndex]
          placeholderElementRef.current.style.opacity = "1"
        }
      }, 500)
    }, 5000)

    return () => clearInterval(placeholderInterval)
  }, [isChatMode, pausePlaceholderAnimation, currentInput.length])


  useEffect(() => {
    let active = true
    const loadHistory = async () => {
      const projectId = selectedProject?.ProjectID

      if (!projectId) {
        if (active) {
          setSelectedProjectTitle("")
          setHistoryLoaded(true)
        }
        return
      }

      try {
        // Use appendMessages but we handle the UI switch manually
        const result = await GetChatHistory(projectId, appendMessages)

        if (!active) return

        // Set dynamic questions from API response or from the selected project
        const questionsToUse = result.questions || selectedProject?.questions;
        if (questionsToUse && typeof questionsToUse === 'object' && Object.keys(questionsToUse).length > 0) {
          setTabQuestions(questionsToUse);
        }

        if (result.history && result.history.length > 0) {
          // setMessages(result.history) // GetChatHistory already calls appendMessages which calls setMessages
          setIsChatMode(true)

          // Initialize savedAnswers based on UpVotedCount or UpvotedJSON
          const newSavedAnswers = new Set<number>()
          result.history.forEach((msg: any, idx: number) => {
            // Check if UpVotedCount > 0 or if current user is in UpvotedJSON
            if (msg.count && parseInt(msg.count) > 0) {
              newSavedAnswers.add(idx)
            } else if (msg.userlist) {
              try {
                const userList = JSON.parse(msg.userlist)
                const currentUserEmail = selectedProject?.CreatedBy || ""
                if (Array.isArray(userList) && userList.includes(currentUserEmail)) {
                  newSavedAnswers.add(idx)
                }
              } catch (e) {
                // If parsing fails, ignore
              }
            }
          })
          setSavedAnswers(newSavedAnswers)

          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
          }, 0)
        } else {
          setIsChatMode(false)
        }
      } catch (err) {
        if (active) console.error("Error loading chat history:", err)
      } finally {
        if (active) {
          setSelectedProjectTitle(selectedProject?.ProjectName ?? "")
          setHistoryLoaded(true)
          // Clear the skip flag after history loads
          try {
            sessionStorage.removeItem("skipProjectDetailLoader")
          } catch { }
        }
      }
    }

    loadHistory()
    return () => { active = false }
  }, [selectedProject?.ProjectID, selectedProject?.CreatedBy, appendMessages])

  // Auto-scroll when a new question is pending (user submitted a question)
  useEffect(() => {
    if (pendingQuestion && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
    }
  }, [pendingQuestion])

  // Auto-scroll during streaming response
  useEffect(() => {
    if (isTyping && typingText && scrollContainerRef.current) {
      if (isUserAtBottomRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }
  }, [typingText, isTyping])

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Check if user is near bottom (within 100px tolerance)
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    isUserAtBottomRef.current = isNearBottom;
    setShowScrollButton(!isNearBottom);
  }, [])

  // Force scroll to bottom when chat mode activates or messages load initially
  useEffect(() => {
    if (isChatMode && messages.length > 0) {
      // Using a small timeout to ensure DOM is ready
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 100)
    }
  }, [isChatMode, messages.length])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      // Ignore Radix dialogs
      if (target.closest("[data-radix-portal]")) return

      if (
        modalRef.current &&
        !modalRef.current.contains(target) &&
        titleRef.current &&
        !titleRef.current.contains(target)
      ) {
        setIsModalOpen(false)
      }

      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsDropdownOpen(false)
      }
    }

    if (isModalOpen || isDropdownOpen) {
      document.addEventListener("click", handleClickOutside)
    }

    return () => {
      document.removeEventListener("click", handleClickOutside)
    }
  }, [isModalOpen, isDropdownOpen])



  const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX || "";
  const skipLoading = (() => {
    try {
      return sessionStorage.getItem("skipProjectDetailLoader") === "true"
    } catch {
      return false
    }
  })()

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 relative">
        <div
          ref={titleRef}
          onClick={toggleModal}
          className="flex items-start gap-2 cursor-pointer hover:opacity-80 transition-opacity w-[1100px]"
        >
          <h1 className="text-lg font-normal text-foreground">{selectedProjectTitle.length > 200
            ? `${selectedProjectTitle.slice(0, 200)}…`
            : selectedProjectTitle}
          </h1>
          <div className="w-[30px] h-[30px]">
            <ChevronDown size={25} className="text-muted-foreground" />
          </div>
        </div>

        {isModalOpen && (
          <div
            ref={modalRef}
            className="absolute left-8 top-full mt-2 w-[520px] bg-[#1F1F1F] rounded-xl border border-border backdrop-blur-sm z-50 flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="w-full flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-normal text-foreground">All Projects</h2>
              </div>
              <Link
                href="/projects/project-create"
                className="px-3 py-1.5 bg-background border border-[#282828] rounded-md text-sm text-foreground  transition-colors flex items-center gap-2 h-[37px] w-[138px] cursor-pointer"
              >
                <Image
                  src={`${assetPrefix}/assets/icons/pen.svg`}
                  alt="Pen Icon"
                  width={16}
                  height={16}
                  className="block"
                />
                New Project
              </Link>
            </div>

            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  defaultValue={projectSearch}
                  ref={projectSearchRef}
                  onChange={(e) => {
                    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current)
                    const v = e.currentTarget.value
                    searchDebounceRef.current = window.setTimeout(() => setProjectSearch(v), 250)
                  }}
                  onBlur={() => setProjectSearch(projectSearchRef.current?.value ?? "")}
                  placeholder="Search here..."
                  className="w-full pl-10 pr-3 py-2 border border-[#3B3B3B] rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-2 max-h-[400px]">
              {filteredProjects.length > 0 ? (
                pageProjects.map((project, idx) => {
                  return selectedProject?.ProjectID === project.ProjectID ? null : (
                    <div
                      key={project.ProjectID}
                      onClick={() => handleProjectSelect(project)}
                      className="p-3 rounded-lg border border-transparent
                        hover:border-[#3C3C3C]
                        hover:bg-muted/30
                        transition-all
                        cursor-pointer
                        bg-[#191919] relative group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-foreground mb-1">
                            {project.ProjectName.length > 200
                              ? `${project.ProjectName.slice(0, 200)}…`
                              : project.ProjectName
                            }
                          </h3>
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="text-primary">{project.AIAgent}</span>
                            <div className="flex items-center gap-2 transition-opacity duration-200 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                              {project.CreatedOn && <span className="text-primary-text">{project.CreatedOn}</span>}
                              <span className="text-muted-foreground">|</span>
                              <UniversalPopup
                                mode="email"
                                title="Share Project"
                                description="Enter an email address to share the project."
                                trigger={
                                  <button className="w-[31.29px] h-[31.29px] flex items-center justify-center rounded-full bg-[#201F1F] hover:bg-secondary text-icon-secondary hover:text-destructive cursor-pointer" >
                                    <span><Image src={`${assetPrefix}/assets/icons/share.svg`} alt="Rover Logo" width={14} height={14} /></span>
                                  </button>
                                }
                                onSend={(email) => ShareProject(project.ProjectID, "adduser", email)}
                              />
                              <UniversalPopup
                                mode="delete"
                                title="Delete Project?"
                                description="This action cannot be undone."
                                trigger={
                                  <button
                                    className="w-[31.29px] h-[31.29px] flex items-center justify-center rounded-full bg-[#201F1F] hover:bg-secondary text-icon-secondary hover:text-destructive cursor-pointer"
                                  >
                                    <Image
                                      src={`${assetPrefix}/assets/icons/archive.svg`}
                                      alt="Archive Icon"
                                      width={14}
                                      height={14}
                                    />
                                  </button>
                                }
                                onConfirm={async () => {
                                  await ArchiveProjects("Yes", "Archive", project.rowid ?? "");
                                  await GetProjectsController();
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="underline-gradient"></div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">No projects found</div>
              )}
            </div>

            {/* Pagination (show only when more than one page) */}
            {totalPages > 1 && (
              <div className="p-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded text-sm transition-colors cursor-pointer ${currentPage === page
                      ? "bg-[#75A5ED] text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      } `}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* If it's a Film project and active tab is NOT "Ask Rover", render Film Workspace panels directly */}
      {isFilmProject ? (
        activeFilmTab !== "Ask Rover" ? (
          <FilmWorkspace
            projectId={selectedProject?.ProjectID || ""}
            scriptId={scriptIdFromUrl}
            projectName={selectedProjectTitle}
            onAskRover={(q) => {
              setActiveFilmTab("Ask Rover");
              handleQuestionClick(q);
            }}
            activeTab={activeFilmTab}
            setActiveTab={setActiveFilmTab}
          />
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <FilmWorkspace
              projectId={selectedProject?.ProjectID || ""}
              scriptId={scriptIdFromUrl}
              projectName={selectedProjectTitle}
              onAskRover={() => {}}
              activeTab={activeFilmTab}
              setActiveTab={setActiveFilmTab}
            />
            {/* Main Content - Scrollable */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 min-h-0 overflow-y-auto scrollbar-custom px-8 relative"
            >
              <div className={`pb-32 flex justify-center ${!isChatMode ? "pt-[180px]" : ""}`}>
                <div className="w-[920px] space-y-12">
                  {!historyLoaded && !skipLoading ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">Loading...</div>
                  ) : isChatMode === "" ? <div className="h-48 flex items-center justify-center text-muted-foreground">Loading...</div>
                    : !isChatMode ? (
                      <>
                        <div className="text-center mb-7">
                          <div className="flex items-center pl-55 gap-3">
                            <Image
                              src={`${assetPrefix}/assets/gif/star-ai-loader.gif`}
                              alt="Pen Icon"
                              width={25}
                              height={25}
                              className="block"
                            />
                            <h2
                              ref={titleElementRef}
                              className="text-[29.88px] font-none transition-opacity duration-500 text-gradient opacity-100"
                              style={{ transition: "opacity 500ms ease-in-out" }}
                            >
                              {ROTATING_TITLES[animationStateRef.current.currentTitleIndex]}
                            </h2>
                          </div>
                        </div>

                        <div className="mb-[35px]">
                          <div className="rounded-2xl bg-[#1a1a1a] py-4 px-6 min-h-[113px] flex flex-col border border-[#3C3C3C]">
                            <UncontrolledTextarea
                              ref={mainTextareaControllerRef}
                              domRef={placeholderElementRef}
                              initialValue={currentInput}
                              placeholder={ROTATING_PLACEHOLDERS[animationStateRef.current.currentPlaceholderIndex]}
                              className="w-full text-primary-text focus:outline-none resize-none flex-1 text-base scrollbar-hide overflow-y-auto min-h-[43px] max-h-[182px] transition-opacity duration-500 opacity-100"
                              onSend={(text) => handleSendMessage(text)}
                              onBlurSync={(text) => setCurrentInput(text)}
                              sendMessage={sendMessage}
                            />
                            <div className="flex items-center justify-between">
                              <div className="relative" ref={dropdownRef}>
                                <button
                                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3C3C3C]/50 border border-[#3a3a3a] text-sm text-foreground transition-colors cursor-pointer"
                                >
                                  <Image
                                    src={`${assetPrefix}/assets/images/${selectedIcon}`}
                                    alt={`${selectedProject} Image`}
                                    width={16}
                                    height={16}
                                    className="block"
                                  />
                                  {selectedVisibility}
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>

                                {isDropdownOpen && (
                                  <div className="absolute left-0 bottom-full mb-2 p-2 w-56 bg-[#1f1f1f] border border-[#3C3C3C] rounded-xl shadow-2xl overflow-hidden">

                                    {chatOptions.map((catOpt, i) => {
                                      return (
                                        <button
                                          key={i}
                                          onClick={() => {
                                            ChatWith(catOpt.option, catOpt.icon)
                                          }}
                                          className="w-full px-4 py-3 text-left text-sm hover:bg-[#3C3C3C] transition-colors flex items-center justify-between rounded-xl gap-3 text-foreground cursor-pointer"
                                        >
                                          <div className="flex items-center gap-3 cursor-pointer">
                                            {/* <Globe className="w-4 h-4 text-[#5B8DEE]" /> */}
                                            <Image
                                              src={`${assetPrefix}/assets/images/${catOpt.icon}`}
                                              alt={`${catOpt.option} Image`}
                                              width={16}
                                              height={16}
                                              className="block"
                                            />
                                            <span>{catOpt.option}</span>
                                          </div>
                                          {selectedVisibility === catOpt.option && <Check className="w-4 h-4 text-green-500" />}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => mainTextareaControllerRef.current?.send()}
                                  className="bg-[var(--color-icon-background)] flex item-center justify-center text-foreground rounded-lg p-1.5 transition-colors cursor-pointer h-[30px] w-[30px]"
                                  disabled={isChatActive}
                                >
                                  <Image
                                    src={`${assetPrefix}/assets/icons/papper-flight-black.svg`}
                                    alt="Send Icon"
                                    width={16}
                                    height={16}
                                    className="block"
                                  />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <h3 className="text-lg font-light text-foreground">Popular Research Topics</h3>

                          {Object.keys(tabQuestions).length > 0 ? (
                            <>
                              <div className="flex gap-3 flex-wrap">
                                {Object.keys(tabQuestions).map((tab) => (
                                  <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-lg text-sm transition-colors flex-shrink-0 flex items-center cursor-pointer bg-[#0D0D0E] font-normal gap-2 relative ${activeTab === tab
                                      ? "bg-muted text-foreground border border-border"
                                      : "border border-border/60 text-foreground hover:border-border"
                                      } `}
                                  >
                                    {tab === "Inspiration" && <Star className="w-4 h-4" />}
                                    {tab === "Articles" && <FileText className="w-4 h-4" />}
                                    {tab === "Case studies" && <Briefcase className="w-4 h-4" />}
                                    {tab === "Trending Topics" && <TrendingUp className="w-4 h-4" />}
                                    {tab === "Charts/Graphs" && <PieChart className="w-4 h-4" />}
                                    {tab === "Comparisons" && <GitCompare className="w-4 h-4" />}
                                    {tab}
                                    {activeTab === tab && (
                                      <div
                                        className="
                                        absolute 
                                        -bottom-[9px] 
                                        left-1/2 
                                        -translate-x-1/2 
                                        w-0 h-0 
                                        border-l-[6px] border-l-transparent 
                                        border-r-[6px] border-r-transparent 
                                        border-t-[8px] border-t-muted
                                      "
                                      />
                                    )}
                                  </button>
                                ))}
                              </div>

                              <div>
                                {tabQuestions[activeTab]?.map((question, idx) => (
                                  <div
                                    key={idx}
                                    onClick={() => handleQuestionClick(question)}
                                    className="rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors group cursor-pointer border-b border-border/40"
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <p className="text-[13.88px] font-light text-foreground leading-relaxed">{question}</p>
                                      <button className="flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                                        <Image
                                          src={`${assetPrefix}/assets/icons/move-up-left-arrow-white.svg`}
                                          alt="Left Arrow Icon"
                                          width={20}
                                          height={20}
                                          className="block"
                                        />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                              No research topics available for this project yet.
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {messages.map((msg, idx) => (
                          <div key={idx} className="space-y-6">
                            <div
                              className="flex justify-end"
                              onMouseEnter={() => setHoveredQuestion(idx)}
                              onMouseLeave={() => setHoveredQuestion(null)}
                            >
                              <div className="relative max-w-[85%] bg-[#3C3C3C] rounded-2xl px-5 py-4 group">
                                <p className="text-[13.88px] font-light text-foreground/90 leading-relaxed">{msg.question}</p>
                              </div>
                            </div>
                            <MemoizedMarkdownRenderer
                              content={(translatedAnswers.get(idx)?.text || msg.answer || "")}
                            />

                            <div className="border-t border-border border-dashed pt-4">
                              <div className="flex gap-4 flex-wrap text-sm items-center">
                                <button
                                  onClick={() => handleSave(idx, msg.qid, msg.userlist, msg.count)}
                                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/60 hover:border-border cursor-pointer"
                                >
                                  <Bookmark
                                    size={16}
                                    className={`${savedAnswers.has(idx) ? "fill-current text-[#75A5ED]" : "text-[#75A5ED]"}`}
                                  />
                                  {savedAnswers.has(idx) ? 'Un Save' : "Save"}
                                </button>
                                <button
                                  disabled={false}
                                  onClick={() => handleTranslate(idx)}
                                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/60 hover:border-border cursor-pointer"
                                >
                                  {translatedAnswers.has(idx) ? (
                                    <>
                                      <span className="text-xs font-semibold text-[#75A5ED]">En</span>
                                      Translate
                                    </>
                                  ) : (
                                    <>
                                      <Languages size={16} className="text-[#75A5ED]" />
                                      Translate
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleCopyAnswer(idx)}
                                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/60 hover:border-border cursor-pointer"
                                >
                                  <Copy size={16} className="text-[#75A5ED]" />
                                  {copiedAnswer === idx ? "Copied!" : "Copy"}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {pendingQuestion && (
                          <div className="space-y-6">
                            <div className="flex justify-end">
                              <div className="max-w-[85%] bg-[#3C3C3C] rounded-2xl px-5 py-4">
                                <p className="text-[13.88px] font-light text-foreground/90 leading-relaxed">{pendingQuestion}</p>
                              </div>
                            </div>

                            <div ref={currentAnswerRef}>
                              {typingText ? (
                                <div className="animate-fade-in">
                                  <MarkdownRenderer content={typingText} key={typingText.length} />
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <div className="relative w-[20px] h-[20px] flex-shrink-0">
                                    <Image
                                      src={`${assetPrefix}/assets/gif/star-ai-loader.gif`}
                                      alt="AI Loader"
                                      fill
                                      className="object-contain"
                                      unoptimized
                                    />
                                  </div>
                                  <ChatLoader />
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div ref={messagesEndRef} />
                      </>
                    )}
                </div>
              </div>
            </div>

            {isChatMode && (
              <div className="shrink-0 bg-transparent px-8 py-6">
                <div className="max-w-[901px] mx-auto">
                  <div className="border border-[#3C3C3C] rounded-lg bg-[#1a1a1a] p-4 min-h-[111px] flex flex-col">
                    <UncontrolledTextarea
                      ref={chatTextareaControllerRef}
                      domRef={chatDomRef}
                      initialValue={currentInput}
                      placeholder={ROTATING_PLACEHOLDERS[animationStateRef.current.currentPlaceholderIndex]}
                      className="w-full bg-transparent text-foreground focus:outline-none resize-none flex-1 text-base scrollbar-hide overflow-y-auto min-h-[43px] max-h-[182px] transition-opacity duration-500 opacity-100"
                      onSend={(text) => handleSendMessage(text)}
                      onBlurSync={(text) => setCurrentInput(text)}
                      sendMessage={sendMessage}
                    />
                    <div className="flex items-center justify-between">
                      <div className="relative" ref={dropdownRef}>
                        <button
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3C3C3C]/50 border border-[#3a3a3a] text-sm text-foreground transition-colors cursor-pointer"
                        >
                          <Image
                            src={`${assetPrefix}/assets/images/${selectedIcon}`}
                            alt={`${selectedProject} Image`}
                            width={16}
                            height={16}
                            className="block"
                          />
                          {selectedVisibility}
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>

                        {isDropdownOpen && (
                          <div className="absolute left-0 bottom-full mb-2 w-56 bg-[#1f1f1f] border border-border/60 rounded-xl shadow-2xl overflow-hidden">
                            {chatOptions.map((catOpt, i) => {
                              return (
                                <button
                                  key={i}
                                  onClick={() => {
                                    ChatWith(catOpt.option, catOpt.icon)
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-[#3C3C3C] transition-colors flex items-center justify-between rounded-xl gap-3 text-foreground cursor-pointer"
                                >
                                  <div className="flex items-center gap-3">
                                    <Image
                                      src={`${assetPrefix}/assets/images/${catOpt.icon}`}
                                      alt={`${catOpt.option} Image`}
                                      width={16}
                                      height={16}
                                      className="block"
                                    />
                                    <span>{catOpt.option}</span>
                                  </div>
                                  {selectedVisibility === catOpt.option && <Check className="w-4 h-4 text-green-500" />}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {sendMessage ? (
                          <button
                            onClick={() => stopStreaming(setSendMessage)}
                            className="bg-[var(--color-icon-background)] flex item-center justify-center text-foreground rounded-lg p-1.5 transition-colors cursor-pointer h-[30px] w-[30px]"
                            disabled={!isChatActive}
                          >
                            <Image
                              src={`${assetPrefix}/assets/icons/squire.svg`}
                              alt="Squire Icon"
                              width={16}
                              height={16}
                              className="block"
                            />
                          </button>
                        ) : (
                          <button
                            onClick={() => chatTextareaControllerRef.current?.send()}
                            className="bg-white flex item-center justify-center text-foreground rounded-lg p-1.5 transition-colors cursor-pointer h-[30px] w-[30px]"
                            disabled={sendMessage}
                          >
                            <Image
                              src={`${assetPrefix}/assets/icons/papper-flight-black.svg`}
                              alt="Send Icon"
                              width={16}
                              height={16}
                              className="block"
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        <>
          {/* Main Content - Scrollable */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto scrollbar-custom px-8 relative"
          >
            <div className={`pb-32 flex justify-center ${!isChatMode ? "pt-[180px]" : ""}`}>
              <div className="w-[920px] space-y-12">
                {!historyLoaded && !skipLoading ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground">Loading...</div>
                ) : isChatMode === "" ? <div className="h-48 flex items-center justify-center text-muted-foreground">Loading...</div>
                  : !isChatMode ? (
                    <>
                      <div className="text-center mb-7">
                        <div className="flex items-center pl-55 gap-3">
                          <Image
                            src={`${assetPrefix}/assets/gif/star-ai-loader.gif`}
                            alt="Pen Icon"
                            width={25}
                            height={25}
                            className="block"
                          />
                          <h2
                            ref={titleElementRef}
                            className="text-[29.88px] font-none transition-opacity duration-500 text-gradient opacity-100"
                            style={{ transition: "opacity 500ms ease-in-out" }}
                          >
                            {ROTATING_TITLES[animationStateRef.current.currentTitleIndex]}
                          </h2>
                        </div>
                      </div>

                      <div className="mb-[35px]">
                        <div className="rounded-2xl bg-[#1a1a1a] py-4 px-6 min-h-[113px] flex flex-col border border-[#3C3C3C]">
                          <UncontrolledTextarea
                            ref={mainTextareaControllerRef}
                            domRef={placeholderElementRef}
                            initialValue={currentInput}
                            placeholder={ROTATING_PLACEHOLDERS[animationStateRef.current.currentPlaceholderIndex]}
                            className="w-full text-primary-text focus:outline-none resize-none flex-1 text-base scrollbar-hide overflow-y-auto min-h-[43px] max-h-[182px] transition-opacity duration-500 opacity-100"
                            onSend={(text) => handleSendMessage(text)}
                            onBlurSync={(text) => setCurrentInput(text)}
                            sendMessage={sendMessage}
                          />
                          <div className="flex items-center justify-between">
                            <div className="relative" ref={dropdownRef}>
                              <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3C3C3C]/50 border border-[#3a3a3a] text-sm text-foreground transition-colors cursor-pointer"
                              >
                                <Image
                                  src={`${assetPrefix}/assets/images/${selectedIcon}`}
                                  alt={`${selectedProject} Image`}
                                  width={16}
                                  height={16}
                                  className="block"
                                />
                                {selectedVisibility}
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>

                              {isDropdownOpen && (
                                <div className="absolute left-0 bottom-full mb-2 p-2 w-56 bg-[#1f1f1f] border border-[#3C3C3C] rounded-xl shadow-2xl overflow-hidden">

                                  {chatOptions.map((catOpt, i) => {
                                    return (
                                      <button
                                        key={i}
                                        onClick={() => {
                                          ChatWith(catOpt.option, catOpt.icon)
                                        }}
                                        className="w-full px-4 py-3 text-left text-sm hover:bg-[#3C3C3C] transition-colors flex items-center justify-between rounded-xl gap-3 text-foreground cursor-pointer"
                                      >
                                        <div className="flex items-center gap-3 cursor-pointer">
                                          {/* <Globe className="w-4 h-4 text-[#5B8DEE]" /> */}
                                          <Image
                                            src={`${assetPrefix}/assets/images/${catOpt.icon}`}
                                            alt={`${catOpt.option} Image`}
                                            width={16}
                                            height={16}
                                            className="block"
                                          />
                                          <span>{catOpt.option}</span>
                                        </div>
                                        {selectedVisibility === catOpt.option && <Check className="w-4 h-4 text-green-500" />}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => mainTextareaControllerRef.current?.send()}
                                className="bg-[var(--color-icon-background)] flex item-center justify-center text-foreground rounded-lg p-1.5 transition-colors cursor-pointer h-[30px] w-[30px]"
                                disabled={isChatActive}
                              >
                                <Image
                                  src={`${assetPrefix}/assets/icons/papper-flight-black.svg`}
                                  alt="Send Icon"
                                  width={16}
                                  height={16}
                                  className="block"
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h3 className="text-lg font-light text-foreground">Popular Research Topics</h3>

                        {Object.keys(tabQuestions).length > 0 ? (
                          <>
                            <div className="flex gap-3 flex-wrap">
                              {Object.keys(tabQuestions).map((tab) => (
                                <button
                                  key={tab}
                                  onClick={() => setActiveTab(tab)}
                                  className={`px-4 py-2 rounded-lg text-sm transition-colors flex-shrink-0 flex items-center cursor-pointer bg-[#0D0D0E] font-normal gap-2 relative ${activeTab === tab
                                    ? "bg-muted text-foreground border border-border"
                                    : "border border-border/60 text-foreground hover:border-border"
                                    } `}
                                >
                                  {tab === "Inspiration" && <Star className="w-4 h-4" />}
                                  {tab === "Articles" && <FileText className="w-4 h-4" />}
                                  {tab === "Case studies" && <Briefcase className="w-4 h-4" />}
                                  {tab === "Trending Topics" && <TrendingUp className="w-4 h-4" />}
                                  {tab === "Charts/Graphs" && <PieChart className="w-4 h-4" />}
                                  {tab === "Comparisons" && <GitCompare className="w-4 h-4" />}
                                  {tab}
                                  {activeTab === tab && (
                                    <div
                                      className="
                                      absolute 
                                      -bottom-[9px] 
                                      left-1/2 
                                      -translate-x-1/2 
                                      w-0 h-0 
                                      border-l-[6px] border-l-transparent 
                                      border-r-[6px] border-r-transparent 
                                      border-t-[8px] border-t-muted
                                    "
                                    />
                                  )}
                                </button>
                              ))}
                            </div>

                            <div>
                              {tabQuestions[activeTab]?.map((question, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => handleQuestionClick(question)}
                                  className="rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors group cursor-pointer border-b border-border/40"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <p className="text-[13.88px] font-light text-foreground leading-relaxed">{question}</p>
                                    <button className="flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                                      <Image
                                        src={`${assetPrefix}/assets/icons/move-up-left-arrow-white.svg`}
                                        alt="Left Arrow Icon"
                                        width={20}
                                        height={20}
                                        className="block"
                                      />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            No research topics available for this project yet.
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {messages.map((msg, idx) => (
                        <div key={idx} className="space-y-6">
                          <div
                            className="flex justify-end"
                            onMouseEnter={() => setHoveredQuestion(idx)}
                            onMouseLeave={() => setHoveredQuestion(null)
                            }
                          >
                            <div className="relative max-w-[85%] bg-[#3C3C3C] rounded-2xl px-5 py-4 group">
                              <p className="text-[13.88px] font-light text-foreground/90 leading-relaxed">{msg.question}</p>
                            </div>
                          </div>
                          <MemoizedMarkdownRenderer
                            content={
                              (translatedAnswers.get(idx)?.text || msg.answer || "")
                            }
                          />

                          <div className="border-t border-border border-dashed pt-4">
                            <div className="flex gap-4 flex-wrap text-sm items-center">
                              <button
                                onClick={() => handleSave(idx, msg.qid, msg.userlist, msg.count)}
                                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/60 hover:border-border cursor-pointer"
                              >
                                <Bookmark
                                  size={16}
                                  className={`${savedAnswers.has(idx) ? "fill-current text-[#75A5ED]" : "text-[#75A5ED]"} `}
                                />
                                {savedAnswers.has(idx) ? 'Un Save' : "Save"}
                              </button>
                              <button
                                disabled={false}
                                onClick={() => handleTranslate(idx)}
                                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/60 hover:border-border cursor-pointer"
                              >
                                {translatedAnswers.has(idx) ? (
                                  <>
                                    <span className="text-xs font-semibold text-[#75A5ED]">En</span>
                                    Translate
                                  </>
                                ) : (
                                  <>
                                    <Languages size={16} className="text-[#75A5ED]" />
                                    Translate
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleCopyAnswer(idx)}
                                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/60 hover:border-border cursor-pointer"
                              >
                                <Copy size={16} className="text-[#75A5ED]" />
                                {copiedAnswer === idx ? "Copied!" : "Copy"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {pendingQuestion && (
                        <div className="space-y-6">
                          <div className="flex justify-end">
                            <div className="max-w-[85%] bg-[#3C3C3C] rounded-2xl px-5 py-4">
                              <p className="text-[13.88px] font-light text-foreground/90 leading-relaxed">{pendingQuestion}</p>
                            </div>
                          </div>

                          <div ref={currentAnswerRef}>
                            {typingText ? (
                              <div className="animate-fade-in">
                                <MarkdownRenderer content={typingText} key={typingText.length} />
                              </div>
                            ) : <div className="flex items-center">
                              <div className="relative w-[20px] h-[20px] flex-shrink-0">
                                <Image
                                  src={`${assetPrefix}/assets/gif/star-ai-loader.gif`}
                                  alt="AI Loader"
                                  fill
                                  className="object-contain"
                                  unoptimized
                                />
                              </div>

                              <ChatLoader />
                            </div>
                            }
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </>
                  )}
              </div>
            </div>
          </div>

          {
            isChatMode && (
              <div className="shrink-0 bg-transparent px-8 py-6">
                <div className="max-w-[901px] mx-auto">
                  <div className="border border-[#3C3C3C] rounded-lg bg-[#1a1a1a] p-4 min-h-[111px] flex flex-col">
                    <UncontrolledTextarea
                      ref={chatTextareaControllerRef}
                      domRef={chatDomRef}
                      initialValue={currentInput}
                      placeholder={ROTATING_PLACEHOLDERS[animationStateRef.current.currentPlaceholderIndex]}
                      className="w-full bg-transparent text-foreground focus:outline-none resize-none flex-1 text-base scrollbar-hide overflow-y-auto min-h-[43px] max-h-[182px] transition-opacity duration-500 opacity-100"
                      onSend={(text) => handleSendMessage(text)}
                      onBlurSync={(text) => setCurrentInput(text)}
                      sendMessage={sendMessage}
                    />
                    <div className="flex items-center justify-between">
                      <div className="relative" ref={dropdownRef}>
                        <button
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3C3C3C]/50 border border-[#3a3a3a] text-sm text-foreground transition-colors cursor-pointer"
                        >
                          <Image
                            src={`${assetPrefix}/assets/images/${selectedIcon}`}
                            alt={`${selectedProject} Image`}
                            width={16}
                            height={16}
                            className="block"
                          />
                          {selectedVisibility}
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>

                        {isDropdownOpen && (
                          <div className="absolute left-0 bottom-full mb-2 w-56 bg-[#1f1f1f] border border-border/60 rounded-xl shadow-2xl overflow-hidden">
                            {chatOptions.map((catOpt, i) => {
                              return (
                                <button
                                  key={i}
                                  onClick={() => {
                                    ChatWith(catOpt.option, catOpt.icon)
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-[#3C3C3C] transition-colors flex items-center justify-between rounded-xl gap-3 text-foreground cursor-pointer"
                                >
                                  <div className="flex items-center gap-3">
                                    {/* <Globe className="w-4 h-4 text-[#5B8DEE]" /> */}
                                    <Image
                                      src={`${assetPrefix}/assets/images/${catOpt.icon}`}
                                      alt={`${catOpt.option} Image`}
                                      width={16}
                                      height={16}
                                      className="block"
                                    />
                                    <span>{catOpt.option}</span>
                                  </div>
                                  {selectedVisibility === catOpt.option && <Check className="w-4 h-4 text-green-500" />}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {sendMessage ?
                          <button
                            onClick={() => stopStreaming(setSendMessage)}
                            className="bg-[var(--color-icon-background)] flex item-center justify-center text-foreground rounded-lg p-1.5 transition-colors cursor-pointer h-[30px] w-[30px]"
                            disabled={!isChatActive}
                          >
                            <Image
                              src={`${assetPrefix}/assets/icons/squire.svg`}
                              alt="Squire Icon"
                              width={16}
                              height={16}
                              className="block"
                            />
                          </button>
                          : <button
                            onClick={() => chatTextareaControllerRef.current?.send()}
                            className={"bg-white flex item-center justify-center text-foreground rounded-lg p-1.5 transition-colors cursor-pointer h-[30px] w-[30px]"}
                            disabled={sendMessage}
                          >
                            <Image
                              src={`${assetPrefix}/assets/icons/papper-flight-black.svg`}
                              alt="Send Icon"
                              width={16}
                              height={16}
                              className="block"
                            />
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          }
        </>
      )}

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <div className="absolute bottom-[200px] left-0 w-full px-8 pointer-events-none z-50">
          <div className="max-w-[901px] mx-auto relative">
            <button
              onClick={scrollToBottom}
              className="absolute bottom-0 right-6 pointer-events-auto p-1.5 rounded-full bg-[#1F1F1F] border border-[#333] hover:bg-[#333] hover:border-[#444] transition-all shadow-xl group animate-in fade-in zoom-in duration-300 cursor-pointer"
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </div>
        </div>
      )}
    </div >
  )
}

