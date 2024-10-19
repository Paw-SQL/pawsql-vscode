import * as vscode from "vscode";

export class ConfigurationService {
  // 每次获取配置时调用 getConfiguration，确保获取到最新值
  private get config() {
    return vscode.workspace.getConfiguration("pawsql");
  }

  async getApiKey(): Promise<string | undefined> {
    return this.config.get("apiKey");
  }

  async setApiKey(key: string): Promise<void> {
    await this.config.update("apiKey", key, true);
  }

  async getSelectedWorkspace(): Promise<string | undefined> {
    return this.config.get("selectedWorkspace");
  }

  async setSelectedWorkspace(workspaceId: string): Promise<void> {
    await this.config.update("selectedWorkspace", workspaceId, true);
  }
}
