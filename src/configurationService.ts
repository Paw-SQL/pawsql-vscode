import * as vscode from "vscode";
import { WorkspaceItem } from "./types";

export const ConfigurationService = {
  get config() {
    return vscode.workspace.getConfiguration("pawsql");
  },

  async getApiKey(): Promise<string | undefined> {
    return this.config.get("apiKey");
  },

  async getFrontendUrl(): Promise<string | undefined> {
    return this.config.get("url.frontendUrl");
  },
  async getBackendUrl(): Promise<string | undefined> {
    return this.config.get("url.backendUrl");
  },
  // 获取最近使用的工作空间
  async getRecentWorkspaces(): Promise<WorkspaceItem[]> {
    const config = vscode.workspace.getConfiguration("pawsql");
    const recentWorkspaces =
      config.get<WorkspaceItem[]>("recentWorkspaces") || [];
    return recentWorkspaces;
  },
};
