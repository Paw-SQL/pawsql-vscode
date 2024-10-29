import * as vscode from "vscode";
import { PawSQLExtension } from "./main";
import { COMMANDS, UI_MESSAGES, getUrls } from "./constants";
import type { WorkspaceItem } from "./types";
import { ApiService } from "./apiService";
import { ErrorHandler } from "./errorHandler";

export class CommandManager {
  constructor(
    private readonly extension: PawSQLExtension,
    private readonly context: vscode.ExtensionContext
  ) {}

  public async initializeCommands(apiKey: string | undefined): Promise<void> {
    try {
      this.registerApiKeyCommands();
      await this.updateWorkspaceCommands(apiKey);
    } catch (error) {
      ErrorHandler.handle("initialize.commands.failed", error);
    }
  }

  public async updateWorkspaceCommands(
    apiKey: string | undefined
  ): Promise<void> {
    const disposable = vscode.commands.registerCommand(
      COMMANDS.SELECT_WORKSPACE,
      () => this.handleWorkspaceSelection(apiKey ?? "")
    );
    this.context.subscriptions.push(disposable);
  }

  private registerApiKeyCommands(): void {
    const commands = [
      {
        command: COMMANDS.NO_API_KEY_HINT,
        callback: () => this.openSettings("pawsql.apiKey"),
      },
      {
        command: COMMANDS.CONFIGURE_API_KEY,
        callback: () => this.openSettings("pawsql.apiKey"),
      },
      {
        command: COMMANDS.CONFIGURE_API_URL,
        callback: () => this.openSettings("pawsql.url"),
      },
      {
        command: COMMANDS.PAWSQL_CONFIG,
        callback: () => this.openSettings("pawsql."),
      },
    ];

    commands.forEach(({ command, callback }) => {
      const disposable = vscode.commands.registerCommand(command, callback);
      this.context.subscriptions.push(disposable);
    });
  }

  private async openSettings(section: string): Promise<void> {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      section
    );
  }

  private async handleWorkspaceSelection(apiKey: string): Promise<void> {
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    );
    statusBarItem.text = UI_MESSAGES.QUERYING_WORKSPACES();
    statusBarItem.show();

    try {
      const workspaces = await ApiService.getWorkspaces(apiKey);

      if (workspaces.data.total === "0") {
        await this.handleEmptyWorkspaces();
        return;
      }

      const workspaceItems = this.createWorkspaceItems(workspaces);
      const selected = await this.showWorkspaceQuickPick(workspaceItems);

      if (selected) {
        await this.extension.optimizeSql(selected.workspaceId);
      }
    } catch (error) {
      ErrorHandler.handle("workspace.operation.failed", error);
    } finally {
      statusBarItem.dispose();
    }
  }

  private async handleEmptyWorkspaces(): Promise<void> {
    const { URLS } = getUrls();
    const choice = await vscode.window.showInformationMessage(
      UI_MESSAGES.NO_WORKSPACE(),
      UI_MESSAGES.CREATE_WORKSPACE()
    );

    if (choice === UI_MESSAGES.CREATE_WORKSPACE()) {
      await vscode.env.openExternal(vscode.Uri.parse(URLS.NEW_WORKSPACE));
    }
  }

  private createWorkspaceItems(workspaces: any): WorkspaceItem[] {
    return workspaces.data.records.map((workspace: any) => ({
      label: workspace.workspaceName,
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName,
    }));
  }

  private async showWorkspaceQuickPick(
    items: WorkspaceItem[]
  ): Promise<WorkspaceItem | undefined> {
    return vscode.window.showQuickPick(items, {
      placeHolder: UI_MESSAGES.WORKSPACE_SELECTOR_PLACEHOLDER(),
    });
  }
}
