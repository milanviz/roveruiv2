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
  overview: [task("overview", "overview", "Give a concise producer-level overview.", `{
  "recommendation":{"status":"GREENLIGHT|DEVELOP|PASS","score":0,"confidence":"High|Medium|Low","summary":""},
  "scores":{"story":0,"commercial":0,"production":0,"audience":0,"originality":0,"risk":0},
  "logline":"","synopsis":"",
  "attributes":{"pages":0,"runtimeMinutes":0,"shootDays":0,"locations":0,"nightScenes":0,"actionSequences":0,"majorCast":0,"vfxScenes":0,"extras":0,"songs":0},
  "risks":[{"title":"","severity":"High|Medium|Low","summary":"","evidence":""}],
  "opportunities":[{"title":"","summary":""}]
}`)],
  story: [task("story", "story", "Evaluate structure, pacing, cinematic beats, and tension.", `{
  "scores":{"story":0,"originality":0},
  "storyScorecard":{"structuralPacing":"Excellent|Good|Fair|Weak","structuralPacingNotes":"","climaxBuild":"Excellent|Good|Fair|Weak","climaxBuildNotes":""},
  "timelineEvents":[{"title":"","description":"","page":"Page N","tension":0}],
  "cinemaEvaluation":{"heroIntro":"Excellent|Good|Fair|Weak|N/A","heroIntroDesc":"","intervalCliffhanger":"Excellent|Good|Fair|Weak|N/A","intervalCliffhangerDesc":"","climaxEmotionalPayoff":"Excellent|Good|Fair|Weak|N/A","climaxEmotionalPayoffDesc":"","massMoments":"Excellent|Good|Fair|Weak|N/A","massMomentsDesc":"","songsIntegration":"Excellent|Good|Fair|Weak|Optional|N/A","songsIntegrationDesc":""},
  "indianCinemaSignals":[{"name":"","rating":"","explanation":""}],
  "tensionCurve":[{"label":"","tension":0}]
}`)],
  characters: [task("characters", "characters", "Analyze the principal characters and their dramatic function.", `{
  "charactersList":[{"name":"","role":"","description":"","presence":"","dialogue":"","arc":"Strong|Moderate|Weak|Exceptional","casting":"Critical|High|Medium|Low","goal":"","motivation":"","conflict":"","transformation":""}]
}`)],
  commercial: [
    task("commercial", "commercial-core", "Assess commercial positioning and distribution potential.", `{
  "commercialViability":{"score":0,"confidence":"High|Medium|Low","verdict":"Strong|Promising|Uncertain|Weak","rationale":""},
  "distributionPotentials":{"theatrical":0,"ott":0,"panIndia":0}
}`, "film-commercial-core"),
    task("commercial", "commercial-forecast", "Estimate revenue and the best release window. Use INR crore ranges, not exact claims. Forecast only top markets; regional estimates should broadly reconcile with the total.", `{
  "grossPredictedRevenue":{"currency":"INR","unit":"crore","low":0,"likely":0,"high":0,"confidence":"High|Medium|Low","assumptions":[""]},
  "optimalReleaseWindow":{"window":"","season":"","rationale":"","avoid":[""]},
  "collectionForecast":{"regions":[{"region":"","low":0,"likely":0,"high":0,"states":[{"state":"","low":0,"likely":0,"high":0,"keyDistricts":[{"district":"","low":0,"likely":0,"high":0}]}]}],"otherMarkets":{"low":0,"likely":0,"high":0}}
}`, "film-commercial-forecast"),
    task("commercial", "commercial-audience", "Identify audience fit, useful comparables, and marketable moments.", `{
  "comparables":[{"name":"","narrativeSimilarity":0,"audienceMatch":0,"costMatch":0,"marketFit":0,"context":""}],
  "audienceMetrics":{"primaryAudience":"","primaryMarket":"","secondaryMarket":"","metrics":[{"name":"","score":0}]},
  "marketingHooks":[{"title":"","description":""}],
  "viralMoments":[{"title":"","description":""}]
}`, "film-commercial-audience"),
  ],
  production: [
    task("production", "production-logistics", "Estimate production scale and practical shooting demands.", `{
  "productionSummary":{"shootDays":0,"locations":0,"nightScenes":0,"actionSequences":0,"majorCharacters":0,"extras":0,"vfxScenes":0,"songs":0},
  "locationsList":[{"name":"","scenes":0,"shootDays":0,"complexity":"Low|Medium|High","type":""}],
  "castPlanning":[{"character":"","starDependency":"","performance":"","shootDays":0}]
}`, "film-production-logistics"),
    task("production", "production-budget", "Estimate budget feasibility in INR crore and identify constraints and savings.", `{
  "productionFeasibility":{"score":0,"confidence":"High|Medium|Low","summary":"","bottlenecks":[""],"savings":[""]},
  "budgetBreakdown":[{"category":"","min":0,"max":0,"confidence":"High|Medium|Low"}],
  "budgetInfo":{"min":0,"max":0,"currency":"INR","confidence":"High|Medium|Low","costDrivers":[{"name":"","severity":"High|Medium|Low","explanation":""}]}
}`, "film-production-budget"),
  ],
  development: [
    task("development", "development-notes", "Return the highest-value actionable rewrite notes, grounded in specific scenes.", `{
  "developmentNotes":[{"priority":"CRITICAL|RECOMMENDED|OPTIONAL","title":"","description":"","scene":"","before":"","actionable":""}]
}`, "film-development-notes"),
    task("development", "development-impact", "Estimate how the proposed rewrites affect readiness, audience appeal, and production cost.", `{
  "developmentImpact":{"readinessScore":0,"topPriority":"","expectedCommercialLift":"High|Medium|Low","expectedCostImpact":"Increase|Neutral|Decrease","summary":""},
  "draftComparison":[{"aspect":"","current":"","proposed":"","impact":""}]
}`, "film-development-impact"),
  ],
  greenlight: [
    task("greenlight", "greenlight-decision", "Make a concise producer decision and explain the strongest reasons.", `{
  "recommendation":{"status":"GREENLIGHT|DEVELOP|PASS|REQUEST REWRITE","score":0,"confidence":"High|Medium|Low","summary":""},
  "whyItWorks":[""]
}`, "film-greenlight-decision"),
    task("greenlight", "greenlight-actions", "Assess decision factors, investment posture, fatal risks, and next actions.", `{
  "decisionMatrix":{"creative":0,"commercial":0,"production":0,"readiness":0},
  "investmentOutlook":{"riskLevel":"High|Medium|Low","returnPotential":"High|Medium|Low","capitalFit":"","conditions":[""]},
  "killRisks":[{"title":"","severity":"High|Medium|Low","summary":""}],
  "nextSteps":[{"step":"","owner":"","timing":""}]
}`, "film-greenlight-actions"),
  ],
}

export const FILM_ANALYSIS_TASKS: FilmAnalysisTask[] = Object.values(PROMPT_DEFINITIONS)
  .flat()
  .map(({ key, section, socketTag }) => ({ key, section, socketTag }))

export function tasksForSection(section: FilmAnalysisSection): FilmAnalysisTask[] {
  return FILM_ANALYSIS_TASKS.filter((item) => item.section === section)
}

function compactContext(project: FilmProjectContext): string {
  return [
    project.title,
    project.language || "unknown language",
    project.genre || "unknown genre",
    project.target_market || "unknown market",
    project.release_strategy || "unknown release strategy",
    project.expected_budget || "unknown budget",
  ].join(" | ")
}

export function buildSectionPromptTasks(
  section: FilmAnalysisSection,
  project: FilmProjectContext,
): Array<FilmAnalysisTask & { prompt: string }> {
  return PROMPT_DEFINITIONS[section].map(({ instruction, schema, ...definition }) => ({
    ...definition,
    prompt: `Analyze only the attached screenplay. Do not invent story facts. Market and financial figures are heuristic estimates, not live data. Use "not specified" when evidence is absent. JSON only.\nContext: ${compactContext(project)}\nTask: ${instruction}\nReturn: ${schema}`,
  }))
}
