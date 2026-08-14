// app/projects/_components/ProjectCard.tsx
"use client";

import Link from "next/link";
import type { Project } from "../_data/projects";
import { motion } from "framer-motion";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.18 }}
    >
      <Link
        href={{
          pathname: "/projects/ask-rover",
          query: { projectId: project.id },
        }}
        className="group flex flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/5 shadow-[0_18px_40px_rgba(0,0,0,0.85)] hover:border-white/15 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,0.9)] transition-all"
      >
        {/* Thumbnail area – you can swap this to an actual <Image /> */}
        <div className="h-40 w-full bg-[#121623] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-fuchsia-500/10 via-teal-400/5 to-transparent" />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {project.tag}
            </span>
            <span>{project.date}</span>
          </div>

          <h3 className="text-sm font-semibold leading-snug text-slate-50 line-clamp-2 group-hover:text-white">
            {project.title}
          </h3>

          <p className="mt-1 text-xs text-slate-400 line-clamp-2">
            {project.description}
          </p>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex -space-x-1">
              <span className="h-6 w-6 rounded-full border border-[#020308] bg-slate-600/40" />
              <span className="h-6 w-6 rounded-full border border-[#020308] bg-slate-500/40" />
              <span className="h-6 w-6 rounded-full border border-[#020308] bg-slate-400/40" />
            </div>
            <div className="flex items-center gap-3 opacity-70 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                className="rounded-full p-1.5 hover:bg-white/10"
                aria-label="Share"
              >
                ↗
              </button>
              <button
                type="button"
                className="rounded-full p-1.5 hover:bg-white/10"
                aria-label="Download"
              >
                ⬇
              </button>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
