import type { FilmAnalysisSection } from "@/lib/film-workflows"

export type FilmProjectContext = {
  title: string
  language: string | null
  genre: string | null
  target_market: string | null
  release_strategy: string | null
  expected_budget: string | null
}

export type FilmAnalysisTask = {
  key: string
  section: FilmAnalysisSection
  socketTag: string
}

type PromptDefinition = FilmAnalysisTask & {
  instruction: string
  schema: string
}

const task = (
  section: FilmAnalysisSection,
  key: string,
  instruction: string,
  schema: string,
  socketTag: string = section,
): PromptDefinition => ({ key, section, socketTag, instruction, schema })

const PROMPT_DEFINITIONS: Record<FilmAnalysisSection, PromptDefinition[]> = {
  overview: [
    task("overview", "overview-summary", "Producer verdict, scores, logline and synopsis.", `{
  "recommendation":{"status":"GREENLIGHT|DEVELOP|PASS","score":0,"confidence":"High|Medium|Low","summary":""},
  "scores":{"story":0,"commercial":0,"production":0,"audience":0,"originality":0,"risk":0},
  "logline":"","synopsis":""
}`),
    task("overview", "overview-scope", "Production scope, key risks and opportunities.", `{
  "attributes":{"pages":0,"runtimeMinutes":0,"shootDays":0,"locations":0,"nightScenes":0,"actionSequences":0,"majorCast":0,"vfxScenes":0,"extras":0,"songs":0},
  "risks":[{"title":"","severity":"High|Medium|Low","summary":"","evidence":""}],
  "opportunities":[{"title":"","summary":""}]
}`),
  ],
  story: [
    task("story", "story-scorecard", "Story scores and five concise cinema signals.", `{
  "scores":{"story":0,"originality":0},
  "storyScorecard":{"structuralPacing":"Excellent|Good|Fair|Weak","structuralPacingNotes":"","climaxBuild":"Excellent|Good|Fair|Weak","climaxBuildNotes":""},
  "indianCinemaSignals":[{"name":"","rating":"Excellent|Good|Fair|Weak|N/A","explanation":""}]
}`),
    task("story", "story-timeline", "Major story beats and tension curve; maximum 10 points.", `{
  "timelineEvents":[{"title":"","description":"","page":"Page N","tension":0}],
  "tensionCurve":[{"label":"","tension":0}]
}`),
  ],
  characters: [
    task("characters", "characters", "Principal characters only. presence and dialogue must be percentage strings such as 72%. Keep every text field to one short sentence.", `{
  "charactersList":[{"name":"","role":"","description":"","presence":"0%","dialogue":"0%","arc":"Strong|Moderate|Weak|Exceptional","casting":"Critical|High|Medium|Low","goal":"","motivation":"","conflict":"","transformation":""}]
}`),
  ],
  commercial: [
    task("commercial", "commercial-core", "Commercial score and three distribution scores.", `{
  "commercialViability":{"score":0,"confidence":"High|Medium|Low","verdict":"Strong|Promising|Uncertain|Weak","rationale":""},
  "distributionPotentials":{"theatrical":0,"ott":0,"panIndia":0}
}`),
    task("commercial", "commercial-revenue", "INR-crore revenue range and seasonal release window.", `{
  "grossPredictedRevenue":{"currency":"INR","unit":"crore","low":0,"likely":0,"high":0,"confidence":"High|Medium|Low","assumptions":[""]},
  "optimalReleaseWindow":{"window":"","season":"","rationale":"","avoid":[""]}
}`),
    task("commercial", "commercial-geography", "Top collection markets only; totals should broadly reconcile with gross revenue.", `{
  "collectionForecast":{"regions":[{"region":"","low":0,"likely":0,"high":0,"states":[{"state":"","low":0,"likely":0,"high":0,"keyDistricts":[{"district":"","low":0,"likely":0,"high":0}]}]}],"otherMarkets":{"low":0,"likely":0,"high":0}}
}`),
    task("commercial", "commercial-audience", "Audience profile, up to four comparables, hooks and viral moments.", `{
  "comparables":[{"name":"","narrativeSimilarity":0,"audienceMatch":0,"costMatch":0,"marketFit":0,"context":""}],
  "audienceMetrics":{"primaryAudience":"","primaryMarket":"","secondaryMarket":"","metrics":[{"name":"","score":0}]},
  "marketingHooks":[{"title":"","description":""}],"viralMoments":[{"title":"","description":""}]
}`),
  ],
  production: [
    task("production", "production-summary", "Production counts only.", `{
  "productionSummary":{"shootDays":0,"locations":0,"nightScenes":0,"actionSequences":0,"majorCharacters":0,"extras":0,"vfxScenes":0,"songs":0}
}`),
    task("production", "production-logistics", "Top locations and principal cast demands.", `{
  "locationsList":[{"name":"","scenes":0,"shootDays":0,"complexity":"Low|Medium|High","type":""}],
  "castPlanning":[{"character":"","starDependency":"","performance":"","shootDays":0}]
}`),
    task("production", "production-budget", "INR-crore budget, feasibility, bottlenecks and savings.", `{
  "productionFeasibility":{"score":0,"confidence":"High|Medium|Low","summary":"","bottlenecks":[""],"savings":[""]},
  "budgetBreakdown":[{"category":"","min":0,"max":0,"confidence":"High|Medium|Low"}],
  "budgetInfo":{"min":0,"max":0,"currency":"INR","confidence":"High|Medium|Low","costDrivers":[{"name":"","severity":"High|Medium|Low","explanation":""}]}
}`),
  ],
  development: [
    task("development", "development-notes", "Up to six scene-grounded rewrite notes.", `{
  "developmentNotes":[{"priority":"CRITICAL|RECOMMENDED|OPTIONAL","title":"","description":"","scene":"","before":"","actionable":""}]
}`),
    task("development", "development-impact", "Rewrite readiness and current-to-proposed impact.", `{
  "developmentImpact":{"readinessScore":0,"topPriority":"","expectedCommercialLift":"High|Medium|Low","expectedCostImpact":"Increase|Neutral|Decrease","summary":""},
  "draftComparison":[{"aspect":"","current":"","proposed":"","impact":""}]
}`),
  ],
  greenlight: [
    task("greenlight", "greenlight-decision", "Final producer recommendation and strongest reasons.", `{
  "recommendation":{"status":"GREENLIGHT|DEVELOP|PASS|REQUEST REWRITE","score":0,"confidence":"High|Medium|Low","summary":""},
  "whyItWorks":[""]
}`),
    task("greenlight", "greenlight-matrix", "Four decision scores and qualitative investment outlook.", `{
  "decisionMatrix":{"creative":0,"commercial":0,"production":0,"readiness":0},
  "investmentOutlook":{"riskLevel":"High|Medium|Low","returnPotential":"High|Medium|Low","capitalFit":"","conditions":[""]}
}`),
    task("greenlight", "greenlight-actions", "Fatal risks and concrete next steps.", `{
  "killRisks":[{"title":"","severity":"High|Medium|Low","summary":""}],
  "nextSteps":[{"step":"","owner":"","timing":""}]
}`),
  ],
}

export const FILM_ANALYSIS_TASKS: FilmAnalysisTask[] = Object.values(PROMPT_DEFINITIONS)
  .flat()
  .map(({ key, section, socketTag }) => ({ key, section, socketTag }))

export function tasksForSection(section: FilmAnalysisSection): FilmAnalysisTask[] {
  return FILM_ANALYSIS_TASKS.filter((item) => item.section === section)
}

function compactContext(project: FilmProjectContext): string {
  return JSON.stringify({
    "Screenplay Title": project.title || "not specified",
    "Screenplay Language": project.language || "not specified",
    Genre: project.genre || "not specified",
    "Target Market / Industry": project.target_market || "not specified",
    "Release Strategy": project.release_strategy || "not specified",
    "Expected Budget (Optional)": project.expected_budget || "not specified",
  })
}

export function buildSectionPromptTasks(
  section: FilmAnalysisSection,
  project: FilmProjectContext,
): Array<FilmAnalysisTask & { prompt: string }> {
  return PROMPT_DEFINITIONS[section].map(({ instruction, schema, ...definition }) => ({
    ...definition,
    prompt: `Use only the screenplay; never invent plot facts. Estimates are heuristic. JSON only.\nproject_meta=${compactContext(project)}\n${instruction}\n${schema}`,
  }))
}
