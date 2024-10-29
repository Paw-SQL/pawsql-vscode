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

  // 获取文件级别的默认工作空间
  async getFileDefaultWorkspace(
    fileUri: string
  ): Promise<WorkspaceItem | undefined> {
    const fileWorkspaces = await this.config.get<{
      [key: string]: WorkspaceItem;
    }>("fileWorkspaces");
    return fileWorkspaces ? fileWorkspaces[fileUri] : undefined;
  },

  // 设置文件级别的默认工作空间
  async setFileDefaultWorkspace(
    fileUri: string,
    workspaceItem: WorkspaceItem
  ): Promise<void> {
    const config = this.config;
    const fileWorkspaces =
      (await config.get<{ [key: string]: WorkspaceItem }>("fileWorkspaces")) ||
      {};

    // 存储文件和工作空间的映射关系
    fileWorkspaces[fileUri] = workspaceItem;

    // 保持文件工作空间数量不超过 10
    const workspaceEntries = Object.entries(fileWorkspaces);
    if (workspaceEntries.length > 10) {
      const oldestFileUri = workspaceEntries[0][0];
      delete fileWorkspaces[oldestFileUri]; // 删除最旧的一个
    }

    await config.update(
      "fileWorkspaces",
      fileWorkspaces,
      vscode.ConfigurationTarget.Global
    );
  },

  // 设置用户级别的默认工作空间
  async setUserDefaultWorkspace(workspaceItem: WorkspaceItem): Promise<void> {
    await this.config.update(
      "defaultWorkspace",
      workspaceItem,
      vscode.ConfigurationTarget.Global
    );
  },
};
