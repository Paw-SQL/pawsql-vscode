export interface WorkspaceItem {
  label: string;
  workspaceId: string;
  workspaceName: string;
  dbType: string;
  dbHost: string;
  dbPort: string;
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
      workspaceId: string;
      workspaceName: string;
      dbType: string;
      dbHost: string;
      dbPort: string;
    }>;
  };
}
