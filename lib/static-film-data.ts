import staticPayload from "@/lib/static-film-data.json"
import type { FilmAnalysisSection } from "@/lib/film-workflows"
import type { FilmAnalysisCache } from "@/lib/db"

export const STATIC_SCRIPT_ID = "aan-paavam-static"
export const STATIC_PROJECT_ID = "aan-paavam"

export type StaticFilmMetadata = {
  title: string
  titleEnglish?: string
  language: string
  genre: string
  targetMarket: string
  releaseStrategy: string
  expectedBudget: string
  pages: number
  runtimeMinutes: number
  filename: string
  writer?: string
  presentedBy?: string
  year?: string
  scriptId: string
}

export const STATIC_FILM_METADATA = staticPayload.metadata as StaticFilmMetadata
// Flattened analysis + sections cache used by FilmWorkspace and API routes
export const STATIC_FILM_ANALYSIS = staticPayload.analysis as any as FilmAnalysisCache &
  Record<string, any>

export function getStaticSectionData(section: FilmAnalysisSection) {
  return STATIC_FILM_ANALYSIS.sections?.[section]?.data ?? null
}

export function isStaticScriptId(scriptId: string | null | undefined) {
  if (!scriptId) return true
  return (
    scriptId === STATIC_SCRIPT_ID ||
    scriptId.toLowerCase().includes("aan") ||
    scriptId.toLowerCase().includes("paavam")
  )
}
