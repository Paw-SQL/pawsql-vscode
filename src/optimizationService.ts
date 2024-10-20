import { ApiService } from "./apiService";

export class OptimizationService {
  // 创建优化任务
  static async createAnalysis(params: {
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
  }) {
    return await ApiService.createAnalysis(params);
  }

  // 查询优化概要
  static async getAnalysisSummary(params: {
    userKey: string;
    analysisId: string;
  }) {
    return await ApiService.getAnalysisSummary(params);
  }

  // 查询优化详情
  static async getStatementDetails(params: {
    userKey: string;
    analysisStmtId: string;
  }) {
    return await ApiService.getStatementDetails(params);
  }
}
