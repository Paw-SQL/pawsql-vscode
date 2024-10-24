import * as vscode from "vscode";
import { LanguageService } from "./LanguageService";

export const COMMANDS = {
  NO_API_KEY_HINT: "pawsql.noApiKeyHint",
  CONFIGURE_API_KEY: "pawsql.configureApiKey",
  CONFIGURE_API_URL: "pawsql.configureApiURL",
  SELECT_WORKSPACE: "pawsql.selectWorkspace",
  OPTIMIZE_LAST_WORKSPACE: "pawsql.recentWorkspace", // 添加此行
} as const;

export const CONTEXTS = {
  HAS_API_KEY: "pawsql:hasApiKey",
} as const;

export const UI_MESSAGES = {
  SQL_OPTIMIZED: () => LanguageService.getMessage("SQL_OPTIMIZED"),
  QUERYING_WORKSPACES: () => LanguageService.getMessage("QUERYING_WORKSPACES"),
  NO_WORKSPACE: () => LanguageService.getMessage("NO_WORKSPACE"),
  CREATE_WORKSPACE: () => LanguageService.getMessage("CREATE_WORKSPACE"),
  WORKSPACE_SELECTOR_PLACEHOLDER: () =>
    LanguageService.getMessage("WORKSPACE_SELECTOR_PLACEHOLDER"),
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
