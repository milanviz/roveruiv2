import { APP_CONFIG } from "@/app/config/config";
import { useProjectStore } from "@/app/store/project/project.store";

export const GetProjectsController = async () => {
    const { setProjects, setCurrentUser, setSharedUsers } = useProjectStore.getState();
    // setLoading(true);
    try {
        const res = await fetch(
            APP_CONFIG.PUBLIC_API_URL + APP_CONFIG.PROJECT_LIST_WF,
            {
                method: "POST",
            }
        );
        if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status}`);
        }
        let projectsData = await res.json();
        const sharedListRaw = projectsData?.[0]?.SharedList;

        const sharedProjects =
            sharedListRaw && sharedListRaw !== "undefined"
                ? JSON.parse(sharedListRaw)
                : [];

        let projectsList = projectsData[0].projects;
        projectsList = JSON.parse(projectsList);

        // Extract questions from response if available and attach to first project
        const questionsFromResponse = projectsData[0]?.questions;
        if (questionsFromResponse && projectsList.length > 0) {
            try {
                projectsList[0].questions = typeof questionsFromResponse === 'string'
                    ? JSON.parse(questionsFromResponse)
                    : questionsFromResponse;
            } catch (error) {
                console.error("Error parsing questions from project list:", error);
                // Fallback or leave as undefined if parsing fails
            }
        }

        if (projectsList.length === 0) {
            setProjects([]);
            setSharedUsers(sharedProjects);
            // if (typeof window !== "undefined") {
            //     window.location.href = "/user.signin";
            // }
        } else {
            setProjects(projectsList);
            setSharedUsers(sharedProjects);
            setCurrentUser(projectsData[0].loginUsername);
        }

    } catch (error) {
        console.error("Error fetching users:", error);
    } finally {
        // setLoading(false);
    }
};

export const ProjectCreateController = async (
    researchTopic: string,
    aiAgent: string,
    setDisable: (disabled: boolean) => void,
    router: any,
    setCreateLoader: (loading: boolean) => void,
    setResearchTopic: (topic: string) => void,
) => {
    console.log("Creating project with topic:", researchTopic, "and AI Agent:", aiAgent);
    const data = {
        projectname: researchTopic,
        aiagent: aiAgent,
    };
    const formData = new FormData();
    formData.append("data", JSON.stringify([data]));

    try {
        const res = await fetch(
            APP_CONFIG.PUBLIC_API_URL + APP_CONFIG.CREATE_PROJECT_WF,
            {
                method: "POST",
                body: formData,
            }
        );

        if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status}`);
        }
        // Parse project returned from API
        const createdProject = await res.json();
        const projectData = JSON.parse(createdProject[0].data);


        if (projectData[0].ProjectID != "") {
            // Extract questions from the API response if available
            const questionsFromResponse = createdProject[0]?.questions;
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

            await GetProjectsController()
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
              router.push(`/projects/ask-rover?script_id=${encodeURIComponent(scriptId)}&projectId=${projectData[0].ProjectID}`);
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
        console.error("Error deleting project:", error);
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
    console.log("Delete Response:", deleteResponse);
    // Optionally, refresh project list or update UI here
    // } catch (error) {
    //     console.error("Error deleting project:", error);
    // }
}