"use client";

import React, { useEffect, useRef } from "react";

interface ProjectDropdownProps {
  open: boolean;
  onClose: () => void;
  onNewProject: () => void;
  anchorId: string;
}

const demoProjects = [
  "ஆண் பாவம்",
  "Aan Paavam",
  "Black Sheep Production",
];

export default function ProjectDropdown({
  open,
  onClose,
  onNewProject,
  anchorId,
}: ProjectDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, onClose]);

  if (!open) return null;

  const anchor = typeof window !== "undefined" ? document.getElementById(anchorId) : null;
  const rect = anchor?.getBoundingClientRect();
  const top = rect ? rect.bottom + window.scrollY + 8 : 80;
  const left = rect ? rect.left + window.scrollX : 24;

  return (
    <div
      ref={ref}
      style={{ top, left }}
      className="absolute z-40 w-[380px] card"
    >
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="text-sm text-zinc-300">All Projects</div>
        <button
          onClick={onNewProject}
          className="px-3 py-1.5 rounded-xl bg-brand.purple hover:bg-violet-600 text-sm"
        >
          New Project
        </button>
      </div>

      <div className="p-4 space-y-3">
        <input
          placeholder="Search here..."
          className="w-full rounded-xl bg-zinc-800/70 border border-white/10 px-3 py-2 outline-none"
        />
        <div className="space-y-2 max-h-64 overflow-auto pr-1">
          {demoProjects.map((p, i) => (
            <button
              key={i}
              className="w-full text-left rounded-xl px-3 py-2 bg-zinc-900/60 hover:bg-zinc-900 border border-white/10"
              onClick={() => onClose()}
            >
              <div className="text-sm">{p}</div>
              <div className="text-[11px] text-zinc-400">
                Health & Treatments
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-2 pt-2">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              className={`h-8 w-8 rounded-lg border border-white/10 ${n === 2 ? "bg-zinc-800" : "bg-transparent"
                }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
