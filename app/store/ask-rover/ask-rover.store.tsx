"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { AskRoverStore } from "./ask-rover.type"

export const useAskRoverStore = create<AskRoverStore>()(
    persist(
        (set) => ({
            insightsList: [],
            afterStreaming: null,
            // hydrated: false,   

            setInsightsList: (list) => set({ insightsList: list }),
            setAfterStreaming: (value) => set(() => ({ afterStreaming: value })),
            // setHydrated: () => set({ hydrated: true }),
        }),
        {
            name: "ask-rover-store",
            // onRehydrateStorage: () => (state) => {
            //     state?.setHydrated();   // mark store hydrated
            // },
        }
    )
);