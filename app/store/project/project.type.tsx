import { ProjectType, projectSpecialisedType } from "@/types/project-types";
import type { AsyncStatus } from "@/types/async-status";

export interface ProjectStore {
    projects: ProjectType[];
    selectedProject: ProjectType[];
    AiAgentList: projectSpecialisedType[];
    currentUser: string;
    currentUserMailId: string;
    sahredUsers: Record<string, any>;
    hydrated: boolean;
    projectsStatus: AsyncStatus;
    projectsError: string | null;


    setProjects: (list: ProjectType[]) => void;
    setSelectedProject: (list: ProjectType[]) => void;
    setSelectedAiAgent: (id: string) => void;
    clearSelectedAiAgents: () => void;
    setCurrentUser: (user: string) => void;
    setCurrentUserMailId: (email: string) => void;
    setSharedUsers: (list: Record<string, any>) => void;
    setHydrated: () => void;
    setProjectsStatus: (status: AsyncStatus) => void;
    setProjectsError: (error: string | null) => void;
}
