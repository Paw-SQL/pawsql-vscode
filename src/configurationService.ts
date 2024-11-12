import * as vscode from "vscode";
import { WorkspaceItem } from "./apiService";

export const ConfigurationService = {
  get config() {
    return vscode.workspace.getConfiguration("pawsql");
  },

  getApiKey(): string | undefined {
    return this.config.get("apiKey"); // 返回值为 string 或 undefined
  },

  getFrontendUrl(): string | undefined {
    return this.config.get("frontendUrl"); // 返回值为 string 或 undefined
  },

  getBackendUrl(): string | undefined {
    return this.config.get("backendUrl"); // 返回值为 string 或 undefined
  },

  getUserDefaultWorkspace(): WorkspaceItem | undefined {
    return this.config.get<WorkspaceItem>("defaultWorkspace"); // 返回值为 WorkspaceItem 或 undefined
  },

  setUserDefaultWorkspace(workspaceItem: WorkspaceItem): Thenable<void> {
    return this.config.update(
      "defaultWorkspace",
      workspaceItem,
      vscode.ConfigurationTarget.Global
    ); // 返回 Thenable<void>
  },

  // 清除用户级别的默认工作空间，返回类型为 void
  clearUserDefaultWorkspace(): Thenable<void> {
    return this.config.update(
      "defaultWorkspace",
      null,
      vscode.ConfigurationTarget.Global
    ); // 返回 Thenable<void>
  },

  // 清除文件的默认工作空间，返回类型为 void
  clearFileDefaultWorkspace(): Thenable<void> {
    return this.config.update(
      "fileWorkspaceMappings",
      {},
      vscode.ConfigurationTarget.Global
    ); // 返回 Thenable<void>
  },

  // 获取文件级别的默认工作空间，返回类型是 WorkspaceItem | null
  getFileDefaultWorkspace(fileUri: string): WorkspaceItem | null {
    const mappings =
      this.config.get<Record<string, WorkspaceItem>>("fileWorkspaceMappings") ||
      {};
    return mappings[fileUri] || null; // 返回值为 WorkspaceItem 或 null
  },

  getDefaultWorkspace(): WorkspaceItem | undefined {
    return this.config.get("defaultWorkspace"); // 返回值为 WorkspaceItem 或 undefined
  },

  // 打开设置界面并显示 pawsql 侧边栏，返回类型为 void
  openSettings(section: string): Thenable<void> {
    return vscode.commands
      .executeCommand("workbench.action.openSettings", section)
      .then(() =>
        vscode.commands.executeCommand(
          "workbench.view.extension.pawsqlContainer"
        )
      ); // 返回 Thenable<void>
  },
};
