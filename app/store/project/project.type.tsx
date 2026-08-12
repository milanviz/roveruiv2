import { ProjectType, projectSpecialisedType } from "@/types/project-types";

export interface ProjectStore {
    projects: ProjectType[];
    selectedProject: ProjectType[];
    AiAgentList: projectSpecialisedType[];
    currentUser: string;
    currentUserMailId: string;
    sahredUsers: Record<string, any>;
    hydrated: boolean;


    setProjects: (list: ProjectType[]) => void;
    setSelectedProject: (list: ProjectType[]) => void;
    setSelectedAiAgent: (id: string) => void;
    clearSelectedAiAgents: () => void;
    setCurrentUser: (user: string) => void;
    setSharedUsers: (list: Record<string, any>) => void;
    setHydrated: () => void;
}