import * as vscode from "vscode";
import { PawSQLExtension } from "./main";
import { getUrls } from "./constants";
import type { ListWorkspacesResponse, WorkspaceItem } from "./apiService";
import { ApiService } from "./apiService";
import { ErrorHandler } from "./errorHandler";
import { SqlCodeLensProvider } from "./SqlCodeLensProvider";
import { ConfigurationService } from "./configurationService";
import { LanguageService } from "./LanguageService";
import path from "path";

export class CommandManager {
  constructor(
    private readonly extension: PawSQLExtension,
    private readonly context: vscode.ExtensionContext,
    private readonly sqlCodeLensProvider: SqlCodeLensProvider
  ) {}

  public async initializeCommands(): Promise<void> {
    try {
      this.registerApiKeyCommands();
    } catch (error) {
      ErrorHandler.handle("initialize.commands.failed", error);
    }
  }

  private registerApiKeyCommands(): void {
    const configFileDefaultDisposable = vscode.commands.registerCommand(
      "pawsql.selectFileDefaultWorkspace",
      () => this.handleFileDefaultWorkspaceSelection()
    );
    this.context.subscriptions.push(configFileDefaultDisposable);
  }

  public async handleFileDefaultWorkspaceSelection(): Promise<void> {
    const apiKey = await ConfigurationService.getApiKey();

    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    );
    statusBarItem.text = LanguageService.getMessage(
      "config.file.default.workspace"
    );
    statusBarItem.show();

    try {
      const workspaces = await ApiService.getWorkspaces(apiKey ?? "");

      if (workspaces.data.total === "0") {
        await this.handleEmptyWorkspaces();
        return;
      }

      const workspaceItems = this.createWorkspaceItems(workspaces);
      const selected = await this.showWorkspaceQuickPick(
        workspaceItems,
        LanguageService.getMessage("CONFIG_FILE_DEFAULT_WORKSPACE_PLACEHOLDER")
      );

      if (selected) {
        const currentFile =
          vscode.window.activeTextEditor?.document.uri.toString();
        if (currentFile) {
          const config = vscode.workspace.getConfiguration("pawsql");
          const mappings =
            config.get<Record<string, WorkspaceItem>>(
              "fileWorkspaceMappings"
            ) || {};
          mappings[currentFile] = selected;

          await config.update(
            "fileWorkspaceMappings",
            mappings,
            vscode.ConfigurationTarget.Global
          );
          this.sqlCodeLensProvider.refresh();
        }
      }
    } catch (error) {
      this.sqlCodeLensProvider.refresh();
      ErrorHandler.handle("workspace.operation.failed", error);
    } finally {
      statusBarItem.dispose();
    }
  }

  public async handleEmptyWorkspaces(): Promise<void> {
    const { URLS } = getUrls();
    const choice = await vscode.window.showErrorMessage(
      LanguageService.getMessage("NO_WORKSPACE"),
      LanguageService.getMessage("CREATE_WORKSPACE")
    );

    if (choice === LanguageService.getMessage("CREATE_WORKSPACE")) {
      await vscode.env.openExternal(vscode.Uri.parse(URLS.NEW_WORKSPACE));
    }
  }

  public createWorkspaceItems(
    workspaces: ListWorkspacesResponse
  ): WorkspaceItem[] {
    return workspaces.data.records.map((workspace) => {
      const iconPath = {
        light: path.join(
          __filename,
          "..",
          "..",
          "resources",
          "icon",
          workspace.workspaceDefinitionId ? "workspace" : "database",
          `${
            workspace.workspaceDefinitionId
              ? workspace.workspaceDefinitionId
              : workspace.dbType
              ? workspace.dbType.toLowerCase()
              : "mysql"
          }.svg`
        ),
        dark: path.join(
          __filename,
          "..",
          "..",
          "resources",
          "icon",
          workspace.workspaceDefinitionId ? "workspace" : "database",
          `${
            workspace.workspaceDefinitionId
              ? workspace.workspaceDefinitionId
              : workspace.dbType
              ? workspace.dbType.toLowerCase()
              : "mysql"
          }.svg`
        ),
      };

      return {
        label: `${workspace.workspaceName}`,
        iconPath: iconPath,
        workspaceId: workspace.workspaceId,
        workspaceName: workspace.workspaceName,
        dbType: workspace.dbType,
        dbHost: workspace.dbHost,
        dbPort: workspace.dbPort,
      };
    });
  }

  public async showWorkspaceQuickPick(
    items: WorkspaceItem[],
    placeHolder?: string
  ): Promise<WorkspaceItem | undefined> {
    return vscode.window.showQuickPick(items, {
      placeHolder:
        placeHolder ??
        LanguageService.getMessage("WORKSPACE_SELECTOR_PLACEHOLDER"),
    });
  }
}
