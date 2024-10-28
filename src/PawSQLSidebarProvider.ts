import * as vscode from "vscode";
import { ApiService } from "./apiService";

// 工作空间管理器节点
class WorkspaceManagerItem extends vscode.TreeItem {
  constructor() {
    super("工作空间管理器", vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "workspaceManager";
    this.iconPath = new vscode.ThemeIcon("folder");
  }
}

// 工作空间项
class WorkspaceItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly workspaceId: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.contextValue = "workspaceItem";
    this.iconPath = new vscode.ThemeIcon("workspace");
  }
}

// 分析项
class AnalysisItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly analysisId: string,
    public readonly workspaceId: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed); // Changed to Collapsed
    this.contextValue = "analysisItem";
    this.iconPath = new vscode.ThemeIcon("graph");
    // this.command = {
    //   command: "pawsql.showAnalysisDetail",
    //   title: "Show Analysis Detail",
    //   arguments: [this.analysisId, this.workspaceId],
    // };
  }
}

// SQL语句项
class StatementItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly statementId: string,
    public readonly analysisId: string,
    public readonly workspaceId: string,
    public readonly sql: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "statementItem";
    this.iconPath = new vscode.ThemeIcon("symbol-method");
    this.command = {
      command: "pawsql.showStatementDetail",
      title: "Show Statement Detail",
      arguments: [
        this.statementId,
        this.analysisId,
        this.workspaceId,
        this.sql,
      ],
    };
    this.tooltip = this.sql; // 悬停显示SQL语句
  }
}

// 配置项和验证项保持不变...
class ConfigurationItem extends vscode.TreeItem {
  constructor(private config: "apiKey" | "url.frontendUrl" | "url.backendUrl") {
    super(
      config === "apiKey"
        ? "API Key"
        : config === "url.frontendUrl"
        ? "Frontend URL"
        : "Backend URL",
      vscode.TreeItemCollapsibleState.None
    );

    const currentValue = vscode.workspace
      .getConfiguration("pawsql")
      .get<string>(`${config}`);

    this.description = currentValue ? "已配置" : "未配置";
    this.contextValue = "configItem";
    this.iconPath = new vscode.ThemeIcon(currentValue ? "check" : "warning");
    this.command = {
      command: "pawsql.showConfigInput",
      title: "Configure",
      arguments: [this.config],
    };
  }
}

class ValidateConfigItem extends vscode.TreeItem {
  constructor() {
    super("验证配置", vscode.TreeItemCollapsibleState.None);
    this.contextValue = "validateItem";
    this.iconPath = new vscode.ThemeIcon("verify");
    this.command = {
      command: "pawsql.validateConfig",
      title: "Validate Configuration",
    };
  }
}

export class PawSQLTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined
  > = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined> =
    this._onDidChangeTreeData.event;

  private workspaces: WorkspaceItem[] = [];
  private isConfigValid: boolean = false;
  private statementsCache: Map<string, StatementItem[]> = new Map(); // 缓存语句数据

  constructor(private context: vscode.ExtensionContext) {
    this.validateConfiguration();
  }

  async refresh(): Promise<void> {
    this.statementsCache.clear();
    await this.validateConfiguration();
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      return [new WorkspaceManagerItem()];
    }

    if (element instanceof WorkspaceManagerItem) {
      if (!this.isConfigValid) {
        return [
          new ConfigurationItem("apiKey"),
          new ConfigurationItem("url.frontendUrl"),
          new ConfigurationItem("url.backendUrl"),
          new ValidateConfigItem(),
        ];
      }
      return this.workspaces;
    }

    if (element instanceof WorkspaceItem) {
      return this.getAnalysisItems(element.workspaceId);
    }

    if (element instanceof AnalysisItem) {
      return this.getStatementItems(element.analysisId, element.workspaceId);
    }

    return [];
  }

  private async validateConfiguration(): Promise<void> {
    const config = vscode.workspace.getConfiguration("pawsql");
    const apiKey = config.get<string>("apiKey");
    const frontendUrl = config.get<string>("url.frontendUrl");
    const backendUrl = config.get<string>("url.backendUrl");

    this.isConfigValid = Boolean(apiKey && frontendUrl && backendUrl);

    if (this.isConfigValid) {
      try {
        // 尝试调用 API 进行实际验证
        await this.loadWorkspaces();
      } catch (error: any) {
        this.isConfigValid = false;
        vscode.window.showErrorMessage(`配置验证失败: ${error.message}`);
      }
    } else {
      // 如果配置不完整，清空工作空间列表
      this.workspaces = [];
    }
  }

  async loadWorkspaces(): Promise<void> {
    if (!this.isConfigValid) {
      this.workspaces = [];
      return;
    }

    const apiKey = vscode.workspace
      .getConfiguration("pawsql")
      .get<string>("apiKey");

    try {
      const response = await ApiService.getWorkspaces(apiKey!);
      this.workspaces = response.data.records.map(
        (workspace: any) =>
          new WorkspaceItem(
            workspace.workspaceName,
            workspace.workspaceId,
            vscode.TreeItemCollapsibleState.Collapsed
          )
      );
    } catch (error: any) {
      this.isConfigValid = false; // API 调用失败时也将配置标记为无效
      vscode.window.showErrorMessage(`加载工作空间失败: ${error.message}`);
      this.workspaces = [];
    }
  }

  private async getAnalysisItems(workspaceId: string): Promise<AnalysisItem[]> {
    const apiKey = vscode.workspace
      .getConfiguration("pawsql")
      .get<string>("apiKey");

    try {
      const response = await ApiService.getAnalyses(
        apiKey!,
        workspaceId,
        1,
        10
      );

      return response.data.records.map(
        (analysis: any) =>
          new AnalysisItem(
            analysis.analysisName,
            analysis.analysisId,
            workspaceId
          )
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(`加载分析列表失败: ${error.message}`);
      return [];
    }
  }

  private async getStatementItems(
    analysisId: string,
    workspaceId: string
  ): Promise<StatementItem[]> {
    // 检查缓存
    const cacheKey = `${analysisId}-${workspaceId}`;
    if (this.statementsCache.has(cacheKey)) {
      return this.statementsCache.get(cacheKey)!;
    }

    const apiKey = vscode.workspace
      .getConfiguration("pawsql")
      .get<string>("apiKey");

    try {
      const response = await ApiService.getAnalysisSummary({
        userKey: apiKey!,
        analysisId: analysisId,
      });

      const statements = response.data.summaryStatementInfo.map(
        (stmt: any) =>
          new StatementItem(
            `语句 ${stmt.analysisStmtId}`,
            stmt.analysisStmtId,
            analysisId,
            workspaceId,
            stmt.sql
          )
      );

      // 存入缓存
      this.statementsCache.set(cacheKey, statements);
      return statements;
    } catch (error: any) {
      vscode.window.showErrorMessage(`加载语句列表失败: ${error.message}`);
      return [];
    }
  }

  async updateConfig(key: string, value: string): Promise<void> {
    await vscode.workspace.getConfiguration("pawsql").update(key, value, true);
    await this.refresh(); // 使用 await 确保配置验证完成
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.validateConfiguration();
      if (this.isConfigValid) {
        vscode.window.showInformationMessage("配置验证成功！");
        await this.refresh();
        return true;
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`配置验证失败: ${error.message}`);
    }
    return false;
  }
}
