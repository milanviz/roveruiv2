import { APP_CONFIG } from "@/app/config/config"

/**
 * Central registry for every Vizru workflow used by the application.
 * Keep paths relative so the same workflows work through the local proxy and
 * against configured deployments.
 */
export const WORKFLOW_LINKS = {
  USER_DETAILS: "workflow.trigger/6a808ee4c2d02f1db00f8ee3",
  PROJECT_LIST: "workflow.trigger/6a8091a187061342c60acce2",
  CREATE_PROJECT: "workflow.trigger/6a8092676a4c74d61e08e6e2",
  SHARE_PROJECT: "workflow.exec/roverprojectshare664dbc92c3028",
  ARCHIVE_PROJECT: "workflow.exec/roverprojectarchive66603dce19f00",

  CHAT_HISTORY: "workflow.trigger/6a80c45a6887dec5dc0bbc88",
  ASK_ROVER_CHAT: "workflow.trigger/6a75d645d22b6778627fdfd2",
  AFTER_MESSAGE_RECEIVE: "workflow.trigger/6a80c8c32b3b61a48101e458",
  TRANSLATE: "workflow.exec/rovertranslatetext6655997db8938",

  GET_INSIGHTS: "workflow.exec/roverv2getmyinsights692431386908a",
  ADD_TO_INSIGHTS: "workflow.exec/roverv2voting695e06fb20368",
  ARCHIVE_INSIGHT: "workflow.exec/rovermyinsightsarchiveunarchive670ce78016abf",
  EXPORT_INSIGHTS: "workflow.exec/roverexporttopdfbackground66fa922e0d4d9",

  FILE_PREVIEW: "workflow.exec/roverv2filepreview6960c18d1c5ad",
  BEAT: "workflow.exec/roverv2beatworkflowforfiles6960d48b7e252",
  FILM_UPLOAD: "workflow.trigger/roverscriptdemo6a7ad4f143079",
  FILM_METADATA: "workflow.trigger/roverscriptdemodetails6a7b1a94831b3",
  FILM_SUMMARIZE: "workflow.trigger/roverscriptdemocontentsparent6a7ea1c86776c",
  SAVE_FILM_DASHBOARD: "workflow.trigger/6a809e65547065464e019593",
  GET_FILM_DASHBOARD: "workflow.trigger/6a80acced616afc2d905109d",

  JWT_TOKEN: "workflow.exec/roverv2getjwttoken692829d6ac4aa",
  SOCKET_TOKEN: "workflow.trigger/6a7eceb5f8dec4e8a9054b52",

  // This short code is passed to sys/api.v1 as args[workflow-code].
  LIVE_AGENT: "test876a720666dd91d",
} as const

export type WorkflowLink = (typeof WORKFLOW_LINKS)[keyof typeof WORKFLOW_LINKS]

export function workflowUrl(workflow: WorkflowLink): string {
  return `${APP_CONFIG.PUBLIC_API_URL}${workflow}`
}
