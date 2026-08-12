"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { ProjectCreateController } from "@/controllers/project-controller"
import { useSearchParams } from "next/navigation"
import { useProjectStore } from "@/app/store/project/project.store"
import Image from "next/image"
import CustomButton from "./custom-button"
import { Toaster, toast } from "sonner"
import {
  STATIC_FILM_ANALYSIS,
  STATIC_FILM_METADATA,
  STATIC_SCRIPT_ID,
} from "@/lib/static-film-data"

export default function ProjectCreate() {
  const router = useRouter()
  const searchParams = useSearchParams();
  const aiAgentTitle = searchParams.get("title");
  const { currentUser, AiAgentList, setSelectedAiAgent, hydrated } = useProjectStore();

  const [researchTopic, setResearchTopic] = useState(STATIC_FILM_METADATA.title)
  // const [aiAgent, setAiAgent] = useState(aiAgentTitle || "")
  const [disable, setDisable] = useState(true)
  const [createLoader, setCreateLoader] = useState(false)

  // Film Intelligence specific metadata states — filled from static ஆண் பாவம் demo
  const [filmLanguage, setFilmLanguage] = useState(STATIC_FILM_METADATA.language)
  const [filmGenre, setFilmGenre] = useState(STATIC_FILM_METADATA.genre)
  const [filmTargetMarket, setFilmTargetMarket] = useState(STATIC_FILM_METADATA.targetMarket)
  const [filmReleaseStrategy, setFilmReleaseStrategy] = useState(STATIC_FILM_METADATA.releaseStrategy)
  const [filmExpectedBudget, setFilmExpectedBudget] = useState(STATIC_FILM_METADATA.expectedBudget)
  const [analysisReport, setAnalysisReport] = useState<any>(STATIC_FILM_ANALYSIS)
  const [scriptId, setScriptId] = useState<string | null>(STATIC_SCRIPT_ID)
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(STATIC_FILM_METADATA.filename)

  // Screenplay Script Analyzer States
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleScriptUpload = async (file: File) => {
    setIsAnalyzing(true);
    setAnalysisStep("Loading static screenplay analysis…");

    try {
      // Demo mode: ignore live upload/workflows and hydrate from curated ஆண் பாவம் data
      const filename = file?.name || STATIC_FILM_METADATA.filename;
      setScriptId(STATIC_SCRIPT_ID);
      setUploadedFilename(filename);
      setResearchTopic(STATIC_FILM_METADATA.title);
      setFilmLanguage(STATIC_FILM_METADATA.language);
      setFilmGenre(STATIC_FILM_METADATA.genre);
      setFilmTargetMarket(STATIC_FILM_METADATA.targetMarket);
      setFilmReleaseStrategy(STATIC_FILM_METADATA.releaseStrategy);
      setFilmExpectedBudget(STATIC_FILM_METADATA.expectedBudget);
      setAnalysisReport(STATIC_FILM_ANALYSIS);

      // Persist to local API/SQLite for routing consistency
      await fetch("/api/film-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script_id: STATIC_SCRIPT_ID,
          title: STATIC_FILM_METADATA.title,
          language: STATIC_FILM_METADATA.language,
          genre: STATIC_FILM_METADATA.genre,
          target_market: STATIC_FILM_METADATA.targetMarket,
          release_strategy: STATIC_FILM_METADATA.releaseStrategy,
          expected_budget: STATIC_FILM_METADATA.expectedBudget,
          filename,
          metadata: STATIC_FILM_METADATA,
          analysis: STATIC_FILM_ANALYSIS,
        }),
      }).catch(() => null);

      toast.success("ஆண் பாவம் loaded with full static analysis.");
    } catch (err: any) {
      console.error("Screenplay analysis error:", err);
      toast.error(err?.message || "Failed to load screenplay");
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep("");
    }
  };

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Hide the project sidebar when this component is mounted (restore on unmount)
  useEffect(() => {
    const sidebar = document.querySelector('aside.w-64') as HTMLElement | null
    const prevDisplay = sidebar?.style.display
    if (sidebar) sidebar.style.display = "none"
    return () => {
      if (sidebar) sidebar.style.display = prevDisplay ?? ""
    }
  }, [])

  useEffect(() => {
    const isAgentSelected = AiAgentList.some(a => a.selected);
    const isEmpty = researchTopic.trim().length === 0;

    if (isEmpty) {
      setDisable(true);
    } else if (!isAgentSelected) {
      setDisable(true);
    } else {
      setDisable(false);
    }
  }, [researchTopic, AiAgentList]);




  const setAiAgent = (id: string) => {
    setSelectedAiAgent(id);
  }

  const handleProjectCreate = async () => {
    const isAgentSelected = AiAgentList.some(a => a.selected);
    const isTopicEmpty = researchTopic.trim().length === 0;

    if (isTopicEmpty && !isAgentSelected) {
      toast.error("Please enter a screenplay title and select a specialist");
      inputRef.current?.focus();
      return;
    }

    if (isTopicEmpty) {
      toast.error("Briefly describe your screenplay title");
      inputRef.current?.focus();
      return;
    }

    if (!isAgentSelected) {
      toast.error("Please Select Specialists");
      return;
    }

    if (createLoader) {
      return;
    }

    setCreateLoader(true)
    setDisable(true);
    // Mark that we're navigating from project creation (skip loading screen)
    try {
      sessionStorage.setItem("skipProjectDetailLoader", "true")
    } catch { }
    const selectedAgentObj = AiAgentList.find((agent) => agent.selected);
    const aiAgent = selectedAgentObj?.title || "Film Intelligence Specialist";

    // Always use the static ஆண் பாவம் script id in demo mode
    const ensuredScriptId = STATIC_SCRIPT_ID;
    if (!scriptId) setScriptId(ensuredScriptId);

    try {
      localStorage.setItem("temp_film_metadata", JSON.stringify({
        title: researchTopic,
        language: filmLanguage,
        genre: filmGenre,
        targetMarket: filmTargetMarket,
        releaseStrategy: filmReleaseStrategy,
        expectedBudget: filmExpectedBudget,
        scriptId: ensuredScriptId,
        filename: uploadedFilename,
      }));
      if (analysisReport) {
        localStorage.setItem("temp_film_analysis", JSON.stringify(analysisReport));
      } else {
        localStorage.setItem("temp_film_analysis", JSON.stringify({ sections: {} }));
      }
    } catch (e) {
      console.error("Failed to save temp film metadata", e);
    }

    await ProjectCreateController(researchTopic, aiAgent, setDisable, router, setCreateLoader, setResearchTopic);
  };

  const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX || "";

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-hide">
      <Toaster richColors position="top-right" />
      <div className="flex-1 p-8 space-y-12">
        <div className="max-w-[1400px] mx-auto text-center mb-18 pt-6">
          <h1 className="text-4xl m-0 font-medium text-foreground flex items-center justify-center gap-2 text-gradient">
            Hey, <span className="">{currentUser}</span>!
          </h1>
          <p className="text-[28px] text-lighttext font-extralight">Kickstart Your Project</p>
        </div>

        <div className="max-w-[1400px] mx-auto mb-8 space-y-6">
            {/* Screenplay Script Upload Zone */}
            <div className="border border-border/80 bg-[#0B0B0B]/80 rounded-xl p-5 backdrop-blur-md space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" /> Autofill with Screenplay Upload
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Upload your raw screenplay script file. AI will read it, extract details using an LLM prompt, and autofill the fields below.
                  </p>
                </div>
              </div>

              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center border border-primary/40 bg-primary/5 rounded-lg p-8 text-center space-y-4 animate-pulse">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{analysisStep}</p>
                    <p className="text-xs text-muted-foreground">This will take a few seconds as the LLM processes the script file</p>
                  </div>
                  {/* Fake progress bar */}
                  <div className="w-full max-w-xs h-1.5 bg-[#1E1E1E] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-infinite-loading" style={{
                      width: "100%",
                      animation: "loading-pulse 1.5s infinite ease-in-out"
                    }} />
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      handleScriptUpload(files[0]);
                    }
                  }}
                  className={`flex flex-col items-center justify-center border border-dashed rounded-lg p-6 transition-all text-center cursor-pointer ${
                    isDragging
                      ? "border-primary bg-primary/5 scale-[1.01]"
                      : "border-[#333] hover:border-primary/50 bg-[#060606] hover:bg-[#0A0A0A]"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        handleScriptUpload(files[0]);
                      }
                    }}
                    accept=".pdf,.txt,.docx"
                    className="hidden"
                  />
                  <div className="relative mb-3 flex justify-center">
                    <FileText className="w-10 h-10 text-muted-foreground" />
                    <div className="absolute -bottom-1 right-2 bg-primary p-1 rounded-full text-white shadow-md">
                      <Sparkles className="w-3 h-3" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Drag & drop your screenplay script here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports PDF, TXT, or DOCX format (Max 25MB)
                  </p>
                  <button
                    type="button"
                    className="mt-4 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border text-xs font-semibold rounded-lg transition-all cursor-pointer"
                  >
                    Select Script File
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-none text-foreground">Screenplay Title</label>
              <input
                type="text"
                placeholder="E.g. ஆண் பாவம்"
                ref={inputRef}
                value={researchTopic}
                className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
                onChange={(e) => setResearchTopic(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-none text-foreground">Screenplay Language</label>
                <input
                  type="text"
                  placeholder="Filled from script upload"
                  value={filmLanguage}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
                  onChange={(e) => setFilmLanguage(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-none text-foreground">Genre</label>
                <input
                  type="text"
                  placeholder="Filled from script upload"
                  value={filmGenre}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
                  onChange={(e) => setFilmGenre(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-none text-foreground">Target Market / Industry</label>
                <input
                  type="text"
                  placeholder="Filled from script upload"
                  value={filmTargetMarket}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
                  onChange={(e) => setFilmTargetMarket(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-none text-foreground">Release Strategy</label>
                <input
                  type="text"
                  placeholder="Filled from script upload"
                  value={filmReleaseStrategy}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
                  onChange={(e) => setFilmReleaseStrategy(e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-none text-foreground">Expected Budget (Optional)</label>
                <input
                  type="text"
                  placeholder="Filled from script upload"
                  value={filmExpectedBudget}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
                  onChange={(e) => setFilmExpectedBudget(e.target.value)}
                />
              </div>
            </div>
          </div>

        <div className="max-w-[1400px] mx-auto mb-8">
          <div className="mb-4">
            <label className="block text-sm font-none text-foreground">Select Specialists</label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {AiAgentList.map((specialist) => (
              <Card
                key={specialist.id}
                className={`${specialist.selected ? "" : "bg-[#0D0D0D]"} 
                relative overflow-visible 
                hover:card-bg-gradient transition-all cursor-pointer flex items-start p-0`}
                onClick={() => setAiAgent(specialist.id)}
                style={
                  specialist.selected
                    ? { background: "linear-gradient(90deg, #3D70E2 0%, #7A43F1 50%, #4769E5 100%)" }
                    : undefined
                }
              >
                <CardContent className="w-full p-4 flex flex-row items-center gap-4">
                  <div className="flex items-center justify-center w-[63px] h-[61px] shrink-0 p-2 rounded-[9px] bg-[#2F2E2E80]">
                    <Image
                      src={`${assetPrefix}/assets/images/${specialist.icon}`}
                      alt="Agent Icon"
                      width={45}
                      height={45}
                      className="block"
                    />
                  </div>

                  <div className="flex-1 text-left min-w-0">
                    <h3 className={`font-none text-base leading-snug line-clamp-2 
                      ${specialist.selected ? 'text-white' : 'text-foreground'}`}>
                      {specialist.title}
                    </h3>
                  </div>
                </CardContent>

                {specialist.selected && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 
                  border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-[#693FD9]"
                  />
                )}
              </Card>

            ))}
          </div>
        </div>

        {/* `` */}
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-2">
          <span className="flex-grow h-[1px] bg-[#2a2a2a]"></span>
          <CustomButton disable={false} handleFN={handleProjectCreate} btnTitle="Create Project" isLoading={createLoader} />
          {/* <span className="flex-grow h-[1px] bg-[#2a2a2a]"></span>
          <CustomButton disable={disable || createLoader} handleFN={handleProjectCreate} btnTitle="Create Project" isLoading={createLoader} /> */}
        </div>
      </div>
    </div>
  )
}
