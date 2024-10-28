import * as vscode from "vscode";
import { ApiService } from "./apiService";

// 定义工作空间项
class WorkspaceItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }

  contextValue = "workspaceItem"; // 上下文值
}

// 定义配置项
class ConfigureItem extends vscode.TreeItem {
  constructor() {
    super("Configure PawSQL", vscode.TreeItemCollapsibleState.None);
    this.command = {
      command: "pawsql.openSettings", // 绑定命令
      title: "Configure PawSQL",
    };
    this.tooltip = "Click to configure PawSQL settings.";
  }

  contextValue = "configureItem"; // 上下文值
}

// PawSQL Tree Provider
export class PawSQLTreeProvider
  implements vscode.TreeDataProvider<WorkspaceItem | ConfigureItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    WorkspaceItem | ConfigureItem | undefined
  > = new vscode.EventEmitter<WorkspaceItem | ConfigureItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<
    WorkspaceItem | ConfigureItem | undefined
  > = this._onDidChangeTreeData.event;

  private workspaces: WorkspaceItem[] = []; // 存储工作空间项

  constructor() {
    this.loadWorkspaces(); // 初始化时加载工作空间
  }

  // 刷新树视图
  refresh() {
    this.loadWorkspaces(); // 重新加载工作空间
    this._onDidChangeTreeData.fire(undefined); // 通知树视图更新
  }

  async loadWorkspaces() {
    const apiKey = vscode.workspace.getConfiguration("pawsql").get("apiKey");
    const backendUrl = vscode.workspace
      .getConfiguration("pawsql")
      .get("url.backendUrl");

    if (!apiKey || !backendUrl) {
      // 如果 API Key 或 Backend URL 没有设置，添加配置项
      this._onDidChangeTreeData.fire(new ConfigureItem());
      return; // 终止加载
    }

    try {
      const response = await ApiService.getWorkspaces(apiKey as string); // 获取工作空间
      this.workspaces = response.data.records.map(
        (workspace) =>
          new WorkspaceItem(
            workspace.workspaceName,
            vscode.TreeItemCollapsibleState.Collapsed
          )
      );
      this._onDidChangeTreeData.fire(undefined); // 更新树视图
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Error fetching workspaces: ${error.message}`
      );
    }
  }

  // 获取树视图中的项
  getTreeItem(element: WorkspaceItem | ConfigureItem): vscode.TreeItem {
    return element;
  }

  // 获取子项
  getChildren(
    element?: WorkspaceItem | ConfigureItem
  ): Thenable<(WorkspaceItem | ConfigureItem)[]> {
    if (element instanceof ConfigureItem) {
      return Promise.resolve([]); // 如果是配置项，则没有子项
    }

    if (element) {
      // 如果有父项，返回其子项（如优化列表）
      return this.getOptimizationsForWorkspace(element.label);
    } else {
      // 如果没有父项，返回工作空间列表
      return Promise.resolve(
        this.workspaces.length > 0 ? this.workspaces : [new ConfigureItem()]
      );
    }
  }

  // 获取某个工作空间的优化列表
  private async getOptimizationsForWorkspace(
    workspaceName: string
  ): Promise<WorkspaceItem[]> {
    const apiKey = vscode.workspace.getConfiguration("pawsql").get("apiKey");
    const optimizations: WorkspaceItem[] = [];

    if (!apiKey) {
      vscode.window.showErrorMessage("API Key is not set.");
      return optimizations; // 返回空数组
    }

    try {
      const response = await ApiService.getAnalyses(
        apiKey as string,
        workspaceName,
        1,
        10
      ); // 假设获取第一页的数据
      response.data.records.forEach((analysis: any) => {
        optimizations.push(
          new WorkspaceItem(
            analysis.workspaceName,
            vscode.TreeItemCollapsibleState.None
          )
        ); // 添加分析项
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Error fetching optimizations for workspace "${workspaceName}": ${error.message}`
      );
    }

    return optimizations;
  }
}
