import * as vscode from "vscode";

export class ConfigurationService {
  private config = vscode.workspace.getConfiguration("pawsql");

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
