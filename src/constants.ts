import * as vscode from "vscode";

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
