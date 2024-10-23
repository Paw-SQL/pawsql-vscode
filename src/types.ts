export interface WorkspaceItem {
  label: string;
  workspaceId: string;
  workspaceName: string;
}

export interface AnalysisStatement {
  analysisStmtId: string;
}

export interface AnalysisResponse {
  data: {
    analysisId: string;
  };
}

export interface SummaryResponse {
  data: {
    summaryStatementInfo: AnalysisStatement[];
  };
}

export interface WorkspacesResponse {
  data: {
    total: string;
    records: Array<{
      workspaceName: string;
      workspaceId: string;
    }>;
  };
}
