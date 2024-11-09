import { getUrls } from "./constants";
import axios, { AxiosError } from "axios";

// 定义接口请求参数和返回数据类型
interface ListWorkspacesParams {
  userKey: string;
}

export interface WorkspaceItem {
  label: string;
  workspaceId: string;
  workspaceName: string;
  dbType: string;
  dbHost: string;
  dbPort: string;
}

export interface AnalysisAndSummaryResponse {
  analysis: CreateAnalysisResponse;
  analysisSummary: GetAnalysisSummaryResponse;
}

export interface Workspace {
  workspaceId: string;
  workspaceName: string;
  workspaceDefinitionId: string;
  dbType: string;
  dbHost: string;
  dbPort: string;
  createTime: string;
  numberOfAnalysis: number;
  latestAnalysisTime: string;
  status: string;
}

export interface AnalysisBasicRead {
  analysisId: string; // 分析ID
  analysisName: string; // 分析名称
  workspaceId: string; // workspaceId
  workspaceName: string; // workspace名称
  status: string; // 状态
  numberOfQuery: number; // 分析的query数量
  numberOfSyntaxError: number; // 语法错误数目
  numberOfIndex: number; // 推荐出来的索引数量
  numberOfRewrite: number; // 重写出来的query数量
  numberOfRewriteRules: number; // 违反的重写规则数
  numberOfViolations: number; // 违反的规则数量
  numberOfViolatedQuery: number; // 违反规则的query数量
  performanceImprove: number | null; // 性能提升比例 (可能为 null)
  createUserId: string; // 创建人ID
  createUserName: string; // 创建人名称
  createTime: string; // 创建时间
}

export interface ListWorkspacesResponse {
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

interface ListAnalysesResponse {
  code: number;
  message: string;
  data: {
    records: AnalysisBasicRead[];
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
  data: AnalysisSummaryRead; // 根据具体返回类型进行调整
}

interface GetStatementDetailsParams {
  userKey: string;
  analysisStmtId: string;
}

interface GetStatementDetailsResponse {
  code: number;
  message: string;
  data: StatementDetailInfoRead; // 根据具体返回类型进行调整
}

// 获取工作空间列表
export const getWorkspaces = async (
  userKey: string
): Promise<ListWorkspacesResponse> => {
  const { DOMAIN } = getUrls(); // 动态获取 DOMAIN
  const url = `${DOMAIN.Backend}/api/v1/listWorkspaces`;
  const response = await axios.post<ListWorkspacesResponse>(url, {
    userKey: userKey,
    pageSize: 100,
    pageNumber: 1,
  });

  if (!response.data.data) {
    throw Error("error.backendUrl.invalid");
  }
  return response.data;
};
// 获取优化列表
export const getAnalyses = async (
  userKey: string,
  workspaceId: string
): Promise<ListAnalysesResponse> => {
  const { DOMAIN } = getUrls(); // 动态获取 DOMAIN
  const url = `${DOMAIN.Backend}/api/v1/listAnalyses`;
  const response = await axios.post<ListAnalysesResponse>(url, {
    userKey: userKey,
    workspaceId: workspaceId,
    pageSize: 10,
    pageNumber: 1,
  });

  if (!response.data.data) {
    throw Error("error.backendUrl.invalid");
  }
  return response.data;
};

// 创建优化任务
export const createAnalysis = async (
  params: CreateAnalysisParams
): Promise<CreateAnalysisResponse> => {
  const { DOMAIN } = getUrls(); // 动态获取 DOMAIN
  const url = `${DOMAIN.Backend}/api/v1/createAnalysis`;
  const response = await axios.post<CreateAnalysisResponse>(url, params);
  if (!response.data.data) {
    throw Error("error.backendUrl.invalid");
  }

  if (!response.data.data.status.startsWith("success")) {
    throw Error("error.create.analysis.failed");
  }

  return response.data;
};

export interface AnalysisSummaryRead {
  status: string; // 分析状态
  analysisName: string;
  basicSummary: AnalysisSummary; // AnalysisSummary 信息
  analysisRuleInfo: RuleQueries[]; // 规则信息
  analysisIndexInfo: string[]; // 索引推荐信息
  summaryStatementInfo: SummaryStatementInfo[]; // query信息
}

export interface AnalysisSummary {
  analysisSummaryId: string; // 分析汇总ID，使用 string 类型
  analysisId: string; // 分析ID，使用 string 类型
  numberOfQuery: number; // query数量
  numberOfSyntaxError: number; // 语法错误数目
  numberOfRewrite: number; // 重写的query数量
  numberOfRewriteRules: number; // 违反的重写规则数
  numberOfRewrittenQuery: number; // 被重写的query数量
  numberOfViolations: number; // 违反规则数量
  numberOfViolatedQuery: number; // 违反规则的query数量
  numberOfIndex: number; // 推荐索引数量
  numberOfQueryIndex: number; // 用到推荐索引的query数量
  performanceImprove: number; // 性能提升比例
  summaryMarkdown: string; // 汇总信息的markdown文本
  summaryMarkdownZh: string; // 汇总信息的中文markdown文本
  commentCount: number; // 评论数量
  needReply: number; // 分析反馈是否已回复 (-1:未回复, 0:未评论, 1:已回复)
}

export interface RuleQueries {
  ruleName: string; // 规则名称
  stmtNameStr: string; // query名称列表字符串
}
export interface SummaryStatementInfo {
  analysisStmtId: string; // 推荐索引ID，使用 string 类型
  stmtId: string; // statement ID，使用 string 类型
  stmtName: string; // statement名称
  stmtType: string; // statement类型
  stmtText: string; // statement文本
  costBefore: number; // 执行前成本
  costAfter: number; // 执行后成本
  numberOfRewrite: number; // 重写的query数量
  numberOfRewriteRules: number; // 违反的重写规则数
  numberOfViolations: number; // 违反规则的数量
  numberOfSyntaxError: number; // 语法错误数目
  numberOfIndex: number; // 推荐索引数量
  numberOfHitIndex: number; // 有效的索引数量
  performance: number; // 性能提升
  contributingIndices: string; // 产生贡献的索引名称
  commentCount: number; // 评论数量
  needReply: number; // 是否已回复 (-1:未回复, 0:未评论, 1:已回复)
}

export interface StatementDetailInfoRead {
  analysisId: string; // 分析ID，使用 string 类型
  analysisName: string; // 分析名称
  stmtId: string; // statement ID，使用 string 类型
  statementName: string; // statement名称
  stmtText: string; // statement文本（表ID）
  detailMarkdown: string; // 详细信息markdown文本
  detailMarkdownZh: string; // 详细信息中文markdown文本
  openaiOptimizeTextEn: string; // openai优化结果英文
  openaiOptimizeTextZh: string; // openai优化结果中文
  indexRecommended: string[]; // 推荐的索引列表
  rewrittenQuery: RuleRewrittenQuery[]; // 重写后的query列表
  violationRule: RuleRewrittenFragments[]; // 违反的规则列表
  validationDetails: ValidationDetails; // validate后的相关信息
}
export interface RuleRewrittenQuery {
  ruleCode: string; // 规则代码
  ruleNameZh: string; // 规则中文名称
  ruleNameEn: string; // 规则英文名称
  rewrittenQueriesStr: string; // 重写的queries字符串
  violatedQueriesStr: string; // 审查的queries字符串
}

export interface RuleRewrittenFragments {
  ruleName: string; // 规则名称
  fragmentsStr: string; // fragment名称
}
export interface ValidationDetails {
  beforeCost: number; // 索引的执行前成本
  afterCost: number; // 索引的执行后成本
  beforePlan: string; // 前执行计划
  afterPlan: string; // 后执行计划
  performImprovePer: number; // 性能提升百分比
  stmtText: string; // statement文本（表ID）
}
// 查询优化概要
export const getAnalysisSummary = async (
  params: GetAnalysisSummaryParams
): Promise<GetAnalysisSummaryResponse> => {
  const { DOMAIN } = getUrls(); // 动态获取 DOMAIN
  const url = `${DOMAIN.Backend}/api/v1/getAnalysisSummary`;
  const response = await axios.post<GetAnalysisSummaryResponse>(url, params);
  if (!response.data.data) {
    throw Error("error.backendUrl.invalid");
  }
  return response.data;
};

// 查询优化详情
export const getStatementDetails = async (
  params: GetStatementDetailsParams
): Promise<GetStatementDetailsResponse> => {
  const { DOMAIN } = getUrls(); // 动态获取 DOMAIN
  const url = `${DOMAIN.Backend}/api/v1/getStatementDetails`;
  const response = await axios.post<GetStatementDetailsResponse>(url, params);
  if (!response.data.data) {
    throw Error("error.backendUrl.invalid");
  }
  return response.data;
};

// 验证 userKey 的有效性和 backend URL 的连通性
export const validateUserKey = async (userKey: string): Promise<boolean> => {
  const { DOMAIN } = getUrls(); // 动态获取 DOMAIN
  const url = `${DOMAIN.Backend}/api/v1/validateUserKey`; // 假设你有这个验证接口

  try {
    // 发送请求以验证 userKey
    const response = await axios.post(url, { userKey }, { timeout: 3000 });
    return response.data.code === 200; // 假设返回码 200 表示有效
  } catch (error: any) {
    console.log(error);
    return false;
  }
};

export const getUserKey = async (
  email: string,
  password: string
): Promise<string | null> => {
  const { DOMAIN } = getUrls();
  const url = `${DOMAIN.Backend}/api/v1/getUserKey`;

  try {
    // 发送请求以验证 userKey
    const response = await axios.post(
      url,
      { email, password },
      { timeout: 3000 }
    );

    return response.data.data; // 假设返回码 200 表示有效
  } catch (error: any) {
    console.log(error);
    return null;
  }
};

interface ValidationResult {
  isAvailable: boolean;
  error?: string;
  details?: {
    message: string;
    statusCode?: number;
    errorCode?: string;
  };
}

interface ValidationOptions {
  timeout?: number;
}

/**
 * 验证后端服务可用性
 */
export const validateBackend = async (
  backendUrl: string,
  options: ValidationOptions = {}
): Promise<ValidationResult> => {
  const timeout = options.timeout || 3000;

  try {
    // 处理 URL，确保格式正确
    const url = backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;

    // 尝试访问根路径，大多数 Spring Boot 应用都会响应
    const response = await axios({
      method: "get",
      url: url,
      timeout,
      headers: {
        Accept: "application/json, text/plain, */*",
      },
      validateStatus: (status) => {
        // 任何响应都表示服务在运行
        return status >= 200 && status < 500;
      },
    });

    // 2xx 和 3xx 状态码表示正常访问
    const isSuccessResponse = response.status >= 200 && response.status < 400;

    return {
      isAvailable: true,
      details: {
        message: isSuccessResponse
          ? `成功连接到后端服务 (状态码: ${response.status})`
          : `后端服务可访问，但返回了状态码: ${response.status}`,
        statusCode: response.status,
      },
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    console.log(axiosError);

    // 如果收到任何 HTTP 响应，说明服务器是在线的
    if (
      axiosError.response?.status !== undefined &&
      axiosError.response.status >= 200 &&
      axiosError.response.status < 500
    ) {
      return {
        isAvailable: true,
        details: {
          message: "后端服务可访问，但可能需要认证或存在其他限制",
          statusCode: axiosError.response.status,
          errorCode: axiosError.code,
        },
      };
    }

    return {
      isAvailable: false,
      error: getErrorMessage(axiosError),
      details: {
        message: axiosError.message,
        errorCode: axiosError.code,
      },
    };
  }
};

interface ValidationOptions {
  timeout?: number;
  checkPaths?: string[];
}

/**
 * 验证前端服务可用性
 */

/**
 * 验证前端服务可用性
 * @param frontendUrl 前端服务地址
 * @param options 配置选项
 * @returns ValidationResult
 */
export const validateFrontend = async (
  frontendUrl: string,
  options: ValidationOptions = {}
): Promise<ValidationResult> => {
  const timeout = options.timeout || 5000;
  const defaultCheckPaths = ["/favicon.ico", "/robots.txt", "/"];

  // 规范化 URL
  const baseUrl = frontendUrl.endsWith("/")
    ? frontendUrl.slice(0, -1)
    : frontendUrl;

  // 创建检查函数
  const checkUrl = async (path: string): Promise<ValidationResult> => {
    try {
      const response = await axios({
        method: "head",
        url: `${baseUrl}${path}`,
        timeout,
        headers: {
          Accept: "text/html, */*",
        },
        maxRedirects: 3,
        validateStatus: (status) => status >= 200 && status < 500,
      });

      const isSuccessResponse = response.status >= 200 && response.status < 400;

      return {
        isAvailable: true,
        details: {
          message: isSuccessResponse
            ? `成功连接到前端服务 (状态码: ${response.status})`
            : `前端服务可访问，但返回了状态码: ${response.status}`,
          statusCode: response.status,
        },
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      if (
        axiosError.response?.status !== undefined &&
        axiosError.response.status >= 200 &&
        axiosError.response.status < 500
      ) {
        return {
          isAvailable: true,
          details: {
            message: "前端服务可访问，但返回了非预期的状态码",
            statusCode: axiosError.response.status,
            errorCode: axiosError.code,
          },
        };
      }

      return {
        isAvailable: false,
        error: getErrorMessage(axiosError),
        details: {
          message: axiosError.message,
          errorCode: axiosError.code,
        },
      };
    }
  };

  // 并发检查多个路径
  const checkPaths = options.checkPaths || defaultCheckPaths;
  const results = await Promise.all(checkPaths.map((path) => checkUrl(path)));

  // 如果任何一个检查成功，就认为服务可用
  const successResult = results.find((r) => r.isAvailable);
  if (successResult) {
    return successResult;
  }

  // 所有检查都失败时返回最后一个错误
  return results[results.length - 1];
};

/**
 * 获取友好的错误消息
 */
const getErrorMessage = (error: AxiosError): string => {
  if (error.code === "ECONNREFUSED") {
    return "无法连接到服务器，服务可能未启动";
  }
  if (error.code === "ETIMEDOUT") {
    return "连接超时，请检查服务器地址或网络状况";
  }
  if (error.code === "ERR_BAD_REQUEST") {
    return "服务器返回了错误的响应，但服务是在线的";
  }
  if (error.code === "ERR_NETWORK") {
    return "网络错误，请检查网络连接";
  }
  if (error.code === "ENOTFOUND") {
    return "无法解析服务器地址，请检查 URL 是否正确";
  }
  return error.message;
};

// 组合服务以便于调用
export const ApiService = {
  getWorkspaces,
  getAnalyses,
  createAnalysis,
  getAnalysisSummary,
  getStatementDetails,
  validateUserKey,
  getUserKey,
};
