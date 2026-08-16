"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, FileText } from "lucide-react"
import { Image, useRouter, useSearchParams } from "@/lib/spa-router"
import { useState, useEffect, useRef } from "react"
import { ProjectCreateController } from "@/controllers/project-controller"
import { useProjectStore } from "@/app/store/project/project.store"
import { assetPath } from "@/lib/env"
import CustomButton from "./custom-button"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/async-state"
import { WORKFLOW_LINKS, workflowUrl } from "@/lib/workflow-links"

export default function ProjectCreate() {
  const router = useRouter()
  const searchParams = useSearchParams();
  const aiAgentTitle = searchParams.get("title");
  const { currentUser, AiAgentList, setSelectedAiAgent, hydrated } = useProjectStore();

  const [researchTopic, setResearchTopic] = useState("")
  const [disable, setDisable] = useState(true)
  const [createLoader, setCreateLoader] = useState(false)

  // Film Intelligence specific metadata states — populated from upload API response
  const [filmLanguage, setFilmLanguage] = useState("")
  const [filmGenre, setFilmGenre] = useState("")
  const [filmTargetMarket, setFilmTargetMarket] = useState("")
  const [filmReleaseStrategy, setFilmReleaseStrategy] = useState("")
  const [filmExpectedBudget, setFilmExpectedBudget] = useState("")
  const [analysisReport, setAnalysisReport] = useState<any>(null)
  const [scriptId, setScriptId] = useState<string | null>(null)
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null)
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  // Screenplay Script Analyzer States
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const FAKE_MESSAGES = [
    "Uploading script to AI engine...",
    "Scanning document structure...",
    "Extracting character profiles...",
    "Analyzing narrative arcs...",
    "Generating commercial viability scores...",
    "Finalizing metadata extraction..."
  ];

  useEffect(() => {
    if (!isAnalyzing) {
      setUploadProgress(0);
      return;
    }
    
    setAnalysisStep(FAKE_MESSAGES[0]);

    // Timer for progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 95) return 95; // Wait for real fetch to finish
        const step = Math.random() * 8 + 2;
        return Math.min(prev + step, 95);
      });
    }, 600);

    // Timer for messages
    let msgIndex = 0;
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % FAKE_MESSAGES.length;
      setAnalysisStep(FAKE_MESSAGES[msgIndex]);
    }, 2500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(msgInterval);
    }
  }, [isAnalyzing]);

  const handleScriptUpload = async (file: File) => {
    const allowedTypes = ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    const allowedExtension = /\.(pdf|txt|docx)$/i.test(file.name)
    if ((!allowedTypes.includes(file.type) && !allowedExtension) || file.size > 25 * 1024 * 1024) {
      toast.error(file.size > 25 * 1024 * 1024 ? "The screenplay must be smaller than 25 MB." : "Upload a PDF, TXT, or DOCX screenplay.")
      return
    }
    setIsAnalyzing(true);
    setUploadedFile(null);
    setUploadedFilename(null);
    setUploadedFileUrl(null);

    try {
      const { extractFileProxyUrl } = await import('@/lib/film-workflows');
      const formData = new FormData();
      
      const generatedScriptId = `script-${Date.now()}`;
      formData.append("file", file);
      formData.append("file_name", file.name);
      formData.append("script_id", generatedScriptId);
      
      const uploadRes = await fetch(workflowUrl(WORKFLOW_LINKS.FILM_UPLOAD), {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed with status ${uploadRes.status}`);
      }

      const uploadData = await uploadRes.json();
      console.log("Upload response:", uploadData);

      // Parse the output JSON string from the upload response
      // Response shape: [{ output: "{...json...}", filename: "...", ... }]
      if (Array.isArray(uploadData) && uploadData.length > 0) {
        const row = uploadData[0];

        // Parse the output field (it's a JSON string)
        let meta: Record<string, any> | null = {};
        if (typeof row.output === 'string') {
          if (row.output.trim() === "null") {
            throw new Error("Could not extract script details. Please ensure you uploaded a valid screenplay document.");
          }
          try {
            meta = JSON.parse(row.output);
          } catch (e) {
            console.warn("Failed to parse output JSON:", e);
          }
        } else if (row.output && typeof row.output === 'object') {
          meta = row.output;
        }

        if (!meta) {
          throw new Error("Could not extract script details. Please ensure you uploaded a valid screenplay document.");
        }

        // Populate form fields from the parsed metadata
        if (meta.screenplay_title) setResearchTopic(meta.screenplay_title);
        if (meta.screenplay_language) setFilmLanguage(meta.screenplay_language);
        if (meta.genre) setFilmGenre(meta.genre);
        if (meta.target_market_industry) setFilmTargetMarket(meta.target_market_industry);
        if (meta.release_strategy) setFilmReleaseStrategy(meta.release_strategy);
        if (meta.expected_budget) setFilmExpectedBudget(meta.expected_budget);

        // Extract script_id if returned, otherwise use the generated one
        const extractedScriptId = meta.script_id || meta.scriptId || row.script_id || row.scriptId || generatedScriptId;
        const extractedFileUrl =
          meta.file_full_url || meta.file_url || meta.FileFullPath ||
          row.file_full_url?.data || row.file_full_url || row.file_url || row.FileFullPath ||
          extractFileProxyUrl(uploadData) || null;
        setScriptId(extractedScriptId);
        setUploadedFilename(file.name);
        setUploadedFileUrl(extractedFileUrl);
        setUploadedFile(file);
      } else {
        // Fallback: no parseable response, use filename as title
        setResearchTopic(file.name.replace(/\.[^/.]+$/, ""));
        setScriptId(generatedScriptId);
        setUploadedFilename(file.name);
        setUploadedFile(file);
      }

      // Start with empty analysis — tabs will fetch live when visited
      setAnalysisReport({ sections: {} });

      setUploadProgress(100);
      setAnalysisStep("Extraction complete!");
      
      // Give a tiny visual pause at 100% before closing loader
      await new Promise(resolve => setTimeout(resolve, 600));

      toast.success("Script uploaded successfully!");
    } catch (err: any) {
      setUploadedFile(null);
      console.warn("Screenplay analysis error:", err);
      toast.error(err?.message || "Failed to upload screenplay");
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep("");
      setUploadProgress(0);
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

    if (!uploadedFile) {
      toast.error("Please upload a screenplay file before creating the project");
      fileInputRef.current?.click();
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

    // Use the live script_id from upload, or generate one if missing
    const ensuredScriptId = scriptId || `script-${Date.now()}`;
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
        fileFullUrl: uploadedFileUrl,
      }));
      if (analysisReport) {
        localStorage.setItem("temp_film_analysis", JSON.stringify(analysisReport));
      } else {
        localStorage.setItem("temp_film_analysis", JSON.stringify({ sections: {} }));
      }
    } catch (e) {
      console.error("Failed to save temp film metadata", e);
    }

    try {
      await ProjectCreateController(
        researchTopic,
        aiAgent,
        setDisable,
        router,
        setCreateLoader,
        setResearchTopic,
        uploadedFile,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Project creation failed. Please try again.")
    }
  };


  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-hide">
      <div className="page-container flex-1 space-y-10 py-8 sm:py-10">
        <div className="max-w-[1400px] mx-auto text-center mb-18 pt-6">
          <h1 className="text-4xl m-0 font-medium text-foreground flex items-center justify-center gap-2 text-gradient">
            Welcome!
          </h1>
          <p className="text-[28px] text-lighttext font-extralight">Kickstart Your Project</p>
        </div>

        <div className="max-w-[1400px] mx-auto mb-8 space-y-6">
            {/* Screenplay Script Upload Zone */}
            <div className="rover-surface space-y-4 p-4 sm:p-5" aria-busy={isAnalyzing}>
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
                <div role="status" aria-live="polite" className="flex min-h-[190px] flex-col items-center justify-center space-y-4 rounded-lg border border-primary/40 bg-primary/5 p-6 text-center">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{analysisStep}</p>
                    <p className="text-xs text-muted-foreground">This will take a few seconds as the LLM processes the script file</p>
                  </div>
                  {/* Fake progress bar */}
                  <div className="w-full max-w-xs h-1.5 bg-[#1E1E1E] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300 ease-out" style={{
                      width: `${uploadProgress}%`
                    }} />
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (isAnalyzing || createLoader) return;
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (isAnalyzing || createLoader) return;
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
                  onClick={() => { if (!isAnalyzing && !createLoader) fileInputRef.current?.click() }}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload screenplay"
                  onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !isAnalyzing && !createLoader) fileInputRef.current?.click() }}
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
              <label htmlFor="screenplay-title" className="block text-sm font-none text-foreground">Screenplay Title</label>
              <input
                id="screenplay-title"
                type="text"
                placeholder={uploadedFilename || "E.g. Inception"}
                ref={inputRef}
                value={researchTopic}
                disabled={isAnalyzing || createLoader}
                aria-busy={isAnalyzing}
                className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors disabled:opacity-60"
                onChange={(e) => setResearchTopic(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="screenplay-language" className="block text-sm font-none text-foreground">Screenplay Language</label>
                {isAnalyzing ? <Skeleton className="h-[50px] w-full" /> : <input id="screenplay-language"
                  type="text"
                  placeholder="Filled from script upload"
                  value={filmLanguage}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
                  onChange={(e) => setFilmLanguage(e.target.value)}
                />}
              </div>

              <div className="space-y-2">
                <label htmlFor="screenplay-genre" className="block text-sm font-none text-foreground">Genre</label>
                {isAnalyzing ? <Skeleton className="h-[50px] w-full" /> : <input id="screenplay-genre"
                  type="text"
                  placeholder="Filled from script upload"
                  value={filmGenre}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
                  onChange={(e) => setFilmGenre(e.target.value)}
                />}
              </div>

              <div className="space-y-2">
                <label htmlFor="target-market" className="block text-sm font-none text-foreground">Target Market / Industry</label>
                {isAnalyzing ? <Skeleton className="h-[50px] w-full" /> : <input id="target-market"
                  type="text"
                  placeholder="Filled from script upload"
                  value={filmTargetMarket}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
                  onChange={(e) => setFilmTargetMarket(e.target.value)}
                />}
              </div>

              <div className="space-y-2">
                <label htmlFor="release-strategy" className="block text-sm font-none text-foreground">Release Strategy</label>
                {isAnalyzing ? <Skeleton className="h-[50px] w-full" /> : <input id="release-strategy"
                  type="text"
                  placeholder="Filled from script upload"
                  value={filmReleaseStrategy}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
                  onChange={(e) => setFilmReleaseStrategy(e.target.value)}
                />}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="expected-budget" className="block text-sm font-none text-foreground">Expected Budget (Optional)</label>
                {isAnalyzing ? <Skeleton className="h-[50px] w-full" /> : <input id="expected-budget"
                  type="text"
                  placeholder="Filled from script upload"
                  value={filmExpectedBudget}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
                  onChange={(e) => setFilmExpectedBudget(e.target.value)}
                />}
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
                role="button"
                tabIndex={0}
                aria-pressed={specialist.selected}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setAiAgent(specialist.id) } }}
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
                      src={assetPath(`images/${specialist.icon}`)}
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
          <CustomButton disable={disable || createLoader || !uploadedFile} handleFN={handleProjectCreate} btnTitle="Create Project" isLoading={createLoader} />
          {/* <span className="flex-grow h-[1px] bg-[#2a2a2a]"></span>
          <CustomButton disable={disable || createLoader} handleFN={handleProjectCreate} btnTitle="Create Project" isLoading={createLoader} /> */}
        </div>
      </div>
    </div>
  )
}
