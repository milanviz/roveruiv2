"use client"
import { useRouter, usePathname } from "next/navigation";
import { useProjectStore } from "@/app/store/project/project.store";
import Image from "next/image"

const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX || "";

export default function ProjectSidebar() {
  const selectedProject = useProjectStore((state) => state.selectedProject);
  const router = useRouter()
  const pathname = usePathname();

  const isActive = (path: string) => pathname.startsWith(path);
  const projectId = selectedProject[0]?.ProjectID;

  return (
    <aside className="w-64 overflow-y-auto border-r border-common-border bg-background scrollbar-hide flex flex-col">
      <div className="h-full bg-[#191919] overflow-y-auto scrollbar-hide flex flex-col">
        <div className="px-5 pt-4">
          <p className="text-xs text-[#A9AAAA]">RESEARCH</p>
        </div>
        <div className="px-3 pt-4 h-[40px] flex-shrink-0 mb-4">
          <button className="w-full container-gradient text-white px-5 py-3 rounded-lg text-[15px] font-light hover:bg-primary/90 transition-colors flex items-center gap-2 cursor-pointer"
            onClick={() => router.push(`/projects/ask-rover?projectId=${projectId}`)}>
            <Image
              src={`${assetPrefix}/assets/icons/ai.svg`}
              alt="Ask Rover"
              width={16}
              height={16}
              className="block"
            />
            Ask Rover
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-6">
          <div>
            <div className={`flex items-center gap-3 px-2 py-2 rounded hover:bg-[#232323] transition-colors cursor-pointer
            ${
                  isActive("/projects/insights")
                    ? "bg-gradient-to-r from-[#E5E6FF] to-[#CFD1FF] text-black"
                    : "hover:bg-[#232323] text-white"
                }
              `}
              onClick={() => router.push(`/projects/insights?projectId=${projectId}`)}
              >
              <Image
                src={`${assetPrefix}/assets/images/Saved_Insights.png`}
                alt="Saved Insights"
                width={18}
                height={18}
                className="block"
              />
              <span className="text-sm flex-1">Saved Insights</span>
            </div>
          </div>
        </nav>
      </div>
    </aside>
  )
}
