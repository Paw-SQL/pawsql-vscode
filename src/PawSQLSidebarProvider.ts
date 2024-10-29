import * as vscode from "vscode";
import { ApiService } from "./apiService";
import { LanguageService } from "./LanguageService";

// Previous classes remain unchanged...
class WorkspaceManagerItem extends vscode.TreeItem {
  constructor() {
    super("工作空间管理器", vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "workspaceManager";
    this.iconPath = new vscode.ThemeIcon("folder");
  }
}

class WorkspaceItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly workspaceId: string,
    public readonly workspaceName: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.contextValue = "workspaceItem";

    // 从配置中读取默认工作空间
    const defaultWorkspace = vscode.workspace
      .getConfiguration("pawsql")
      .get<{ workspaceId: string }>("defaultWorkspace");

    // 根据是否为默认工作空间设置图标
    this.iconPath = new vscode.ThemeIcon(
      defaultWorkspace?.workspaceId === workspaceId ? "star-full" : "workspace"
    );
    // 将 workspaceId 作为参数传入命令
    this.command = {
      command: "pawsql.setDefaultWorkspace",
      title: "Set Default Workspace",
    };
  }
}

class AnalysisItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly analysisId: string,
    public readonly workspaceId: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "analysisItem";
    this.iconPath = new vscode.ThemeIcon("graph");
  }
}

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
    this.tooltip = this.sql;
  }
}

// Optimized ConfigurationItem class
class ConfigurationItem extends vscode.TreeItem {
  constructor(
    public readonly config: "apiKey" | "url.frontendUrl" | "url.backendUrl",
    public isValid: boolean = false
  ) {
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
    this.updateIconPath();

    this.command = {
      command: "pawsql.showConfigInput",
      title: "Configure",
      arguments: [this.config],
    };
  }

  public updateIconPath() {
    this.iconPath = new vscode.ThemeIcon(this.isValid ? "check" : "warning");
  }

  public setValidationState(isValid: boolean) {
    this.isValid = isValid;
    this.updateIconPath();
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
  private statementsCache: Map<string, StatementItem[]> = new Map();
  private configItems: Map<string, ConfigurationItem> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    // Initialize configuration items
    this.configItems.set("apiKey", new ConfigurationItem("apiKey"));
    this.configItems.set(
      "url.frontendUrl",
      new ConfigurationItem("url.frontendUrl")
    );
    this.configItems.set(
      "url.backendUrl",
      new ConfigurationItem("url.backendUrl")
    );
    this.refresh(true);
  }

  async refresh(hideMessage?: boolean): Promise<void> {
    this.statementsCache.clear();
    await this.validateConfiguration(hideMessage);
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
          this.configItems.get("url.backendUrl")!,
          this.configItems.get("url.frontendUrl")!,
          this.configItems.get("apiKey")!,
          new ValidateConfigItem(),
        ];
      }
      return this.workspaces;
    }

    if (element instanceof WorkspaceItem) {
      return await this.getAnalysisItems(element.workspaceId);
    }

    if (element instanceof AnalysisItem) {
      return await this.getStatementItems(
        element.analysisId,
        element.workspaceId
      );
    }

    return [];
  }

  public async validateConfiguration(hideMessage?: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration("pawsql");
    const apiKey = config.get<string>("apiKey");
    const frontendUrl = config.get<string>("url.frontendUrl");
    const backendUrl = config.get<string>("url.backendUrl");

    this.isConfigValid = Boolean(apiKey && frontendUrl && backendUrl);

    if (this.isConfigValid) {
      try {
        // Validate backend connectivity first
        const isBackendConnected = await ApiService.checkConnectivity(
          backendUrl!
        );
        this.configItems
          .get("url.backendUrl")
          ?.setValidationState(isBackendConnected);
        this._onDidChangeTreeData.fire(undefined);

        if (!isBackendConnected) {
          this.isConfigValid = false;
          vscode.window.showErrorMessage(
            `配置验证失败: ${LanguageService.getMessage(
              "error.backendUrl.invalid"
            )}`
          );
          return;
        }

        // Then validate frontend connectivity
        const isFrontendConnected = await ApiService.checkConnectivity(
          frontendUrl!
        );
        this.configItems
          .get("url.frontendUrl")
          ?.setValidationState(isFrontendConnected);
        this._onDidChangeTreeData.fire(undefined);

        if (!isFrontendConnected) {
          this.isConfigValid = false;
          vscode.window.showErrorMessage(
            `配置验证失败: ${LanguageService.getMessage(
              "error.frontendUrl.invalid"
            )}`
          );
          return;
        }

        // Finally validate API key
        const isApikeyValid = await ApiService.validateUserKey(apiKey ?? "");
        this.configItems.get("apiKey")?.setValidationState(isApikeyValid);
        this._onDidChangeTreeData.fire(undefined);

        if (!isApikeyValid) {
          this.isConfigValid = false;
          vscode.window.showErrorMessage(
            `Apikey验证失败: ${LanguageService.getMessage(
              "license.code.not.valid"
            )}`
          );
          return;
        }
        !hideMessage && vscode.window.showInformationMessage("配置验证成功！");
        // If all validations pass, load the workspace data
        await this.loadData();
      } catch (error: any) {
        this.isConfigValid = false;
        vscode.window.showErrorMessage(
          `配置验证失败: ${LanguageService.getMessage(
            error.response?.data?.message ?? ""
          )}`
        );
      }
    } else {
      vscode.window.showErrorMessage(`配置验证失败`);
    }
  }

  // Rest of the methods remain unchanged...
  private async loadData(): Promise<void> {
    const apiKey = vscode.workspace
      .getConfiguration("pawsql")
      .get<string>("apiKey");

    try {
      const [workspacesResponse, analysesResponse] = await Promise.all([
        ApiService.getWorkspaces(apiKey!),
        ApiService.getAnalyses(apiKey!, "", 1, 10),
      ]);

      this.workspaces = workspacesResponse.data.records.map(
        (workspace: any) =>
          new WorkspaceItem(
            workspace.workspaceName,
            workspace.workspaceId,
            workspace.workspaceName,
            vscode.TreeItemCollapsibleState.Collapsed
          )
      );
    } catch (error: any) {
      console.log(error);
      if (error.code === "ECONNREFUSED") {
        vscode.window.showErrorMessage(
          `配置验证失败: ${LanguageService.getMessage(
            "error.backendUrl.invalid"
          )}`
        );
      } else {
        vscode.window.showErrorMessage(
          `加载数据失败: ${LanguageService.getMessage(
            error.response?.data?.message ?? ""
          )}`
        );
      }
      this.isConfigValid = false;
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

      this.statementsCache.set(cacheKey, statements);
      return statements;
    } catch (error: any) {
      vscode.window.showErrorMessage(`加载语句列表失败: ${error.message}`);
      return [];
    }
  }

  async updateConfig(key: string, value: string): Promise<void> {
    await vscode.workspace.getConfiguration("pawsql").update(key, value, true);
    await this.refresh();
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

  async setDefaultWorkspace(
    workspaceName: string,
    workspaceId: string
  ): Promise<void> {
    // 更新配置中的默认工作空间项
    await vscode.workspace.getConfiguration("pawsql").update(
      "defaultWorkspace",
      {
        workspaceId,
        workspaceName,
      },
      vscode.ConfigurationTarget.Global
    );

    // 重新生成工作空间项，以应用新的图标状态
    this.workspaces = this.workspaces.map(
      (workspace) =>
        new WorkspaceItem(
          workspace.label,
          workspace.workspaceId,
          workspace.workspaceName,
          workspace.collapsibleState
        )
    );

    // 刷新 Tree View
    this._onDidChangeTreeData.fire(undefined);
  }
}
