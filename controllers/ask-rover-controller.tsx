import { APP_CONFIG } from "@/app/config/config"
import { ProjectType } from "@/types/project-types";
import { useAskRoverStore } from "@/app/store/ask-rover/ask-rover.store";
import { useState } from "react";
import { getAuthFromStorage, refreshAuthToken } from "@/lib/auth";
import { setCurrentController, getCurrentController } from "@/app/utils/streamingController";

export const GetChatHistory = async (
    projectid: string,
    appendMessages: (chatHistory: any) => void,
): Promise<{ history: any[]; questions?: Record<string, string[]> }> => {
    const formData = new FormData();
    formData.append("data", JSON.stringify([{ projectid }]));

    try {
        const res = await fetch(
            APP_CONFIG.PUBLIC_API_URL + APP_CONFIG.CHAT_HISTORY_WF,
            {
                method: "POST",
                body: formData,
            }
        );

        if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status}`);
        }

        const chatHistory = await res.json();

        // Extract questions from the response if available (for Popular Research Topics)
        let questions: Record<string, string[]> | undefined;
        if (chatHistory[0]?.questions) {
            try {
                const questionsData = chatHistory[0].questions;
                questions = typeof questionsData === 'string'
                    ? JSON.parse(questionsData)
                    : questionsData;
            } catch (e) {
                console.error("Error parsing questions from chat history:", e);
            }
        }

        // FILTER OUT invalid questions
        const validHistory = chatHistory.filter(
            (h: any) => h?.Question && h.Question.trim().length > 0
        );

        // If no valid history, exit early but still return questions
        if (validHistory.length === 0) {
            console.log("No valid chat history.");
            return { history: [], questions };
        }

        // Format
        const formattedHistory = validHistory.map((h: any) => ({
            question: h.Question || "",
            answer: h.Answer || "",
            qid: h.QID || "",
            userlist: h.UpvotedJSON || "",
            count: h.UpVotedCount || "",
        }));

        // Oldest → Newest
        const orderedHistory = formattedHistory.slice().reverse();

        // Append ONLY if there's valid data
        appendMessages(orderedHistory);

        return { history: orderedHistory, questions };
    } catch (error) {
        console.error("Project Create Error:", error);
        return { history: [] };
    }
};

export const getMessageResponse = async (
    question: string,
    selectedVisibility: string,
    selectedProject: ProjectType,
    isTyping: boolean,
    setIsTyping: (value: boolean) => void,
    currentAnswerRef: React.RefObject<HTMLDivElement | null>,
    setTypingText: (value: string) => void,
    appendMessages: (
        updater: (prev: { question: string; answer: string; qid?: string; userlist?: string; count?: string }[])
            => { question: string; answer: string; qid?: string; userlist?: string; count?: string }[]
    ) => void,
    setPendingQuestion: (value: string) => void,
    setIsChatActive: (value: boolean) => void,
    setSendMessage: (value: boolean) => void,
    setReadyForSendMessage: (value: boolean) => void,
) => {
    const { setAfterStreaming } = useAskRoverStore.getState();

    // create and store controller
    const controller = new AbortController();
    setCurrentController(controller);

    // mark UI as active
    setSendMessage(true);
    setIsChatActive(true);

    // accumulator visible to catch block
    let accumulated = "";
    let lastRenderTime = 0;
    let streamingDone = false;

    try {
        const formData = new FormData();
        formData.append("question", question);
        formData.append("source", selectedVisibility.toLowerCase());
        formData.append("project_id", selectedProject ? selectedProject.ProjectID : "");
        formData.append("document_id", "67890");
        formData.append("user_id", localStorage.getItem("rover_user_email") || "");
        formData.append("workflow_url", APP_CONFIG.ORIGIN_URL + APP_CONFIG.AFTER_MESSAGE_RECEIVE_WF);

        const authData = getAuthFromStorage();
        formData.append("token", authData.token);
        formData.append("auth_url", `${APP_CONFIG.ORIGIN_URL}workflow.trigger/roverv2jwtvalidator692d234f021c1`);

        const url = APP_CONFIG.PUBLIC_CHAT_API_URL;

        let response = await fetch(url, {
            method: "POST",
            body: formData,
            signal: controller.signal,
        });

        // token refresh
        if (response.status === 401) {
            const newAuthData = await refreshAuthToken();
            if (newAuthData.token) {
                formData.set("token", newAuthData.token);
                response = await fetch(url, {
                    method: "POST",
                    body: formData,
                    signal: controller.signal,
                });
            } else {
                throw new Error("Session expired. Please refresh the page.");
            }
        }

        if (!response.ok || !response.body) {
            setIsChatActive(false);
            setReadyForSendMessage(false)
            throw new Error(`HTTP ${response.status}`);
        }

        // get reader
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let sseBuffer = "";

        while (true) {
            const { value, done } = await reader.read();

            if (done) break;

            const chunkText = decoder.decode(value, { stream: true });
            sseBuffer += chunkText;

            const parts = sseBuffer.split(/\r?\n\r?\n/);
            sseBuffer = parts.pop() || "";

            for (const part of parts) {
                const lines = part.split(/\r?\n/);
                let eventType = "message";
                const dataLines: string[] = [];

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    // Do not skip empty lines! They are structural newlines in the stream logic.

                    if (trimmedLine.startsWith("event:")) {
                        eventType = trimmedLine.slice(6).trim();
                    } else if (trimmedLine.startsWith("data:")) {
                        // SSE spec: after "data:", one optional space should be removed
                        // Use original line to preserve content spaces (for indentation)
                        const dataIndex = line.indexOf("data:");
                        const value = line.slice(dataIndex + 5);
                        dataLines.push(value.startsWith(" ") ? value.slice(1) : value);
                    } else {
                        dataLines.push("\n" + line);
                    }
                }

                const data = dataLines.join("\n");

                if (eventType === "message" || eventType === "") {
                    // Auto-scroll ONCE when the answer begins
                    if (!isTyping) {
                        setIsTyping(true);
                    }

                    accumulated += data;
                    setTypingText(accumulated);
                } else if (eventType === "done") {
                    streamingDone = true;
                    setIsTyping(false);
                    setTypingText("");

                    try {
                        const parsed = JSON.parse(data);
                        setAfterStreaming(parsed);

                        appendMessages((prev) => {
                            // replace last placeholder if exists, otherwise push
                            const next = [...prev];
                            if (next.length > 0) {
                                next[next.length - 1] = {
                                    question,
                                    answer: parsed.answer || accumulated,
                                    qid: parsed.qid || "",
                                    userlist: parsed.userlist || "",
                                    count: parsed.count || "",
                                };
                                return next;
                            }
                            return [
                                ...next,
                                {
                                    question,
                                    answer: parsed.answer || accumulated,
                                    qid: parsed.qid || "",
                                    userlist: parsed.userlist || "",
                                    count: parsed.count || "",
                                },
                            ];
                        });
                    } catch {
                        appendMessages((prev) => {
                            const next = [...prev];
                            if (next.length > 0) {
                                next[next.length - 1] = {
                                    question,
                                    answer: accumulated,
                                    qid: "",
                                    userlist: "",
                                    count: "",
                                };
                                return next;
                            }
                            return [
                                ...next,
                                { question, answer: accumulated, qid: "", userlist: "", count: "" },
                            ];
                        });
                    }

                    setPendingQuestion("");
                    setSendMessage(false);
                }
            }
        }
    } catch (err: any) {
        // manual abort
        if (err.name === "AbortError") {
            console.log("Stream aborted by user");

            setIsTyping(false);
            setTypingText(""); // clear typing box (we save partial to messages below)

            // Save the partial streamed answer (replace last placeholder if exists)
            appendMessages((prev) => {
                const next = [...prev];
                if (next.length > 0) {
                    next[next.length - 1] = {
                        question,
                        answer: accumulated,
                        qid: "",
                        userlist: "",
                        count: "",
                    };
                } else {
                    next.push({
                        question,
                        answer: accumulated,
                        qid: "",
                        userlist: "",
                        count: "",
                    });
                }
                return next;
            });

            setPendingQuestion("");
            setSendMessage(false);
            return;
        }

        console.error("Stream error:", err);

        let msg = "[error receiving stream]";
        if (err.message?.includes("Session expired")) msg = err.message;

        setTypingText(msg);
        setIsTyping(false);
    } finally {
        setIsChatActive(false);
        setReadyForSendMessage(false)
        setCurrentController(null);
    }
};



export const stopStreaming = (setSendMessage: (value: boolean) => void) => {
    const controller = getCurrentController();
    if (controller) {
        controller.abort();   //instantly stops fetch + reader
        setCurrentController(null);
        setSendMessage(false);
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
            APP_CONFIG.PUBLIC_API_URL + APP_CONFIG.ADD_TO_INSIGHTS_WF,
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
) => {
    const { setInsightsList } = useAskRoverStore.getState();
    const getInstancesData = {
        projectid
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify([getInstancesData]));

    try {
        const res = await fetch(
            APP_CONFIG.PUBLIC_API_URL + APP_CONFIG.GET_INSIGHTS_WF,
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
    } catch (error) {
        // setDisable(false);
        console.error("Project Create Error:", error);
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
            APP_CONFIG.PUBLIC_API_URL + APP_CONFIG.ARCHIVE_INSIGHT_WF,
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
            APP_CONFIG.PUBLIC_API_URL + APP_CONFIG.EXPORT_INSIGHTS_WF,
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
            APP_CONFIG.PUBLIC_API_URL + APP_CONFIG.TRANSLATE_WF,
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