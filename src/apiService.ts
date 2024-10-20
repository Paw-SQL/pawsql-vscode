import axios from "axios";
import { DOMAIN } from "./constants";

// 定义接口请求参数和返回数据类型
interface ListWorkspacesParams {
  userKey: string;
}

interface Workspace {
  workspaceId: string;
  workspaceName: string;
  dbType: string;
  createTime: string;
  numberOfAnalysis: number;
  latestAnalysisTime: string;
  status: string;
}

interface ListWorkspacesResponse {
  code: number;
  message: string;
  data: {
    records: Workspace[];
    total: string;
    size: string;
    current: string;
    pages: string;
  };
}

interface CreateAnalysisParams {
  userKey: string;
  workspace: string;
  dbType?: string;
  workload: string;
  queryMode: string;
  validateFlag?: boolean;
  analysisName?: string;
  analyzeFlag?: boolean;
  deduplicateFlag?: boolean;
  indexOnly?: boolean;
  maxMembersForIndexOnly?: number;
  maxMembers?: number;
  maxPerTable?: number;
  maxSpace?: number;
  closeRewrite?: boolean;
  rules?: Array<{ ruleCode: string; rewrite: boolean; threshold?: string }>;
}

interface CreateAnalysisResponse {
  code: number;
  message: string;
  data: {
    analysisId: string;
    status: string;
  };
}

interface GetAnalysisSummaryParams {
  userKey: string;
  analysisId: string;
}

interface GetAnalysisSummaryResponse {
  code: number;
  message: string;
  data: any; // 根据具体返回类型进行调整
}

interface GetStatementDetailsParams {
  userKey: string;
  analysisStmtId: string;
}

interface GetStatementDetailsResponse {
  code: number;
  message: string;
  data: any; // 根据具体返回类型进行调整
}

// 获取工作空间列表
export const getWorkspaces = async (
  userKey: string
): Promise<ListWorkspacesResponse> => {
  const url = `${DOMAIN.Backend}/api/v1/listWorkspaces`; // 替换为实际的 URL
  const response = await axios.post<ListWorkspacesResponse>(url, { userKey });
  return response.data;
};

// 创建优化任务
export const createAnalysis = async (
  params: CreateAnalysisParams
): Promise<CreateAnalysisResponse> => {
  const url = `${DOMAIN.Backend}/api/v1/createAnalysis`; // 替换为实际的 URL
  const response = await axios.post<CreateAnalysisResponse>(url, params);
  return response.data;
};

// 查询优化概要
export const getAnalysisSummary = async (
  params: GetAnalysisSummaryParams
): Promise<GetAnalysisSummaryResponse> => {
  const url = `${DOMAIN.Backend}/api/v1/getAnalysisSummary`; // 替换为实际的 URL
  const response = await axios.post<GetAnalysisSummaryResponse>(url, params);
  return response.data;
};

// 查询优化详情
export const getStatementDetails = async (
  params: GetStatementDetailsParams
): Promise<GetStatementDetailsResponse> => {
  const url = `${DOMAIN.Backend}/api/v1/getStatementDetails`; // 替换为实际的 URL
  const response = await axios.post<GetStatementDetailsResponse>(url, params);
  return response.data;
};

// 组合服务以便于调用
export const ApiService = {
  getWorkspaces,
  createAnalysis,
  getAnalysisSummary,
  getStatementDetails,
};
