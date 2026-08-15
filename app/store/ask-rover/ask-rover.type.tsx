import { InsightType, setAfterStreamingType } from "@/types/ask-rover-types";
import type { AsyncStatus } from "@/types/async-status";

export interface AskRoverStore {
    insightsList: InsightType[];
    afterStreaming: setAfterStreamingType | null;
    insightsStatus: AsyncStatus;
    insightsError: string | null;
    // hydrated: boolean;

    setInsightsList: (list: InsightType[]) => void;
    setAfterStreaming: (value: setAfterStreamingType) => void;
    setInsightsStatus: (status: AsyncStatus) => void;
    setInsightsError: (error: string | null) => void;
    // setHydrated: () => void;
}
