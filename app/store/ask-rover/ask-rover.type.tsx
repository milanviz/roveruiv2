import { InsightType, setAfterStreamingType } from "@/types/ask-rover-types";

export interface AskRoverStore {
    insightsList: InsightType[];
    afterStreaming: setAfterStreamingType | null;
    // hydrated: boolean;

    setInsightsList: (list: InsightType[]) => void;
    setAfterStreaming: (value: setAfterStreamingType) => void;
    // setHydrated: () => void;
}