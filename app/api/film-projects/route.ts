import { NextResponse } from "next/server"
import { listFilmProjects, upsertFilmProject } from "@/lib/db"
import {
  STATIC_FILM_ANALYSIS,
  STATIC_FILM_METADATA,
  STATIC_SCRIPT_ID,
} from "@/lib/static-film-data"

export const runtime = "nodejs"

export async function GET() {
  try {
    // Ensure the static demo project exists
    upsertFilmProject({
      script_id: STATIC_SCRIPT_ID,
      project_id: "aan-paavam",
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

    const projects = listFilmProjects()
    return NextResponse.json({ projects })
  } catch (error) {
    console.error("GET /api/film-projects failed:", error)
    return NextResponse.json({ error: "Failed to list film projects" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const script_id = body.script_id || body.scriptId || STATIC_SCRIPT_ID
    const title = body.title || body.projectName || STATIC_FILM_METADATA.title

    const metadata = body.metadata ?? {
      ...STATIC_FILM_METADATA,
      title,
      language: body.language ?? STATIC_FILM_METADATA.language,
      genre: body.genre ?? STATIC_FILM_METADATA.genre,
      targetMarket: body.target_market ?? body.targetMarket ?? STATIC_FILM_METADATA.targetMarket,
      releaseStrategy: body.release_strategy ?? body.releaseStrategy ?? STATIC_FILM_METADATA.releaseStrategy,
      expectedBudget: body.expected_budget ?? body.expectedBudget ?? STATIC_FILM_METADATA.expectedBudget,
      scriptId: script_id,
      filename: body.filename ?? STATIC_FILM_METADATA.filename,
    }

    const project = upsertFilmProject({
      script_id,
      project_id: body.project_id ?? body.projectId ?? "aan-paavam",
      title,
      filename: body.filename ?? metadata.filename ?? STATIC_FILM_METADATA.filename,
      language: body.language ?? metadata.language ?? STATIC_FILM_METADATA.language,
      genre: body.genre ?? metadata.genre ?? STATIC_FILM_METADATA.genre,
      target_market:
        body.target_market ??
        body.targetMarket ??
        metadata.targetMarket ??
        STATIC_FILM_METADATA.targetMarket,
      release_strategy:
        body.release_strategy ??
        body.releaseStrategy ??
        metadata.releaseStrategy ??
        STATIC_FILM_METADATA.releaseStrategy,
      expected_budget:
        body.expected_budget ??
        body.expectedBudget ??
        metadata.expectedBudget ??
        STATIC_FILM_METADATA.expectedBudget,
      metadata,
      analysis: body.analysis ?? STATIC_FILM_ANALYSIS,
    })

    return NextResponse.json({ project, static: true })
  } catch (error) {
    console.error("POST /api/film-projects failed:", error)
    return NextResponse.json({ error: "Failed to save film project" }, { status: 500 })
  }
}
