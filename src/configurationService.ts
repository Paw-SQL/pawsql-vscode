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

  // 获取用户级别的默认工作空间
  async getUserDefaultWorkspace(): Promise<WorkspaceItem | undefined> {
    return this.config.get<WorkspaceItem>("defaultWorkspace");
  },

  // 获取最近使用的工作空间
  async getRecentWorkspaces(): Promise<WorkspaceItem[]> {
    const config = vscode.workspace.getConfiguration("pawsql");
    return config.get<WorkspaceItem[]>("recentWorkspaces") || [];
  },

  // 设置用户级别的默认工作空间
  async setUserDefaultWorkspace(workspaceItem: WorkspaceItem): Promise<void> {
    await this.config.update(
      "defaultWorkspace",
      workspaceItem,
      vscode.ConfigurationTarget.Global
    );
  },

  async getFileDefaultWorkspace(
    fileUri: string
  ): Promise<WorkspaceItem | undefined> {
    const config = vscode.workspace.getConfiguration("pawsql");
    const mappings =
      config.get<Record<string, any>>("fileWorkspaceMappings") || {};
    return mappings[fileUri] || null; // 返回整个 workspaceItem
  },
  async getDefaultWorkspace(): Promise<any> {
    const config = vscode.workspace.getConfiguration("pawsql");
    return config.get("defaultWorkspace");
  },
};
