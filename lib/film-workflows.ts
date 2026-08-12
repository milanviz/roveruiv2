export type FilmAnalysisSection =
  | "overview"
  | "story"
  | "characters"
  | "commercial"
  | "production"
  | "development"
  | "greenlight"

export const FILM_UPLOAD_WORKFLOW_URL =
  "https://ai-demo.vizru-ras.com/workflow.trigger/6a7ad4f1c5d8c005b007707d"

export const FILM_METADATA_WORKFLOW_URL =
  "https://ai-demo.vizru-ras.com/workflow.trigger/6a7b1a94e50111edfa0f4a14"

export const FILM_SUMMARIZE_WORKFLOW_URL =
  "https://ai-demo.vizru-ras.com/workflow.trigger/6a7b11f304758ab3f80c6875"

export const FILM_ANALYSIS_SECTIONS: FilmAnalysisSection[] = [
  "overview",
  "story",
  "characters",
  "commercial",
  "production",
  "development",
  "greenlight",
]

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

type FilmProjectContext = {
  title: string
  language: string | null
  genre: string | null
  target_market: string | null
  release_strategy: string | null
  expected_budget: string | null
}

function projectContext(project: FilmProjectContext): string {
  return [
    `Title: ${project.title}`,
    `Language: ${project.language || "unknown"}`,
    `Genre: ${project.genre || "unknown"}`,
    `Target market: ${project.target_market || "unknown"}`,
    `Release strategy: ${project.release_strategy || "unknown"}`,
    `Expected budget: ${project.expected_budget || "unknown"}`,
  ].join("\n")
}

const GROUNDING = `Ground every claim ONLY in the attached screenplay. Do not invent characters, places, or plot points not present in the script. If something is unclear, use "not specified". Return JSON only — no markdown, no prose outside the JSON object.`

const SECTION_SCHEMAS: Record<FilmAnalysisSection, string> = {
  overview: `{
  "recommendation": { "status": "GREENLIGHT|DEVELOP|PASS", "score": 0-100, "confidence": "High|Medium|Low", "summary": "string" },
  "scores": { "story": 0-100, "commercial": 0-100, "production": 0-100, "audience": 0-100, "originality": 0-100, "risk": 0-100 },
  "logline": "string",
  "synopsis": "string (2-4 paragraphs)",
  "attributes": { "pages": number, "runtimeMinutes": number, "shootDays": number, "locations": number, "nightScenes": number, "actionSequences": number, "majorCast": number, "vfxScenes": number, "extras": number, "songs": number },
  "risks": [{ "title": "string", "severity": "High|Medium|Low", "summary": "string", "evidence": "string" }],
  "opportunities": [{ "title": "string", "summary": "string" }]
}`,
  story: `{
  "scores": { "story": 0-100, "originality": 0-100 },
  "storyScorecard": {
    "structuralPacing": "Excellent|Good|Fair|Weak (short label only, max 2 words)",
    "structuralPacingNotes": "1-2 sentences on pacing",
    "climaxBuild": "Excellent|Good|Fair|Weak or a short score like 85/100 (max 12 chars)",
    "climaxBuildNotes": "1-2 sentences on climax escalation"
  },
  "timelineEvents": [{ "title": "string", "description": "string", "page": "Page N or number", "tension": 0-100 }],
  "cinemaEvaluation": {
    "heroIntro": "Excellent|Good|Fair|Weak|N/A",
    "heroIntroDesc": "string",
    "intervalCliffhanger": "Excellent|Good|Fair|Weak|N/A",
    "intervalCliffhangerDesc": "string",
    "climaxEmotionalPayoff": "Excellent|Good|Fair|Weak|N/A",
    "climaxEmotionalPayoffDesc": "string",
    "massMoments": "Excellent|Good|Fair|Weak|N/A",
    "massMomentsDesc": "string",
    "songsIntegration": "Excellent|Good|Fair|Weak|Optional|N/A",
    "songsIntegrationDesc": "string"
  },
  "indianCinemaSignals": [{ "name": "string", "rating": "string", "explanation": "string" }],
  "tensionCurve": [{ "label": "short beat name (max 3 words)", "tension": 0-100 }]
}`,
  characters: `{
  "charactersList": [{
    "name": "string",
    "role": "string",
    "description": "string",
    "presence": "e.g. 85%",
    "dialogue": "e.g. 38%",
    "arc": "Strong|Moderate|Weak|Exceptional",
    "casting": "Critical|High|Medium|Low",
    "goal": "string",
    "motivation": "string",
    "conflict": "string",
    "transformation": "string"
  }]
}`,
  commercial: `{
  "distributionPotentials": { "theatrical": 0-100, "ott": 0-100, "panIndia": 0-100 },
  "comparables": [{ "name": "string", "narrativeSimilarity": 0-100, "audienceMatch": 0-100, "costMatch": 0-100, "marketFit": 0-100, "context": "string" }],
  "marketingHooks": [{ "title": "string", "description": "string" }],
  "viralMoments": [{ "title": "string", "description": "string" }],
  "audienceMetrics": {
    "primaryAudience": "string",
    "primaryMarket": "string",
    "secondaryMarket": "string",
    "metrics": [{ "name": "string", "score": 0-100 }]
  }
}`,
  production: `{
  "productionSummary": {
    "shootDays": number,
    "locations": number,
    "nightScenes": number,
    "actionSequences": number,
    "majorCharacters": number,
    "extras": number,
    "vfxScenes": number,
    "songs": number
  },
  "attributes": { "pages": number, "runtimeMinutes": number, "shootDays": number, "locations": number, "nightScenes": number, "actionSequences": number, "majorCast": number, "vfxScenes": number, "extras": number, "songs": number },
  "locationsList": [{ "name": "string", "scenes": number, "shootDays": number, "complexity": "Low|Medium|High", "type": "string" }],
  "castPlanning": [{ "character": "string", "starDependency": "string", "performance": "string", "shootDays": number }],
  "budgetBreakdown": [{ "category": "string", "min": number, "max": number, "confidence": "High|Medium|Low" }],
  "budgetInfo": {
    "min": number,
    "max": number,
    "currency": "INR",
    "confidence": "High|Medium|Low",
    "costDrivers": [{ "name": "string", "severity": "High|Medium|Low", "explanation": "string" }]
  }
}`,
  development: `{
  "rewriteNotes": [{
    "priority": "CRITICAL|RECOMMENDED|OPTIONAL",
    "target": "Scenes X-Y",
    "title": "string",
    "summary": "string",
    "before": "string",
    "action": "string"
  }],
  "developmentNotes": [{
    "priority": "CRITICAL|RECOMMENDED|OPTIONAL",
    "title": "string",
    "description": "string",
    "scene": "string",
    "before": "string",
    "actionable": "string"
  }],
  "draftComparison": [{
    "aspect": "string",
    "current": "string",
    "proposed": "string",
    "impact": "string"
  }]
}`,
  greenlight: `{
  "recommendation": { "status": "GREENLIGHT|DEVELOP|PASS|REQUEST REWRITE", "score": 0-100, "confidence": "High|Medium|Low", "summary": "string" },
  "whyItWorks": ["string", "string", "string"],
  "killRisks": [{ "title": "string", "severity": "High|Medium|Low", "summary": "string" }],
  "nextSteps": [{ "step": "string", "owner": "string", "timing": "string" }]
}`,
}

export function buildSectionPrompt(
  section: FilmAnalysisSection,
  project: FilmProjectContext,
): string {
  return `${GROUNDING}

Project context:
${projectContext(project)}

Analyze the screenplay for the "${section}" tab of a film intelligence workspace.
Return a single JSON object matching this schema exactly (include all keys; use empty arrays if none):
${SECTION_SCHEMAS[section]}`
}

export async function fetchMetadataWorkflow(scriptId: string): Promise<{
  metadata: unknown
  fileUrl: string | null
  raw: unknown
}> {
  const workflowRes = await fetch(FILM_METADATA_WORKFLOW_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script_id: scriptId }),
  })

  if (!workflowRes.ok) {
    throw new Error(`Metadata workflow failed with status ${workflowRes.status}`)
  }

  const raw = await workflowRes.json()
  const matched = resolveScriptFileRecord(raw, scriptId)
  if (matched) {
    return { metadata: matched.metadata, fileUrl: matched.fileUrl, raw }
  }

  // Fail closed: never return another script's file_url
  return { metadata: parseWorkflowOutput(raw), fileUrl: null, raw }
}

export async function fetchSummarizeWorkflow(fileUrl: string, prompt: string): Promise<unknown> {
  const workflowRes = await fetch(FILM_SUMMARIZE_WORKFLOW_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: fileUrl, prompt }),
  })

  if (!workflowRes.ok) {
    throw new Error(`Summarize workflow failed with status ${workflowRes.status}`)
  }

  const raw = await workflowRes.json()
  return parseWorkflowOutput(raw)
}
