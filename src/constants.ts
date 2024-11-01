import * as vscode from "vscode";
import { LanguageService } from "./LanguageService";

export const COMMANDS = {
  CONFIG_FILE_DEFAULT_WORKSPACE: "pawsql.selectFileDefaultWorkspace",
  OPTIMIZE_WITH_FILE_DEFAULT_WORKSPACE: "pawsql.optimizeWithDefaultWorkspace",
  OPTIMIZE_WITH_FILE_SELECTED_WORKSPACE: "pawsql.optimizeWithSelectedWorkspace",
  PAWSQL_CONFIG: "pawsql.openSettings",
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
  const config = vscode.workspace.getConfiguration("pawsql");
  const frontendUrl = config.get<string>("frontendUrl");
  const backendUrl = config.get<string>("backendUrl");

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
