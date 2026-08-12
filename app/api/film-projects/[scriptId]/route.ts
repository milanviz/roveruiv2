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

function ensureStaticProject(scriptId: string) {
  const existing = getFilmProjectByScriptId(scriptId)
  if (existing?.analysis_json) {
    const parsed = parseAnalysisJson(existing.analysis_json)
    if (parsed.sections && Object.keys(parsed.sections).length >= 7) {
      return existing
    }
  }

  return upsertFilmProject({
    script_id: scriptId || STATIC_SCRIPT_ID,
    project_id: existing?.project_id || STATIC_PROJECT_ID,
    title: STATIC_FILM_METADATA.title,
    filename: STATIC_FILM_METADATA.filename,
    language: STATIC_FILM_METADATA.language,
    genre: STATIC_FILM_METADATA.genre,
    target_market: STATIC_FILM_METADATA.targetMarket,
    release_strategy: STATIC_FILM_METADATA.releaseStrategy,
    expected_budget: STATIC_FILM_METADATA.expectedBudget,
    metadata: STATIC_FILM_METADATA,
    analysis: STATIC_FILM_ANALYSIS,
  })
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

    const project = ensureStaticProject(scriptId)
    const storedAnalysis = parseAnalysisJson(project?.analysis_json)

    return NextResponse.json({
      script_id: scriptId,
      project,
      file_url: project?.file_url ?? null,
      metadata: STATIC_FILM_METADATA,
      analysis: storedAnalysis?.sections ? storedAnalysis : STATIC_FILM_ANALYSIS,
      workflowError: null,
      static: true,
    })
  } catch (error) {
    console.error("GET /api/film-projects/[scriptId] failed:", error)
    return NextResponse.json({ error: "Failed to load film project" }, { status: 500 })
  }
}
