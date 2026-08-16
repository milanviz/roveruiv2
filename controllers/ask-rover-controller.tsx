import { WORKFLOW_LINKS, workflowUrl } from "@/lib/workflow-links"
import { ProjectType } from "@/types/project-types";
import { useAskRoverStore } from "@/app/store/ask-rover/ask-rover.store";
import { setCurrentController, getCurrentController } from "@/app/utils/streamingController";
import { onVizruEvent, waitForVizruSocketConnection } from "@/lib/vizru-socket";
import { toast } from "sonner";
import { useProjectStore } from "@/app/store/project/project.store";

const parseWorkflowJson = (value: unknown): unknown => {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

const historyRows = (payload: unknown): Record<string, any>[] => {
    const parsed = parseWorkflowJson(payload);
    if (Array.isArray(parsed)) {
        const records = parsed.filter(
            (item): item is Record<string, any> => !!item && typeof item === "object" && !Array.isArray(item),
        );
        if (records.some((row) => "Question" in row || "user_message" in row)) return records;
        for (const item of parsed) {
            const nested = historyRows(item);
            if (nested.length) return nested;
        }
        return [];
    }
    if (!parsed || typeof parsed !== "object") return [];
    const record = parsed as Record<string, any>;
    if ("Question" in record || "user_message" in record) return [record];
    for (const key of ["output", "data", "result", "history", "conversations", "messages", "filter", "val"]) {
        if (key in record) {
            const nested = historyRows(record[key]);
            if (nested.length) return nested;
        }
    }
    return [];
};

const historyQuestions = (payload: unknown): Record<string, string[]> | undefined => {
    const parsed = parseWorkflowJson(payload);
    if (Array.isArray(parsed)) {
        for (const item of parsed) {
            const questions = historyQuestions(item);
            if (questions) return questions;
        }
        return undefined;
    }
    if (!parsed || typeof parsed !== "object") return undefined;
    const record = parsed as Record<string, any>;
    if (record.questions) {
        const questions = parseWorkflowJson(record.questions);
        if (questions && typeof questions === "object" && !Array.isArray(questions)) {
            return questions as Record<string, string[]>;
        }
    }
    for (const key of ["output", "data", "result", "history", "filter", "val"]) {
        if (key in record) {
            const questions = historyQuestions(record[key]);
            if (questions) return questions;
        }
    }
    return undefined;
};

const insertConversationMessage = async ({
    userMessage,
    aiMessage,
    userId,
    projectId,
}: {
    userMessage: string;
    aiMessage: string;
    userId: string;
    projectId: string;
}) => {
    if (!userId || !projectId) {
        throw new Error("Cannot save this conversation without a user_id and project_id.");
    }

    const response = await fetch(
        workflowUrl(WORKFLOW_LINKS.AFTER_MESSAGE_RECEIVE),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_message: userMessage,
                ai_message: aiMessage,
                user_id: userId,
                project_id: projectId,
            }),
        },
    );
    const responseText = await response.text();
    if (!response.ok || /internal server error/i.test(responseText)) {
        throw new Error(`Failed to save conversation: ${response.status} ${responseText}`.trim());
    }
};

export const GetChatHistory = async (
    projectid: string,
    appendMessages: (chatHistory: any) => void,
): Promise<{ history: any[]; questions?: Record<string, string[]> }> => {
    const formData = new FormData();
    formData.append("data", JSON.stringify([{ projectid }]));

    try {
        const res = await fetch(
            workflowUrl(WORKFLOW_LINKS.CHAT_HISTORY),
            {
                method: "POST",
                body: formData,
            }
        );

        if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status}`);
        }

        const historyPayload = await res.json();
        const chatHistory = historyRows(historyPayload);

        // Extract questions from the response if available (for Popular Research Topics)
        const questions = historyQuestions(historyPayload);

        // FILTER OUT invalid questions
        const validHistory = chatHistory.filter((h: any) => {
            const question = h?.Question ?? h?.user_message;
            return typeof question === "string" && question.trim().length > 0;
        });

        // If no valid history, exit early but still return questions
        if (validHistory.length === 0) {
            console.log("No valid chat history.");
            return { history: [], questions };
        }

        // Format
        const formattedHistory = validHistory.map((h: any) => ({
            question: h.Question ?? h.user_message ?? "",
            answer: h.Answer ?? h.ai_message ?? "",
            qid: h.QID ?? h.qid ?? "",
            userlist: h.UpvotedJSON ?? h.userlist ?? "",
            count: h.UpVotedCount ?? h.count ?? "",
        }));

        // Oldest → Newest
        const orderedHistory = formattedHistory.slice().reverse();

        // Append ONLY if there's valid data
        appendMessages(orderedHistory);

        return { history: orderedHistory, questions };
    } catch (error) {
        console.error("Chat history error:", error);
        throw error;
    }
};

export const getMessageResponse = async (
    question: string,
    selectedVisibility: string,
    selectedProject: ProjectType,
    callbacks: {
        onStart: () => void;
        onChunk: (content: string) => void;
        onComplete: (content: string) => void;
        onCancel: (content: string) => void;
        onError: (error: string, partial: string) => void;
    },
) => {
    const { setAfterStreaming } = useAskRoverStore.getState();
    const projectId = selectedProject?.ProjectID || "";
    const currentProject = useProjectStore.getState().projects.find(
        (project) => project.ProjectID === projectId,
    );
    const userId = selectedProject?.user_id
        || currentProject?.user_id
        || localStorage.getItem("rover_user_id")
        || "";

    // create and store controller
    const controller = new AbortController();
    setCurrentController(controller);

    callbacks.onStart();

    // accumulator visible to catch block
    let accumulated = "";
    let streamingDone = false;
    let activeWorkflowLogId: string | number | null = null;
    let unsubscribe = () => {};

    try {
        // The workflow publishes chunks on the empty Socket Event Tag. Lock to
        // the first workflow log seen after this request starts so a later
        // agent stream cannot get mixed into the current answer.
        let resolveStreamDone = () => {};
        const streamDone = new Promise<void>((resolve) => {
            resolveStreamDone = resolve;
        });

        unsubscribe = onVizruEvent("", (payload: any) => {
            if (controller.signal.aborted || payload?.type !== "agent_stream") return;

            const logId = payload.workflow_log_id ?? null;
            if (activeWorkflowLogId === null && payload.status === "streaming") {
                activeWorkflowLogId = logId;
            }
            if (activeWorkflowLogId !== null && logId !== activeWorkflowLogId) return;

            if (payload.status === "streaming") {
                accumulated += typeof payload.Body === "string" ? payload.Body : "";
                callbacks.onChunk(accumulated);
            } else if (payload.status === "complete") {
                streamingDone = true;
                resolveStreamDone();
            }
        });

        // AuthProvider normally owns this connection. Calling it here is
        // idempotent and also covers a chat opened before provider setup ends.
        const socketReady = await waitForVizruSocketConnection();
        if (!socketReady) {
            console.warn("[ask-rover] realtime socket unavailable; using the workflow response");
        }

        const response = await fetch(
            workflowUrl(WORKFLOW_LINKS.ASK_ROVER_CHAT),
            {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: userId,
                project_id: projectId,
                prompt: question,
            }),
            signal: controller.signal,
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        const row = Array.isArray(result) ? result[0] : result;

        // Normally the complete socket event arrives just before the HTTP
        // trigger resolves. Allow a short grace period for reordered delivery.
        if (!streamingDone && activeWorkflowLogId !== null) {
            await Promise.race([
                streamDone,
                new Promise<void>((resolve) => window.setTimeout(resolve, 2000)),
            ]);
        }

        const answer = accumulated || (typeof row?.response === "string" ? row.response : "");
        if (!answer) throw new Error("The workflow returned an empty response.");

        setAfterStreaming({
            question,
            answer,
            project_id: projectId,
            document_id: "",
            user_id: userId,
            qid: "",
            source: selectedVisibility.toLowerCase(),
            source_documents: [],
        });

        callbacks.onComplete(answer);
        try {
            await insertConversationMessage({
                userMessage: question,
                aiMessage: answer,
                userId,
                projectId,
            });
        } catch (saveError) {
            console.error("Conversation persistence error:", saveError);
            toast.error("Response received but not saved", {
                description: "Rover could not add this exchange to conversation history.",
            });
        }
    } catch (err: any) {
        // manual abort
        if (err.name === "AbortError") {
            console.log("Stream aborted by user");

            callbacks.onCancel(accumulated);
            return;
        }

        console.error("Stream error:", err);

        let msg = "The answer stream failed. Send the question again to retry.";
        if (err instanceof Error && err.message) msg = `${err.message}. Send the question again to retry.`;

        callbacks.onError(msg, accumulated);
        toast.error("Rover’s response was interrupted", { description: "Your partial answer was preserved. You can send the question again." });
    } finally {
        unsubscribe();
        setCurrentController(null);
    }
};



export const stopStreaming = () => {
    const controller = getCurrentController();
    if (controller) {
        controller.abort();   //instantly stops fetch + reader
        setCurrentController(null);
    }
};

export const SaveToinsights = async (
    qid: string,
    userlist: string,
    count: string,
    isSaved: boolean,
) => {
    const data = {
        type: isSaved ? "1" : "0",
        qid,
        userlist,
        count
    }
    try {
        const formData = new FormData();
        formData.append("data", JSON.stringify([data]));

        const res = await fetch(
            workflowUrl(WORKFLOW_LINKS.ADD_TO_INSIGHTS),
            {
                method: "POST",
                body: formData,
            }
        );
        if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status}`);
        }

        const result = await res.json();
        // onSuccess();
    } catch (error) {
        console.error("Delete Project Error:", error);
        // onError(error);
    }
}

export const GetInsights = async (
    projectid: string,
    force = false,
) => {
    void force;
    const { setInsightsList, setInsightsStatus, setInsightsError } = useAskRoverStore.getState();
    setInsightsStatus("loading");
    setInsightsError(null);
    const getInstancesData = {
        projectid
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify([getInstancesData]));

    try {
        const res = await fetch(
            workflowUrl(WORKFLOW_LINKS.GET_INSIGHTS),
            {
                method: "POST",
                body: formData,
            }
        );

        if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status}`);
        }
        const insights = await res.json();
        setInsightsList(insights);
        setInsightsStatus("success");
    } catch (error) {
        console.error("Project Create Error:", error);
        setInsightsError(error instanceof Error ? error.message : "Unable to load saved insights.");
        setInsightsStatus("error");
    }
}

export const ArchiveInsights = async (
    button: string,
    qid: string,
    dna_filter_key: string,
    dna_filter_val: string,
    app_filter: string,
) => {


    // const setProjects = useProjectStore.getState().setProjects
    const data = {
        button,
        qid,
        dna_filter_key,
        dna_filter_val,
        app_filter,
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify([data]));

    try {
        const res = await fetch(
            workflowUrl(WORKFLOW_LINKS.ARCHIVE_INSIGHT),
            {
                method: "POST",
                body: formData,
            }
        );

        if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status}`);
        }
        const projects = await res.json();
        GetInsights(dna_filter_val);
    } catch (error) {
        console.error("Project Create Error:", error);
    }
}

export const ExportInsight = async (
    projectid: string,
) => {
    const data = {
        projectid,
    };
    const formData = new FormData();
    formData.append("data", JSON.stringify([data]));

    try {
        const res = await fetch(
            workflowUrl(WORKFLOW_LINKS.EXPORT_INSIGHTS),
            {
                method: "POST",
                body: formData,
            }
        );

        if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status}`);
        }
        const result = await res.json();
        // onSuccess();
    } catch (error) {
        console.error("Export Insights Error:", error);
        // onError(error);
    }
}

export const translateAnswer = async (
    answer: string,
    onSuccess: (translatedText: string, languageCode: string) => void,
    onError: (error: string) => void,
) => {
    const data = {
        input: answer,
    };
    const formData = new FormData();
    formData.append("data", JSON.stringify([{
        input: answer,
    }]));
    console.log("translateAnswer called with answer:", answer);
    try {
        const res = await fetch(
            workflowUrl(WORKFLOW_LINKS.TRANSLATE),
            {
                method: "POST",
                body: formData,
            }
        );

        if (!res.ok) {
            throw new Error(`Failed to translate: ${res.status}`);
        }

        const result = await res.json();
        const { ConvertedData, LanguageCode } = result[0];

        if (ConvertedData && LanguageCode) {
            onSuccess(ConvertedData, LanguageCode);
        } else {
            throw new Error("Invalid translation response");
        }
    } catch (error) {
        console.error("Translation Error:", error);
        onError(error instanceof Error ? error.message : "Translation failed");
    }
};
