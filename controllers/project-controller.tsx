import { APP_CONFIG } from "@/app/config/config";
import { useProjectStore } from "@/app/store/project/project.store";
import type { ProjectType } from "@/types/project-types";
import {
    cachedWorkflowRequest,
    invalidateWorkflowCache,
    WORKFLOW_CACHE_TTL,
} from "@/lib/workflow-cache";

type DatabaseRow = Record<string, unknown>;

const parseJson = (value: unknown): unknown => {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

/** Unwrap the response shapes commonly returned by Vizru workflow nodes. */
const workflowRows = (payload: unknown): DatabaseRow[] => {
    const parsed = parseJson(payload);
    if (Array.isArray(parsed)) {
        const direct = parsed.filter(
            (value): value is DatabaseRow => !!value && typeof value === "object" && !Array.isArray(value),
        );
        if (direct.some((row) => "user_id" in row || "project_id" in row)) return direct;
        for (const row of direct) {
            for (const key of ["output", "data", "projects", "result", "filter", "val"]) {
                if (key in row) {
                    const nested = workflowRows(row[key]);
                    if (nested.length) return nested;
                }
            }
        }
        return direct;
    }
    if (parsed && typeof parsed === "object") {
        const row = parsed as DatabaseRow;
        if ("user_id" in row || "project_id" in row) return [row];
        for (const key of ["output", "data", "projects", "result", "filter", "val"]) {
            if (key in row) {
                const nested = workflowRows(row[key]);
                if (nested.length) return nested;
            }
        }
        return [row];
    }
    return [];
};

const postFields = async (workflow: string, fields: Record<string, string | Blob>) => {
    const formData = new FormData();
    Object.entries(fields).forEach(([name, value]) => formData.append(name, value));
    const response = await fetch(APP_CONFIG.PUBLIC_API_URL + workflow, {
        method: "POST",
        body: formData,
    });
    const responseText = await response.text();
    if (!response.ok) throw new Error(`Workflow failed: ${response.status} ${responseText}`.trim());
    if (/internal server error/i.test(responseText)) {
        throw new Error(`Workflow ${workflow} returned Internal Server Error`);
    }
    try {
        return JSON.parse(responseText);
    } catch {
        throw new Error(`Workflow ${workflow} returned invalid JSON: ${responseText || "empty response"}`);
    }
};

const storedEmail = () =>
    typeof window === "undefined" ? "" : localStorage.getItem("rover_user_email")?.trim() || "";

const userCacheKey = (email: string) => `user:${email.toLowerCase()}`;
const projectsCacheKey = (email: string) => `projects:${email.toLowerCase()}`;

const getUserDetails = (email: string) =>
    cachedWorkflowRequest(userCacheKey(email), WORKFLOW_CACHE_TTL.USER, async () => {
        const payload = await postFields(APP_CONFIG.USER_DETAILS_WF, { user_email: email });
        const rows = workflowRows(payload);
        const user = rows.find((row) => String(row.user_email ?? "").toLowerCase() === email.toLowerCase())
            ?? rows[0];
        if (!user?.user_id) throw new Error(`No user metadata was returned for ${email}`);
        return user;
    });

const scalarString = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "data" in value) {
        return scalarString((value as DatabaseRow).data);
    }
    return value == null ? "" : String(value);
};

const toProject = (row: DatabaseRow): ProjectType => ({
    ProjectID: String(row.project_id ?? ""),
    ProjectName: String(row.project_name ?? "Untitled project"),
    Summary: String(row.summary ?? ""),
    AIAgent: String(row.ai_agent ?? "Film Intelligence Specialist"),
    CreatedBy: String(row.user_email ?? ""),
    CreatedOn: String(row.created_on ?? ""),
    rowid: String(row.project_id ?? ""),
    user_id: String(row.user_id ?? ""),
    user_email: String(row.user_email ?? ""),
    file_name: String(row.file_name ?? ""),
    file_full_url: scalarString(row.file_full_url),
});

export const GetProjectsController = async (force = false) => {
    const { setProjects, setCurrentUser, setCurrentUserMailId, setSharedUsers, setProjectsStatus, setProjectsError } = useProjectStore.getState();
    setProjectsStatus("loading");
    setProjectsError(null);
    try {
        const email = storedEmail();
        if (!email) throw new Error("Cannot load user details without an email address");

        // The user lookup explicitly accepts the database's user_email field.
        const user = await getUserDetails(email);
        const userId = String(user?.user_id ?? "");
        if (userId) localStorage.setItem("rover_user_id", userId);

        setCurrentUser(String(user?.user_name ?? email));
        setCurrentUserMailId(email);

        // Project lookup is scoped to the same signed-in email.
        const projects = await cachedWorkflowRequest(
            projectsCacheKey(email),
            WORKFLOW_CACHE_TTL.PROJECTS,
            async () => {
                const projectsPayload = await postFields(APP_CONFIG.PROJECT_LIST_WF, { user_email: email });
                return workflowRows(projectsPayload)
                    .filter((row) => row.project_id != null)
                    .map(toProject);
            },
            { force },
        );

        setProjects(projects);
        setSharedUsers({});
        setProjectsStatus("success");

    } catch (error) {
        console.error("Error fetching projects:", error);
        const message = error instanceof Error ? error.message : "Unable to load projects. Please try again.";
        setProjectsError(message);
        setProjectsStatus("error");
    }
};

export const ProjectCreateController = async (
    researchTopic: string,
    aiAgent: string,
    setDisable: (disabled: boolean) => void,
    router: any,
    setCreateLoader: (loading: boolean) => void,
    setResearchTopic: (topic: string) => void,
    scriptFile?: File | null,
) => {
    try {
        const email = storedEmail();
        if (!email) throw new Error("Cannot create a project without a user email");

        const user = await getUserDetails(email);
        const userId = String(user?.user_id ?? localStorage.getItem("rover_user_id") ?? "");
        if (!userId) throw new Error(`No user_id was returned for ${email}`);
        localStorage.setItem("rover_user_id", userId);

        let filmMeta: Record<string, any> | null = null;
        try {
            const temp = localStorage.getItem("temp_film_metadata");
            if (temp) filmMeta = JSON.parse(temp);
        } catch (error) {
            console.error("Failed to read film metadata:", error);
        }

        const projectId = typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `project-${Date.now()}`;
        const now = new Date().toISOString();
        const databaseProject = {
            user_id: userId,
            user_email: email,
            project_id: projectId,
            project_name: researchTopic,
            created_on: now,
            updated_on: now,
            file_name: String(filmMeta?.filename ?? ""),
            file_full_url: String(filmMeta?.fileFullUrl ?? filmMeta?.file_full_url ?? ""),
        };

        // Multipart field names become Vizru's `entry.*` values. The binary is
        // consumed by the workflow's file upload block, whose `data` output is
        // mapped to the spreadsheet's file_full_url column.
        const workflowEntry: Record<string, string | Blob> = {
            user_id: databaseProject.user_id,
            user_email: databaseProject.user_email,
            project_id: databaseProject.project_id,
            project_name: databaseProject.project_name,
            file_name: databaseProject.file_name,
        };
        if (scriptFile) workflowEntry.file = scriptFile;
        const createdPayload = await postFields(APP_CONFIG.CREATE_PROJECT_WF, workflowEntry);
        const returnedRow = workflowRows(createdPayload).find((row) => row.project_id != null);
        const projectData = [toProject(returnedRow ?? databaseProject)];
        // The specialist is UI metadata; database writes use only the supplied headers.
        projectData[0].AIAgent = aiAgent;

        if (projectData[0].ProjectID) {
            // Extract questions from the API response if available
            const questionsFromResponse = returnedRow?.questions;
            if (questionsFromResponse) {
                try {
                    const parsedQuestions = typeof questionsFromResponse === 'string'
                        ? JSON.parse(questionsFromResponse)
                        : questionsFromResponse;
                    projectData[0].questions = parsedQuestions;
                } catch (e) {
                    console.error("Error parsing questions from create project response:", e);
                }
            }

            // The create workflow returns extraction metadata, not the inserted
            // database row. Refresh once after this mutation so we receive the
            // authoritative file_full_url produced by its upload block.
            invalidateWorkflowCache(projectsCacheKey(email));
            await GetProjectsController(true);
            const persistedProject = useProjectStore.getState().projects.find(
                (project) => project.ProjectID === projectData[0].ProjectID,
            );
            if (persistedProject) {
                projectData[0] = { ...persistedProject, AIAgent: aiAgent };
            }
            // STORE PROJECT IN ZUSTAND GLOBAL STORE
            const setSelectedProject = useProjectStore.getState().setSelectedProject;
            const { setSelectedAiAgent } = useProjectStore.getState();
            setSelectedProject(projectData); // store in global store
            if (typeof window !== "undefined") {
              let filmMeta: Record<string, any> | null = null
              let filmAnalysis: unknown = null
              try {
                 const temp = localStorage.getItem("temp_film_metadata");
                if (temp) {
                  filmMeta = JSON.parse(temp)
                  localStorage.setItem(`film_metadata_${projectData[0].ProjectID}`, temp);
                  localStorage.removeItem("temp_film_metadata");
                }
                const tempAnalysis = localStorage.getItem("temp_film_analysis");
                if (tempAnalysis) {
                  filmAnalysis = JSON.parse(tempAnalysis)
                  localStorage.setItem(`film_analysis_${projectData[0].ProjectID}`, tempAnalysis);
                  localStorage.removeItem("temp_film_analysis");
                }
                const tempAgent = localStorage.getItem("temp_agent_metadata");
                if (tempAgent) {
                  localStorage.setItem(`agent_metadata_${projectData[0].ProjectID}`, tempAgent);
                  localStorage.removeItem("temp_agent_metadata");
                }
              } catch (e) {
                console.error("Failed to persist film metadata:", e);
              }

              const scriptId =
                filmMeta?.scriptId ||
                filmMeta?.script_id ||
                (typeof crypto !== "undefined" && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `script-${Date.now()}`)

              try {
                await fetch("/api/film-projects/", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    script_id: scriptId,
                    project_id: projectData[0].ProjectID,
                    title: projectData[0].ProjectName || filmMeta?.title || researchTopic,
                    filename: filmMeta?.filename ?? null,
                    language: filmMeta?.language ?? null,
                    genre: filmMeta?.genre ?? null,
                    target_market: filmMeta?.targetMarket ?? null,
                    release_strategy: filmMeta?.releaseStrategy ?? null,
                    expected_budget: filmMeta?.expectedBudget ?? null,
                    metadata: {
                      ...(filmMeta || {}),
                      scriptId,
                      projectId: projectData[0].ProjectID,
                    },
                    analysis: filmAnalysis,
                  }),
                })
              } catch (e) {
                console.error("Failed to save film project to SQLite:", e)
              }

              // Navigate by script_id so projects can be switched via URL
              router.push(`/projects/ask-rover?script_id=${encodeURIComponent(scriptId)}&projectId=${projectData[0].ProjectID}&generate=1`);
            } else {
              router.push(`/projects/ask-rover?projectId=${projectData[0].ProjectID}`);
            }
            setSelectedAiAgent("")
            // setCreateLoader(false);
            setResearchTopic("")
        } else {
            console.error("Project creation failed: Invalid ProjectID");
            setCreateLoader(false);
            setDisable(false);
        }
    } catch (error) {
        setCreateLoader(false);
        setDisable(false);
        console.error("Project Create Error:", error);
        throw error;
    }
};



export const ShareProject = async (projectId: string, Mode: string, Member: string) => {
    try {
        const data = { ProjectID: projectId, Mode, Member };
        const formData = new FormData();
        formData.append("data", JSON.stringify([data]));
        // formData.append("button", button);
        // formData.append("rowid", rowid);

        const res = await fetch(
            APP_CONFIG.PUBLIC_API_URL + APP_CONFIG.SHARE_PROJECT_WF,
            {
                method: "POST",
                body: formData,
            }
        );

        if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status}`);
        }

        const SharedResponse = await res.json();
        console.log("Shared Response:", SharedResponse);
        // Optionally, refresh project list or update UI here
    } catch (error) {
        console.error("Error sharing project:", error);
        throw error;
    }
}

export const ArchiveProjects = async (
    actionText: string,
    button: string,
    rowid: string,
) => {
    // try {
    const data = {
        actionText,
        button,
        rowid,
    };
    const formData = new FormData();
    formData.append("data", JSON.stringify([data]));
    // formData.append("button", button);
    // formData.append("rowid", rowid);

    const res = await fetch(
        APP_CONFIG.PUBLIC_API_URL + APP_CONFIG.ARCHIVE_PROJECT_WF,
        {
            method: "POST",
            body: formData,
        }
    );

    if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
    }

    const deleteResponse = await res.json();
    const email = storedEmail();
    if (email) invalidateWorkflowCache(projectsCacheKey(email));
    console.log("Delete Response:", deleteResponse);
    // Optionally, refresh project list or update UI here
    // } catch (error) {
    //     console.error("Error deleting project:", error);
    // }
}
