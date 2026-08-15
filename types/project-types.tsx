export interface ProjectType {
    ProjectID: string;
    ProjectName: string;
    Summary: string;
    AIAgent: string;
    CreatedBy?: string;
    CreatedOn?: string;
    rowid?: string;
    questions?: string | Record<string, string[]>;
    user_id?: string;
    user_email?: string;
    file_name?: string;
    file_full_url?: string;
}

// export interface ShareProjectResponse {
//     success: boolean;
//     message: string;
// }

export interface projectSpecialisedType {
    id: string; title: string; subtitle: string; icon: string, selected: boolean
};
