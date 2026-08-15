import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ArrowDown, Bookmark, Check, Copy, Languages, Mic, RotateCcw, Send, Square, X } from "lucide-react"
import MarkdownRenderer from "./markdownrenderer"
import type { ChatTurn } from "@/types/chat"

type SourceOption = { label: string; value: string }

type Props = {
  projectName: string
  turns: ChatTurn[]
  loading: boolean
  historyError: string | null
  active: boolean
  source: string
  onSourceChange: (source: string) => void
  onSend: (question: string) => void
  onStop: () => void
  onRetryHistory: () => void
  onSave: (turn: ChatTurn) => void
  onTranslate: (turn: ChatTurn) => void
  onRegenerate: (turn: ChatTurn) => void
}

const sources: SourceOption[] = [
  { label: "Public", value: "Public" },
  { label: "Documents", value: "Documents" },
  { label: "Insights", value: "Insights" },
]

const examples = [
  "Summarize the most important opportunities in this project.",
  "What assumptions should I validate next?",
  "Turn the current research into an action plan.",
]

export default function ChatWorkspace({
  projectName, turns, loading, historyError, active, source, onSourceChange, onSend,
  onStop, onRetryHistory, onSave, onTranslate, onRegenerate,
}: Props) {
  const [input, setInput] = useState("")
  const [sourceOpen, setSourceOpen] = useState(false)
  const [ambientOpen, setAmbientOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showLatest, setShowLatest] = useState(false)
  const [updates, setUpdates] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const nearBottomRef = useRef(true)
  const previousContentRef = useRef("")

  const latestAssistant = [...turns].reverse().find((turn) => turn.role === "assistant")
  const statusText = active
    ? latestAssistant?.content ? "Rover is responding" : "Rover is thinking"
    : latestAssistant?.status === "cancelled" ? "Response stopped"
    : latestAssistant?.status === "error" ? "Response interrupted"
    : ""

  useLayoutEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = "0px"
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
  }, [input])

  useEffect(() => {
    const content = latestAssistant?.content || ""
    if (content === previousContentRef.current) return
    previousContentRef.current = content
    if (nearBottomRef.current) {
      endRef.current?.scrollIntoView({ block: "end" })
    } else if (active) {
      setShowLatest(true)
      setUpdates((value) => value + 1)
    }
  }, [latestAssistant?.content, active])

  useEffect(() => {
    if (!loading && turns.length) requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "end" }))
  }, [loading, projectName])

  useEffect(() => {
    if (!ambientOpen && !sourceOpen) return
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setAmbientOpen(false); setSourceOpen(false) }
    }
    document.addEventListener("keydown", close)
    return () => document.removeEventListener("keydown", close)
  }, [ambientOpen, sourceOpen])

  const submit = (value = input) => {
    const question = value.trim()
    if (!question || active) return
    setInput("")
    onSend(question)
    nearBottomRef.current = true
    setShowLatest(false)
  }

  const copy = async (turn: ChatTurn) => {
    await navigator.clipboard.writeText(turn.translated?.text || turn.content)
    setCopiedId(turn.id)
    window.setTimeout(() => setCopiedId(null), 1800)
  }

  const jumpToLatest = () => {
    nearBottomRef.current = true
    setShowLatest(false)
    setUpdates(0)
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }

  return (
    <section className="relative flex min-h-0 flex-1 flex-col" aria-label={`Ask Rover for ${projectName}`}>
      <p className="sr-only" role="status" aria-live="polite">{statusText}</p>
      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current
          if (!el) return
          const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
          nearBottomRef.current = nearBottom
          if (nearBottom) { setShowLatest(false); setUpdates(0) }
          else setShowLatest(true)
        }}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-custom"
        aria-busy={loading || active}
      >
        <div className="mx-auto w-full max-w-3xl px-4 pb-48 pt-4 sm:px-6">
          {loading ? (
            <div className="space-y-8" aria-label="Loading conversation">
              <div className="ml-auto h-12 w-2/3 rounded-2xl rover-skeleton" />
              <div className="space-y-3"><div className="h-4 w-4/5 rounded rover-skeleton" /><div className="h-4 w-full rounded rover-skeleton" /><div className="h-4 w-3/5 rounded rover-skeleton" /></div>
              <div className="ml-auto h-10 w-1/2 rounded-2xl rover-skeleton" />
            </div>
          ) : historyError ? (
            <div className="rover-surface mx-auto mt-12 max-w-md p-6 text-center">
              <h2 className="text-base font-medium">Conversation unavailable</h2>
              <p className="mt-2 text-sm text-muted-foreground">{historyError}</p>
              <button onClick={onRetryHistory} className="focus-ring mt-5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black">Try again</button>
            </div>
          ) : turns.length === 0 ? (
            <div className="mx-auto mt-[min(9vh,72px)] max-w-2xl text-center">
              <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-xl border border-[#8d83ff]/30 bg-[#8d83ff]/10 text-[#a9a2ff]">✦</div>
              <h2 className="text-xl font-medium tracking-tight sm:text-2xl">What would you like to explore?</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Ask Rover about your research, documents, insights, or the wider public web.</p>
              <div className="mt-7 grid gap-2 text-left sm:grid-cols-3">
                {examples.map((example) => <button key={example} onClick={() => submit(example)} className="focus-ring rounded-xl border border-white/10 bg-black/20 p-3 text-left text-xs leading-5 text-[#c7c7cf] transition hover:border-[#8d83ff]/35 hover:bg-white/[.05]">{example}</button>)}
              </div>
            </div>
          ) : (
            <div className="space-y-7">
              {turns.map((turn) => turn.role === "user" ? (
                <article key={turn.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md border border-white/10 bg-[#25232e]/90 px-4 py-2.5 text-sm leading-6 text-[#f0eff5] sm:max-w-[72%]">{turn.content}</div>
                </article>
              ) : (
                <article key={turn.id} className="min-w-0" aria-label="Rover response">
                  {turn.content ? <div className="min-w-0 text-sm leading-7 text-[#d9d9df]"><MarkdownRenderer content={turn.translated?.text || turn.content} /></div> : (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><span className="flex gap-1" aria-hidden="true"><i className="size-1.5 animate-pulse rounded-full bg-[#a59cff]" /><i className="size-1.5 animate-pulse rounded-full bg-[#a59cff] [animation-delay:150ms]" /><i className="size-1.5 animate-pulse rounded-full bg-[#a59cff] [animation-delay:300ms]" /></span>Thinking…</div>
                  )}
                  {turn.status === "cancelled" && <p className="mt-3 text-xs text-amber-300/80">Response stopped</p>}
                  {turn.status === "error" && <div className="mt-4 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200"><p>{turn.error || "The response was interrupted."}</p><button onClick={() => onRegenerate(turn)} className="focus-ring mt-2 inline-flex items-center gap-1.5 font-medium text-white"><RotateCcw size={13} /> Retry</button></div>}
                  {(turn.status === "complete" || turn.status === "cancelled" || turn.status === "error") && turn.content && (
                    <div className="mt-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <Action onClick={() => onSave(turn)} label={turn.saved ? "Unsave" : "Save"} icon={<Bookmark size={14} className={turn.saved ? "fill-current" : ""} />} />
                      <Action onClick={() => onTranslate(turn)} label={turn.translated ? "Original" : "Translate"} icon={<Languages size={14} />} />
                      <Action onClick={() => copy(turn)} label={copiedId === turn.id ? "Copied" : "Copy"} icon={copiedId === turn.id ? <Check size={14} /> : <Copy size={14} />} />
                      <Action onClick={() => onRegenerate(turn)} label="Regenerate" icon={<RotateCcw size={14} />} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {showLatest && <button onClick={jumpToLatest} className="focus-ring absolute bottom-36 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#1a1920]/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl"><ArrowDown size={14} /> Latest {updates > 0 && <span className="rounded-full bg-[#776af2] px-1.5 py-0.5 text-[10px] text-white">{updates}</span>}</button>}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#080910] via-[#080910]/90 to-transparent px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-12 sm:px-6">
        <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#17171d]/95 p-2 shadow-[0_18px_60px_rgba(0,0,0,.45)] backdrop-blur-xl">
          <textarea ref={textareaRef} rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit() } }} disabled={active || loading || Boolean(historyError)} placeholder="Message Rover…" className="block max-h-40 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-[#6d6d75] disabled:opacity-60" aria-label="Message Rover" />
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="relative min-w-0">
              <button onClick={() => setSourceOpen((open) => !open)} aria-expanded={sourceOpen} className="focus-ring flex h-9 max-w-[150px] items-center gap-2 truncate rounded-lg px-2.5 text-xs text-[#b7b7bf] hover:bg-white/[.06]"><span className="size-1.5 shrink-0 rounded-full bg-[#8f85ff]" /> {source}</button>
              {sourceOpen && <div className="absolute bottom-11 left-0 w-40 rounded-xl border border-white/10 bg-[#1c1b22] p-1.5 shadow-2xl" role="menu">{sources.map((option) => <button key={option.value} role="menuitem" onClick={() => { onSourceChange(option.value); setSourceOpen(false) }} className="focus-ring flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-white/[.06]">{option.label}{source === option.value && <Check size={13} />}</button>)}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button onClick={() => setAmbientOpen(true)} className="focus-ring flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/[.06] hover:text-white" aria-label="Ambient Listen"><Mic size={17} /></button>
              <button onClick={active ? onStop : () => submit()} disabled={!active && !input.trim()} className="focus-ring flex size-9 items-center justify-center rounded-lg bg-white text-black transition disabled:cursor-not-allowed disabled:opacity-35" aria-label={active ? "Stop response" : "Send message"}>{active ? <Square size={14} fill="currentColor" /> : <Send size={16} />}</button>
            </div>
          </div>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-[#686871]">Rover can make mistakes. Check important information.</p>
      </div>

      {ambientOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Ambient listening"><div className="relative flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/10 bg-[#121218] p-9 text-center shadow-2xl"><button onClick={() => setAmbientOpen(false)} className="focus-ring absolute right-3 top-3 flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10" aria-label="Close ambient listening"><X size={18} /></button><div className="mb-6 flex size-24 items-center justify-center rounded-full bg-[#776af2]/15 ring-1 ring-[#9b93ff]/30"><Mic size={34} className="text-[#aaa3ff]" /></div><h2 className="text-lg font-medium">Listening…</h2><p className="mt-2 text-sm text-muted-foreground">Go ahead, I’m listening.</p></div></div>}
    </section>
  )
}

function Action({ onClick, label, icon }: { onClick: () => void; label: string; icon: React.ReactNode }) {
  return <button onClick={onClick} className="focus-ring flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-white/[.06] hover:text-white">{icon}{label}</button>
}
