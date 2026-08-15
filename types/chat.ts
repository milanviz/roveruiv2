export type ChatTurnStatus = "pending" | "streaming" | "complete" | "cancelled" | "error"

export type ChatTurn = {
  id: string
  role: "user" | "assistant"
  status: ChatTurnStatus
  content: string
  questionId: string
  qid?: string
  userlist?: string
  count?: string
  source?: string
  sourceDocuments?: unknown[]
  translated?: { text: string; code: string }
  saved?: boolean
  error?: string
}
