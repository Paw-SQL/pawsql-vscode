import * as vscode from "vscode";
import { LanguageService } from "./LanguageService";

export const COMMANDS = {
  NO_API_KEY_HINT: "pawsql.noApiKeyHint",
  CONFIGURE_API_KEY: "pawsql.configureApiKey",
  CONFIGURE_API_URL: "pawsql.configureApiURL",
  SELECT_WORKSPACE: "pawsql.selectWorkspace",
  CURRENT_FILE_DEFAULT_WORKSPACE: "pawsql.currentFileDefaultWorkspace",
  CONFIG_FILE_DEFAULT_WORKSPACE: "pawsql.selectFileDefaultWorkspace",
  OPTIMIZE_WITH_FILE_DEFAULT_WORKSPACE: "pawsql.optimizeWithDefaultWorkspace",
  OPTIMIZE_WITH_FILE_SELECTED_WORKSPACE: "pawsql.optimizeWithSelectedWorkspace",
  OPTIMIZE_LAST_WORKSPACE: "pawsql.recentWorkspace", // 添加此行
  PAWSQL_CONFIG: "pawsql.openSettings",
} as const;

export const CONTEXTS = {
  HAS_API_KEY: "pawsql:hasApiKey",
} as const;

export const UI_MESSAGES = {
  SQL_OPTIMIZED: () => LanguageService.getMessage("SQL_OPTIMIZED"),
  QUERYING_WORKSPACES: () => LanguageService.getMessage("QUERYING_WORKSPACES"),
  CONFIG_FILE_DEFAULT_WORKSPACES: () =>
    LanguageService.getMessage("config.file.default.workspace"),
  NO_WORKSPACE: () => LanguageService.getMessage("NO_WORKSPACE"),
  CREATE_WORKSPACE: () => LanguageService.getMessage("CREATE_WORKSPACE"),
  NO_DEFAULT_WORKSPACE: () =>
    LanguageService.getMessage("NO_DEFAULT_WORKSPACE"),
  WORKSPACE_SELECTOR_PLACEHOLDER: () =>
    LanguageService.getMessage("WORKSPACE_SELECTOR_PLACEHOLDER"),
  CONFIG_FILE_DEFAULT_WORKSPACE_PLACEHOLDER: () =>
    LanguageService.getMessage("CONFIG_FILE_DEFAULT_WORKSPACE_PLACEHOLDER"),
  OPTIMIZING_SQL: () => LanguageService.getMessage("OPTIMIZING_SQL"),
} as const;

export function getUrls() {
  const config = vscode.workspace.getConfiguration("pawsql.url");
  const frontendUrl =
    config.get<string>("frontendUrl") || "https://www.pawsql.com";
  const backendUrl =
    config.get<string>("backendUrl") || "https://www.pawsql.com";

  return {
    DOMAIN: {
      Backend: backendUrl,
      Frontend: frontendUrl,
    },
    URLS: {
      NEW_WORKSPACE: `${frontendUrl}/app/workspaces/new-workspace`,
      STATEMENT_BASE: `${frontendUrl}/statement`,
      QUERY_BASE: `${frontendUrl}/query`,
    },
  };
}
