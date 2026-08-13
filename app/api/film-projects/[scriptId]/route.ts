import { NextResponse } from "next/server"
import {
  getFilmProjectByScriptId,
  parseAnalysisJson,
  upsertFilmProject,
} from "@/lib/db"
import {
  STATIC_FILM_ANALYSIS,
  STATIC_FILM_METADATA,
  STATIC_PROJECT_ID,
  STATIC_SCRIPT_ID,
} from "@/lib/static-film-data"

export const runtime = "nodejs"

function ensureProject(scriptId: string) {
  let existing = getFilmProjectByScriptId(scriptId)
  if (!existing) {
    // If it doesn't exist at all, we create a basic placeholder entry
    // to prevent crashes, but we don't force static metadata on it.
    existing = upsertFilmProject({
      script_id: scriptId,
      project_id: `proj-${Date.now()}`,
      title: "Untitled Project",
      filename: "",
      language: "",
      genre: "",
      target_market: "",
      release_strategy: "",
      expected_budget: "",
      metadata: {},
      analysis: { sections: {} },
    })
  }
  return existing
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ scriptId: string }> },
) {
  try {
    const { scriptId } = await context.params
    if (!scriptId) {
      return NextResponse.json({ error: "script_id is required" }, { status: 400 })
    }

    const project = ensureProject(scriptId)
    let storedMetadata = {}
    try {
      if (project?.metadata_json) storedMetadata = JSON.parse(project.metadata_json)
    } catch(e) {}
    
    const storedAnalysis = parseAnalysisJson(project?.analysis_json)

    return NextResponse.json({
      script_id: scriptId,
      project,
      file_url: project?.file_url ?? null,
      metadata: storedMetadata,
      analysis: storedAnalysis?.sections ? storedAnalysis : { sections: {} },
      workflowError: null,
      static: false,
    })
  } catch (error) {
    console.error("GET /api/film-projects/[scriptId] failed:", error)
    return NextResponse.json({ error: "Failed to load film project" }, { status: 500 })
  }
}
