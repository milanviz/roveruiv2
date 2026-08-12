export interface InsightType {
  ProjectID: string;
  Source: string;
  Key: string;
  QueryType: boolean;
  SourceID: string;
  SourceName: string;
  Question: string;
  Answer: string;
  UpdatedBy: string;
  UpdatedOn: string;
  Tags: string;
  UpVotedCount: number;
  UpvotedJSON: string;
  SectorFlag: number;
  VectorFlag: string;
  RecommendedQuestions: string;
  rowID: string;
  jsCodes: string[];
  QID: string;
  Actions: {
    messages: any[];
  };
}

export interface SaveInsightType {
  wid: string;
  type: string;
  qid: string;
  follow: boolean;
  userlist: string;
  count: string;
}

export interface setAfterStreamingType {
  question: string;
  answer: string;
  project_id: string;
  document_id: string;
  user_id: string;
  qid: string;
  source: string;
  source_documents: any[];
}
export interface InsightType {
  QID: string;
  Source: string;
  Tags: string;       // ← this is the fix
  UpdatedBy: string;
  UpdatedOn: string;
  // ... others
}

