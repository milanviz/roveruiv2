import type React from "react"
import { AlertCircle, Inbox, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("rover-skeleton rounded-lg", className)} {...props} />
}

export function CardGridSkeleton({ count = 6, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <div role="status" aria-label="Loading projects" className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={cn("rover-surface flex overflow-hidden", compact ? "h-48" : "h-56")}>
          <Skeleton className="h-full w-24 shrink-0 rounded-none" />
          <div className="flex flex-1 flex-col gap-3 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-2 h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="mt-auto h-8 w-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-gradient text-2xl font-medium sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  )
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="flex items-center gap-4"><h2 className="shrink-0 text-sm font-medium uppercase tracking-wider text-foreground">{title}</h2><div className="h-px flex-1 bg-border" />{action}</div>
}

export function PageState({ kind = "empty", title, description, onRetry, className }: { kind?: "empty" | "error"; title: string; description?: string; onRetry?: () => void; className?: string }) {
  const Icon = kind === "error" ? AlertCircle : Inbox
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cn("rover-surface flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <span className={cn("mb-4 flex size-11 items-center justify-center rounded-xl", kind === "error" ? "bg-red-500/10 text-red-300" : "bg-primary/10 text-primary")}><Icon size={21} /></span>
      <h2 className="text-base font-medium text-foreground">{title}</h2>
      {description && <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>}
      {onRetry && <Button type="button" variant="outline" className="mt-5" onClick={onRetry}><RefreshCw /> Retry</Button>}
    </div>
  )
}
