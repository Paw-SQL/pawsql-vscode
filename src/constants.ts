export const COMMANDS = {
  NO_API_KEY_HINT: "pawsql.noApiKeyHint",
  CONFIGURE_API_KEY: "pawsql.configureApiKey",
  SELECT_WORKSPACE: "pawsql.selectWorkspace",
} as const;

export const CONTEXTS = {
  HAS_API_KEY: "pawsql:hasApiKey",
} as const;

export const UI_MESSAGES = {
  SQL_OPTIMIZED: "SQL 优化已完成",
  QUERYING_WORKSPACES: "正在查询工作空间...",
  NO_WORKSPACE:
    "当前没有可用的工作空间。请确保使用与已配置 API Key 关联的账户登录 PawSQL 网站创建工作空间。",
  CREATE_WORKSPACE: "去创建工作空间",
  WORKSPACE_SELECTOR_PLACEHOLDER: "请选择一个工作空间进行优化",
  OPTIMIZING_SQL: "$(sync~spin) 正在优化SQL...",
} as const;

export const DOMAIN = {
  // Backend: "http://localhost:8002",
  // Frontend: "http://localhost:3000",
  Backend: "https://www.pawsql.com",
  Frontend: "https://www.pawsql.com",
} as const;
export const URLS = {
  NEW_WORKSPACE: `${DOMAIN.Frontend}/app/workspaces/new-workspace`,
  STATEMENT_BASE: `${DOMAIN.Frontend}/statement`,
} as const;
