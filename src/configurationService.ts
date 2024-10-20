import * as vscode from "vscode";

export const ConfigurationService = {
  get config() {
    return vscode.workspace.getConfiguration("pawsql");
  },

  async getApiKey(): Promise<string | undefined> {
    return this.config.get("apiKey");
  },
};
