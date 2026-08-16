import { WORKFLOW_LINKS, workflowUrl, type WorkflowLink } from "@/lib/workflow-links"
import {
  cachedWorkflowRequest,
  invalidateWorkflowCache,
  readWorkflowCache,
  WORKFLOW_CACHE_TTL,
  writeWorkflowCache,
} from "@/lib/workflow-cache"

export type FilmAnalysisSection =
  | "overview"
  | "story"
  | "characters"
  | "commercial"
  | "production"
  | "development"
  | "greenlight"

export const FILM_ANALYSIS_SECTIONS: FilmAnalysisSection[] = [
  "overview",
  "story",
  "characters",
  "commercial",
  "production",
  "development",
  "greenlight",
]

export type SavedFilmDashboard = {
  user_id: string
  user_email: string
  project_id: string
  file_name: string
  file_full_url: string
  sections: Record<FilmAnalysisSection, Record<string, unknown>>
}

const dashboardCacheKey = (email: string, projectId: string) =>
  `film-dashboard:${email.toLowerCase()}:${projectId}`
const dashboardLookupCacheKey = (email: string, projectId: string) =>
  `film-dashboard-lookup:${email.toLowerCase()}:${projectId}`
const metadataCacheKey = (scriptId: string) => `film-metadata:${scriptId}`

export function isFilmAnalysisSection(value: string): value is FilmAnalysisSection {
  return (FILM_ANALYSIS_SECTIONS as string[]).includes(value)
}

/** Extract a Vizru files.pxy URL from arbitrary workflow JSON. */
export function extractFileProxyUrl(payload: unknown): string | null {
  const urls: string[] = []

  const visit = (value: unknown) => {
    if (value == null) return
    if (typeof value === "string") {
      const matches = value.match(/https?:\/\/[^\s"'\\]+files\.pxy[^\s"'\\]*/gi)
      if (matches) {
        for (const m of matches) urls.push(m.replace(/[,;.]+$/, ""))
      } else if (/sys\/core\/files\.pxy/i.test(value) || /files\.pxy/i.test(value)) {
        const maybe = value.trim()
        if (maybe.startsWith("http")) urls.push(maybe)
      }
      return
    }
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (typeof value === "object") {
      for (const v of Object.values(value as Record<string, unknown>)) visit(v)
    }
  }

  visit(payload)
  return urls[0] ?? null
}

function asRecordList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item),
  )
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function workflowRecordList(value: unknown): Record<string, unknown>[] {
  const parsed = parseMaybeJson(value)
  if (Array.isArray(parsed)) {
    const records = asRecordList(parsed)
    if (records.some((row) => "project_id" in row)) return records
    for (const record of records) {
      for (const key of ["output", "data", "projects", "result", "filter", "val"]) {
        if (key in record) {
          const nested = workflowRecordList(record[key])
          if (nested.length) return nested
        }
      }
    }
    return records
  }
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>
    if ("project_id" in record) return [record]
    for (const key of ["output", "data", "projects", "result", "filter", "val"]) {
      if (key in record) {
        const nested = workflowRecordList(record[key])
        if (nested.length) return nested
      }
    }
  }
  return []
}

function storedSection(value: unknown): Record<string, unknown> | null {
  const unwrappedValue = value && typeof value === "object" && !Array.isArray(value) && "data" in value
    ? (value as Record<string, unknown>).data
    : value
  const parsed = parseMaybeJson(unwrappedValue)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>
  if (typeof record.output === "string") {
    const unwrapped = coerceJsonObject(record.output)
    if (unwrapped) return unwrapped
  }
  return record
}

function fieldString(value: unknown): string {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "data" in value) {
    return fieldString((value as Record<string, unknown>).data)
  }
  return value == null ? "" : String(value)
}

async function postWorkflowFields(
  workflow: WorkflowLink,
  fields: Record<string, string>,
): Promise<unknown> {
  const body = new FormData()
  Object.entries(fields).forEach(([key, value]) => body.append(key, value))
  const response = await fetch(workflowUrl(workflow), {
    method: "POST",
    body,
  })
  const text = await response.text()
  if (!response.ok || /internal server error/i.test(text)) {
    throw new Error(`Workflow ${workflow} failed: ${response.status} ${text}`.trim())
  }
  return parseMaybeJson(text)
}

export async function fetchSavedFilmDashboard(
  userEmail: string,
  projectId: string,
  force = false,
): Promise<SavedFilmDashboard | null> {
  if (!userEmail || !projectId) return null
  const projectKey = dashboardCacheKey(userEmail, projectId)
  if (!force) {
    const projectCached = readWorkflowCache<SavedFilmDashboard>(projectKey)
    if (projectCached) return projectCached
  }

  const rows = await cachedWorkflowRequest(
    dashboardLookupCacheKey(userEmail, projectId),
    WORKFLOW_CACHE_TTL.DASHBOARD_LIST,
    async () => {
      const raw = await postWorkflowFields(WORKFLOW_LINKS.GET_FILM_DASHBOARD, {
        user_email: userEmail,
        project_id: projectId,
      })
      return workflowRecordList(raw)
    },
    { force, staleOnError: false },
  )
  const row = rows.find((candidate) => fieldString(candidate.project_id) === projectId)
  if (!row) return null

  const sections = {} as Record<FilmAnalysisSection, Record<string, unknown>>
  for (const section of FILM_ANALYSIS_SECTIONS) {
    const value = storedSection(row[`file_${section}`])
    if (!value) return null
    sections[section] = value
  }

  const dashboard = {
    user_id: fieldString(row.user_id),
    user_email: fieldString(row.user_email),
    project_id: fieldString(row.project_id),
    file_name: fieldString(row.file_name),
    file_full_url: fieldString(row.file_full_url),
    sections,
  }
  writeWorkflowCache(projectKey, dashboard, WORKFLOW_CACHE_TTL.DASHBOARD)
  return dashboard
}

export async function saveFilmDashboard(input: SavedFilmDashboard): Promise<unknown> {
  const fields: Record<string, string> = {
    user_id: input.user_id,
    user_email: input.user_email,
    project_id: input.project_id,
    file_name: input.file_name,
    file_full_url: input.file_full_url,
  }
  for (const section of FILM_ANALYSIS_SECTIONS) {
    fields[`file_${section}`] = JSON.stringify(input.sections[section])
  }
  const result = await postWorkflowFields(WORKFLOW_LINKS.SAVE_FILM_DASHBOARD, fields)
  writeWorkflowCache(
    dashboardCacheKey(input.user_email, input.project_id),
    input,
    WORKFLOW_CACHE_TTL.DASHBOARD,
  )
  invalidateWorkflowCache(dashboardLookupCacheKey(input.user_email, input.project_id))
  return result
}

function rowScriptId(row: Record<string, unknown>): string | null {
  const sid = row.script_id ?? row.scriptId
  return typeof sid === "string" && sid.trim() ? sid.trim() : null
}

function rowFileUrl(row: Record<string, unknown>): string | null {
  const candidates = [
    row.file_url,
    row.fileUrl,
    row.FileFullPath,
    row.url,
  ]
  for (const c of candidates) {
    if (typeof c === "string" && /files\.pxy/i.test(c)) {
      return c.trim()
    }
  }
  return extractFileProxyUrl(row)
}

/**
 * Metadata WF returns ALL rows where script_id != null (not filtered to the request).
 * Pick the row matching our scriptId and use that row's file_url only.
 */
export function resolveScriptFileRecord(
  raw: unknown,
  scriptId: string,
): { fileUrl: string; metadata: Record<string, unknown> } | null {
  if (!scriptId) return null

  // Unwrap common Vizru shapes: [{ output: ... }] or { output: ... }
  let payload: unknown = raw
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0] as Record<string, unknown>
    if (first && typeof first === "object" && "output" in first && !("script_id" in first) && !("file_url" in first)) {
      payload = parseMaybeJson(first.output)
    } else {
      payload = raw
    }
  } else if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const obj = payload as Record<string, unknown>
    if ("output" in obj && !("script_id" in obj) && !("file_url" in obj)) {
      payload = parseMaybeJson(obj.output)
    }
  }

  let candidates = asRecordList(payload)

  // Prefer the nested `filter` JSON string — it carries the full row list
  if (candidates.length > 0 && typeof candidates[0].filter === "string") {
    const fromFilter = asRecordList(parseMaybeJson(candidates[0].filter))
    if (fromFilter.length > 0) {
      candidates = fromFilter
    }
  } else if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    typeof (payload as Record<string, unknown>).filter === "string"
  ) {
    const fromFilter = asRecordList(
      parseMaybeJson((payload as Record<string, unknown>).filter),
    )
    if (fromFilter.length > 0) {
      candidates = fromFilter
    }
  }

  if (candidates.length === 0) return null

  const match = candidates.find((row) => rowScriptId(row) === scriptId)
  if (!match) return null

  const fileUrl = rowFileUrl(match)
  if (!fileUrl) return null

  return { fileUrl, metadata: match }
}

export function parseWorkflowOutput(payload: unknown): unknown {
  if (!payload) return null

  if (Array.isArray(payload) && payload.length > 0) {
    const first = payload[0] as Record<string, unknown>
    // Metadata list responses: keep as array (caller filters by script_id)
    if (
      first &&
      typeof first === "object" &&
      ("script_id" in first || "file_url" in first || "filter" in first) &&
      !("output" in first)
    ) {
      return payload
    }
    if (typeof first.output === "string") {
      try {
        return JSON.parse(first.output)
      } catch {
        return first.output
      }
    }
    if (first.output && typeof first.output === "object") {
      return first.output
    }
    return first
  }

  if (typeof payload === "object") {
    const obj = payload as Record<string, unknown>
    if (typeof obj.output === "string") {
      try {
        return JSON.parse(obj.output)
      } catch {
        return obj.output
      }
    }
    if (obj.output && typeof obj.output === "object") {
      return obj.output
    }
    return obj
  }

  if (typeof payload === "string") {
    try {
      return JSON.parse(payload)
    } catch {
      return payload
    }
  }

  return payload
}

/** Pull a JSON object out of model text that may include markdown fences. */
export function coerceJsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value !== "string") return null

  const trimmed = value.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1].trim() : trimmed

  try {
    const parsed = JSON.parse(candidate)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    const start = candidate.indexOf("{")
    const end = candidate.lastIndexOf("}")
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(candidate.slice(start, end + 1))
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>
        }
      } catch {
        return null
      }
    }
  }

  return null
}


export async function fetchMetadataWorkflow(scriptId: string, force = false): Promise<{
  metadata: unknown
  fileUrl: string | null
  raw: unknown
}> {
  return cachedWorkflowRequest(
    metadataCacheKey(scriptId),
    WORKFLOW_CACHE_TTL.FILE_METADATA,
    async () => {
      const workflowRes = await fetch(workflowUrl(WORKFLOW_LINKS.FILM_METADATA), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script_id: scriptId }),
      })

      if (!workflowRes.ok) {
        throw new Error(`Metadata workflow failed with status ${workflowRes.status}`)
      }

      const raw = await workflowRes.json()
      const matched = resolveScriptFileRecord(raw, scriptId)
      if (matched) return { metadata: matched.metadata, fileUrl: matched.fileUrl, raw }

      // Fail closed: never return another script's file_url
      return { metadata: parseWorkflowOutput(raw), fileUrl: null, raw }
    },
    { force },
  )
}

export async function fetchSummarizeWorkflow(fileUrl: string, prompt: string, section: string): Promise<unknown> {
  const workflowRes = await fetch(workflowUrl(WORKFLOW_LINKS.FILM_SUMMARIZE), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: fileUrl, prompt, section_name: section }),
  })

  if (!workflowRes.ok) {
    throw new Error(`Summarize workflow failed with status ${workflowRes.status}`)
  }

  const raw = await workflowRes.json()
  return parseWorkflowOutput(raw)
}
