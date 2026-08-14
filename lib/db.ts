import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import type { FilmAnalysisSection } from "@/lib/film-workflows"

export type { FilmAnalysisSection }

export type FilmProjectRow = {
  script_id: string
  project_id: string | null
  title: string
  filename: string | null
  language: string | null
  genre: string | null
  target_market: string | null
  release_strategy: string | null
  expected_budget: string | null
  file_url: string | null
  metadata_json: string | null
  analysis_json: string | null
  created_at: string
  updated_at: string
}

export type FilmAnalysisCache = {
  sections?: Partial<
    Record<
      FilmAnalysisSection,
      {
        generatedAt: string
        data: Record<string, unknown>
      }
    >
  >
  [key: string]: unknown
}

const globalForDb = globalThis as unknown as {
  __filmDb?: DatabaseSync
}

function getDbPath() {
  const dir = path.join(process.cwd(), "data")
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return path.join(dir, "film-projects.sqlite")
}

function ensureFileUrlColumn(db: DatabaseSync) {
  const cols = db.prepare(`PRAGMA table_info(film_projects)`).all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === "file_url")) {
    db.exec(`ALTER TABLE film_projects ADD COLUMN file_url TEXT`)
  }
}

export function getFilmDb() {
  if (!globalForDb.__filmDb) {
    const db = new DatabaseSync(getDbPath())
    db.exec(`
      CREATE TABLE IF NOT EXISTS film_projects (
        script_id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT NOT NULL,
        filename TEXT,
        language TEXT,
        genre TEXT,
        target_market TEXT,
        release_strategy TEXT,
        expected_budget TEXT,
        file_url TEXT,
        metadata_json TEXT,
        analysis_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_film_projects_project_id ON film_projects(project_id);
    `)
    ensureFileUrlColumn(db)
    globalForDb.__filmDb = db
  }
  return globalForDb.__filmDb
}

export function parseAnalysisJson(raw: string | null | undefined): FilmAnalysisCache {
  if (!raw) return { sections: {} }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return { sections: {} }
    if (!parsed.sections || typeof parsed.sections !== "object") {
      return { ...parsed, sections: {} }
    }
    return parsed as FilmAnalysisCache
  } catch {
    return { sections: {} }
  }
}

export function getAnalysisSection(
  analysis: FilmAnalysisCache | string | null | undefined,
  section: FilmAnalysisSection,
) {
  const cache = typeof analysis === "string" || analysis == null
    ? parseAnalysisJson(analysis)
    : analysis
  return cache.sections?.[section] ?? null
}

export function upsertFilmProject(input: {
  script_id: string
  project_id?: string | null
  title: string
  filename?: string | null
  language?: string | null
  genre?: string | null
  target_market?: string | null
  release_strategy?: string | null
  expected_budget?: string | null
  file_url?: string | null
  metadata?: Record<string, unknown> | null
  analysis?: unknown
}) {
  const db = getFilmDb()
  db.prepare(`
    INSERT INTO film_projects (
      script_id, project_id, title, filename, language, genre,
      target_market, release_strategy, expected_budget, file_url,
      metadata_json, analysis_json, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
    )
    ON CONFLICT(script_id) DO UPDATE SET
      project_id = excluded.project_id,
      title = excluded.title,
      filename = COALESCE(excluded.filename, film_projects.filename),
      language = excluded.language,
      genre = excluded.genre,
      target_market = excluded.target_market,
      release_strategy = excluded.release_strategy,
      expected_budget = excluded.expected_budget,
      file_url = COALESCE(excluded.file_url, film_projects.file_url),
      metadata_json = excluded.metadata_json,
      analysis_json = COALESCE(excluded.analysis_json, film_projects.analysis_json),
      updated_at = datetime('now')
  `).run(
    input.script_id,
    input.project_id ?? null,
    input.title,
    input.filename ?? null,
    input.language ?? null,
    input.genre ?? null,
    input.target_market ?? null,
    input.release_strategy ?? null,
    input.expected_budget ?? null,
    input.file_url ?? null,
    input.metadata ? JSON.stringify(input.metadata) : null,
    input.analysis != null ? JSON.stringify(input.analysis) : null,
  )

  return getFilmProjectByScriptId(input.script_id)
}

export function updateFilmProjectFileUrl(scriptId: string, fileUrl: string) {
  const db = getFilmDb()
  db.prepare(`
    UPDATE film_projects
    SET file_url = ?, updated_at = datetime('now')
    WHERE script_id = ?
  `).run(fileUrl, scriptId)
  return getFilmProjectByScriptId(scriptId)
}

export function mergeAnalysisSection(
  scriptId: string,
  section: FilmAnalysisSection,
  data: Record<string, unknown>,
) {
  const existing = getFilmProjectByScriptId(scriptId)
  if (!existing) return null

  const cache = parseAnalysisJson(existing.analysis_json)
  const sections = { ...(cache.sections || {}) }
  sections[section] = {
    generatedAt: new Date().toISOString(),
    data,
  }

  const merged: FilmAnalysisCache = {
    ...cache,
    ...data,
    sections,
  }

  const db = getFilmDb()
  db.prepare(`
    UPDATE film_projects
    SET analysis_json = ?, updated_at = datetime('now')
    WHERE script_id = ?
  `).run(JSON.stringify(merged), scriptId)

  return getFilmProjectByScriptId(scriptId)
}

export function listFilmProjects(): FilmProjectRow[] {
  const db = getFilmDb()
  return db.prepare(`
    SELECT * FROM film_projects
    ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
  `).all() as FilmProjectRow[]
}

export function getFilmProjectByScriptId(scriptId: string): FilmProjectRow | null {
  const db = getFilmDb()
  const row = db.prepare(`
    SELECT * FROM film_projects WHERE script_id = ?
  `).get(scriptId) as FilmProjectRow | undefined
  return row ?? null
}
