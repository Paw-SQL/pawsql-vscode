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
    return this.config.get("frontendUrl");
  },

  async getBackendUrl(): Promise<string | undefined> {
    return this.config.get("backendUrl");
  },

  // 获取用户级别的默认工作空间
  async getUserDefaultWorkspace(): Promise<WorkspaceItem | undefined> {
    return this.config.get<WorkspaceItem>("defaultWorkspace");
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

  async openSettings(section: string): Promise<void> {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      section
    );
    // 打开 pawsql sidebar
    await vscode.commands.executeCommand(
      "workbench.view.extension.pawsqlContainer"
    );
  },
};
