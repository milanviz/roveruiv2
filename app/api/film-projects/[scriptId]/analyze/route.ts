import { NextResponse } from "next/server"
import {
  getFilmProjectByScriptId,
  mergeAnalysisSection,
  parseAnalysisJson,
  upsertFilmProject,
  type FilmAnalysisSection,
} from "@/lib/db"
import { isFilmAnalysisSection } from "@/lib/film-workflows"
import {
  getStaticSectionData,
  STATIC_FILM_ANALYSIS,
  STATIC_FILM_METADATA,
  STATIC_PROJECT_ID,
  STATIC_SCRIPT_ID,
} from "@/lib/static-film-data"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ scriptId: string }> },
) {
  try {
    const { scriptId } = await context.params
    if (!scriptId) {
      return NextResponse.json({ error: "script_id is required" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const sectionRaw = String(body.section || "").toLowerCase()

    if (!isFilmAnalysisSection(sectionRaw)) {
      return NextResponse.json(
        { error: "Invalid section. Expected one of overview, story, characters, commercial, production, development, greenlight" },
        { status: 400 },
      )
    }
    const section = sectionRaw as FilmAnalysisSection

    let project = getFilmProjectByScriptId(scriptId)
    if (!project) {
      project = upsertFilmProject({
        script_id: scriptId || STATIC_SCRIPT_ID,
        project_id: STATIC_PROJECT_ID,
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

    const data = getStaticSectionData(section) || {}
    const updated = mergeAnalysisSection(scriptId, section, data)
    const updatedAnalysis = parseAnalysisJson(updated?.analysis_json)

    return NextResponse.json({
      script_id: scriptId,
      section,
      data,
      cached: true,
      static: true,
      generatedAt: new Date().toISOString(),
      analysis: updatedAnalysis?.sections ? updatedAnalysis : STATIC_FILM_ANALYSIS,
    })
  } catch (error) {
    console.error("POST /api/film-projects/[scriptId]/analyze failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze section" },
      { status: 500 },
    )
  }
}
