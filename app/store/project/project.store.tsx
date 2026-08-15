"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { ProjectStore } from "./project.type"

const DEFAULT_AI_AGENT_LIST = [
    { id: "6", title: "Film Intelligence Specialist", subtitle: "Specialist", icon: "General Research.png", selected: false },
];

export const useProjectStore = create<ProjectStore>()(
    persist(
        (set) => ({
            projects: [],
            selectedProject: [],
            AiAgentList: DEFAULT_AI_AGENT_LIST,
            currentUser: "",
            currentUserMailId: "",
            sahredUsers: {},
            hydrated: false,
            projectsStatus: "idle",
            projectsError: null,

            setProjects: (list) => set({ projects: list }),
            setSelectedProject: (list) => set({ selectedProject: list }),
            setSelectedAiAgent: (id: string) =>
                set((state) => ({
                    AiAgentList: state.AiAgentList.map((item) => ({
                        ...item,
                        selected: id === "" ? false : item.id === id,
                    }))
                })),
            // Clear all selections (used on rehydrate/refresh)
            clearSelectedAiAgents: () =>
                set((state) => ({
                    AiAgentList: state.AiAgentList.map((item) => ({ ...item, selected: false })),
                })),
            setCurrentUser: (user: string) => set({ currentUser: user }),
            setCurrentUserMailId: (email: string) => set({ currentUserMailId: email }),
            setSharedUsers: (list) => set({ sahredUsers: list }),
            setHydrated: () => set({ hydrated: true }),
            setProjectsStatus: (projectsStatus) => set({ projectsStatus }),
            setProjectsError: (projectsError) => set({ projectsError }),
        }),
        {
            name: "project-store",

            // Persist AiAgentList so agent selection survives page refresh
            partialize: (state) => ({
                projects: state.projects,
                selectedProject: state.selectedProject,
                currentUser: state.currentUser,
                currentUserMailId: state.currentUserMailId,
                sahredUsers: state.sahredUsers,
                AiAgentList: state.AiAgentList,
            }),

            onRehydrateStorage: () => (state) => {
                if (state && state.AiAgentList) {
                    const persistedSelection = state.AiAgentList.reduce((acc: any, item: any) => {
                        if (item.selected) acc[item.id] = true;
                        return acc;
                    }, {});

                    state.AiAgentList = DEFAULT_AI_AGENT_LIST.map(item => ({
                        ...item,
                        selected: !!persistedSelection[item.id]
                    }));
                }
                state?.setHydrated?.();   // mark store hydrated
            },
        }
    )
);
