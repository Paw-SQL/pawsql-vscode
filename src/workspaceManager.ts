import * as vscode from "vscode";
import { WorkspaceItem } from "./types";
import { PawSQLExtension } from "./main";

export class WorkspaceManager {
  private disposables: vscode.Disposable[] = [];
  private recentDisposables: vscode.Disposable[] = [];
  private recentWorkspaces: WorkspaceItem[] = [];
  private pawSQLExtension: PawSQLExtension;
  private readonly maxRecentWorkspaces: number = 1;

  constructor(private extension: PawSQLExtension) {
    this.loadRecentWorkspaces();
    // 在构造函数中设置初始上下文
    this.updateWorkspaceContext();
    this.pawSQLExtension = extension;
  }

  clear(): void {
    this.disposables.forEach((cmd) => {
      try {
        cmd.dispose();
      } catch (error) {
        console.error("清除命令失败:", error);
      }
    });
    this.disposables = [];
  }

  clearRecent(): void {
    this.recentDisposables.forEach((cmd) => {
      try {
        cmd.dispose();
      } catch (error) {
        console.error("清除最近工作空间命令失败:", error);
      }
    });
    this.recentDisposables = [];
  }

  addDisposable(disposable: vscode.Disposable): void {
    this.disposables.push(disposable);
  }

  addRecentDisposable(disposable: vscode.Disposable): void {
    this.recentDisposables.push(disposable);
  }

  public async addRecentWorkspace(workspace: WorkspaceItem): Promise<void> {
    this.recentWorkspaces = [workspace]; // 只保存最近一次使用的工作空间

    await this.saveRecentWorkspaces();
    await this.updateWorkspaceContext();
  }

  public async updateWorkspaceContext(): Promise<void> {
    const count = this.recentWorkspaces.length;

    // 更新数量上下文
    await vscode.commands.executeCommand(
      "setContext",
      "pawsql:recentWorkspacesCount",
      count
    );

    // 更新每个工作空间的名称上下文
    for (let i = 0; i < this.maxRecentWorkspaces; i++) {
      const workspace = this.recentWorkspaces[i];
      await vscode.commands.executeCommand(
        "setContext",
        `pawsql:recentWorkspace${i + 1}Name`,
        workspace ? `${workspace.workspaceName} (最近使用)` : ""
      );
    }
  }

  public async registerRecentWorkspaceCommands(
    context: vscode.ExtensionContext
  ): Promise<void> {
    //
    console.log(this.recentDisposables);
    console.log("清除之前的命令");

    this.clearRecent();
    console.log(this.recentDisposables);

    // 为每个最近的工作空间注册命令
    for (let i = 0; i < this.recentWorkspaces.length; i++) {
      const workspace = this.recentWorkspaces[i];
      const commandId = `pawsql.recentWorkspace`;

      const disposable = vscode.commands.registerCommand(
        commandId,
        async () => {
          console.log(workspace.workspaceId);

          await this.pawSQLExtension.optimizeSql(workspace.workspaceId);
          console.log("最近工作空间命令已执行");
        }
      );

      this.addRecentDisposable(disposable);
      context.subscriptions.push(disposable);
    }
  }

  public clearRecentWorkspaces(): void {
    this.recentWorkspaces = [];
    this.saveRecentWorkspaces();
    this.clearRecent();
    this.updateWorkspaceContext();
  }

  public getRecentWorkspaces(): WorkspaceItem[] {
    return this.recentWorkspaces;
  }
  private async saveRecentWorkspaces(): Promise<void> {
    console.log("保存最近工作空间");
    console.log(this.recentWorkspaces);

    const configuration = vscode.workspace.getConfiguration("pawsql");
    try {
      await configuration.update(
        "recentWorkspaces",
        this.recentWorkspaces,
        vscode.ConfigurationTarget.Global
      );
    } catch (error) {
      console.error("保存最近工作空间时出错:", error);
    }
  }

  public async loadRecentWorkspaces(): Promise<void> {
    const configuration = vscode.workspace.getConfiguration("pawsql");
    try {
      const recentWorkspaces =
        configuration.get<WorkspaceItem[]>("recentWorkspaces") || [];
      this.recentWorkspaces = recentWorkspaces.slice(
        0,
        this.maxRecentWorkspaces
      ); // 只加载最近一次的工作空间
      await this.updateWorkspaceContext();
    } catch (error) {
      console.error("加载最近工作空间时出错:", error);
    }
  }

  public getLastUsedWorkspace(): WorkspaceItem | null {
    return this.recentWorkspaces.length > 0 ? this.recentWorkspaces[0] : null;
  }
}
