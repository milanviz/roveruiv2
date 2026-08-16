"use client"

import { Image } from "@/lib/spa-router"
import type { ProjectType } from "@/types/project-types"
import { assetPath } from "@/lib/env"
import { ArchiveProjects, ShareProject } from "@/controllers/project-controller"
import { UniversalPopup } from "@/components/universal-popup"

const images = ["prject_default2.jpg", "prject_default3.jpg", "prject_default4.jpg"]

function projectImage(id: string) {
  let hash = 0
  for (let index = 0; index < id.length; index++) hash = ((hash << 5) - hash + id.charCodeAt(index)) | 0
  return images[Math.abs(hash) % images.length]
}

function summaryText(summary: string) {
  if (!summary) return "Open this project to continue your film research."
  return new DOMParser().parseFromString(summary, "text/html").body.textContent || ""
}

export function RoverProjectCard({ project, sharedUsers = [], compact = false, onOpen, onArchived }: { project: ProjectType; sharedUsers?: string[]; compact?: boolean; onOpen: () => void; onArchived?: () => void | Promise<void> }) {
  return (
    <article className={`group rover-surface relative flex overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_20px_50px_rgba(0,0,0,.4)] ${compact ? "min-h-48" : "min-h-56"}`}>
      <button type="button" onClick={onOpen} className="focus-ring absolute inset-0 z-0 cursor-pointer rounded-xl" aria-label={`Open ${project.ProjectName}`} />
      <div className="relative w-24 shrink-0 overflow-hidden sm:w-28">
        <Image src={assetPath(`images/${projectImage(project.ProjectID)}`)} alt="" fill className="object-cover opacity-70 transition duration-300 group-hover:scale-105 group-hover:opacity-85" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30" />
      </div>
      <div className="pointer-events-none flex min-w-0 flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-foreground">{project.ProjectName}</h3>
        <p className="mt-2 flex items-center gap-1 text-xs text-primary"><span aria-hidden="true">⚡</span><span className="line-clamp-1">{project.AIAgent}</span></p>
        <p className="mt-3 line-clamp-3 break-words text-xs leading-relaxed text-muted-foreground">{summaryText(project.Summary)}</p>
        <div className="pointer-events-auto relative z-10 mt-auto flex min-h-10 items-end justify-between border-t border-border pt-2">
          <div className="flex -space-x-2" aria-label={sharedUsers.length ? `Shared with ${sharedUsers.join(", ")}` : "Not shared"}>
            {sharedUsers.slice(0, 3).map((name, index) => <span key={`${name}-${index}`} title={name} className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary/15 text-[10px] font-semibold text-primary">{name.trim().charAt(0).toUpperCase()}</span>)}
          </div>
          <div className="flex gap-1">
            <UniversalPopup mode="email" title="Share Project" description="Enter an email address to share the project." trigger={<button type="button" aria-label={`Share ${project.ProjectName}`} className="focus-ring flex size-10 items-center justify-center rounded-full bg-white/5 hover:bg-white/10"><Image src={assetPath("icons/share.svg")} alt="" width={14} height={14} /></button>} onSend={(email) => ShareProject(project.ProjectID, "adduser", email)} />
            <UniversalPopup mode="delete" title="Archive Project?" description="This project will be removed from your active projects." trigger={<button type="button" aria-label={`Archive ${project.ProjectName}`} className="focus-ring flex size-10 items-center justify-center rounded-full bg-white/5 hover:bg-red-500/10"><Image src={assetPath("icons/archive.svg")} alt="" width={14} height={14} /></button>} onConfirm={async () => { await ArchiveProjects("Yes", "Archive", project.rowid ?? ""); await onArchived?.() }} />
          </div>
        </div>
      </div>
      <div className="underline-gradient" />
    </article>
  )
}
