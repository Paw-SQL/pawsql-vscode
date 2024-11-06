import * as vscode from "vscode";
import {
  ApiService,
  validateBackend,
  validateFrontend,
  validateUserKey,
} from "./apiService";
import { LanguageService } from "./LanguageService";
import * as path from "path";
import { getUrls } from "./constants";

// Previous classes remain unchanged...
class WorkspaceManagerItem extends vscode.TreeItem {
  constructor() {
    const iconPath = path.join(__dirname, "../resources/icon/paw.svg"); // 向上移动到 src 同级

    super(
      // LanguageService.getMessage("sidebar.workspace.manager"),
      LanguageService.getMessage(
        getUrls().DOMAIN.Backend ?? "sidebar.workspace.manager"
      ),

      vscode.TreeItemCollapsibleState.Expanded
    );
    this.contextValue = "workspaceManager";
    this.iconPath = vscode.Uri.file(iconPath);
  }
}

// 定义 LoadingItem，设置加载图标
class LoadingItem extends vscode.TreeItem {
  constructor() {
    super(
      LanguageService.getMessage("workspace.isLoading"),
      vscode.TreeItemCollapsibleState.None
    );
    this.iconPath = new vscode.ThemeIcon("loading~spin"); // 使用 VS Code 自带的 loading 图标
  }
}

class WorkspaceItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly workspaceId: string,
    public readonly workspaceName: string,
    public readonly dbType: string,
    public readonly dbHost: string,
    public readonly dbPort: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.contextValue = "workspaceItem";

    // 根据是否为默认工作空间设置图标
    this.label = this.dbHost
      ? `${this.dbType}:${this.dbHost}@${this.dbPort}`
      : `${this.dbType}:${this.workspaceName}`;

    // 从配置中读取默认工作空间
    const defaultWorkspace = vscode.workspace
      .getConfiguration("pawsql")
      .get<{ workspaceId: string }>("defaultWorkspace");

    // 根据是否为默认工作空间设置图标
    this.iconPath = new vscode.ThemeIcon(
      defaultWorkspace?.workspaceId === workspaceId ? "star-full" : "workspace"
    );
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
      title: LanguageService.getMessage("sidebar.show.statement.detail"),
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

export class PawSQLTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined
  > = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined> =
    this._onDidChangeTreeData.event;
  private treeView: vscode.TreeView<vscode.TreeItem> | undefined; // 用于管理树视图

  private workspaces: WorkspaceItem[] = [];
  private isConfigValid: boolean = false;
  private isLoading: boolean = false;
  private statementsCache: Map<string, StatementItem[]> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    // Initialize configuration items
    this.registerProviders();
    this.registerConfigurationChangeListener();
  }

  async refresh(hideMessage?: boolean): Promise<void> {
    this.statementsCache.clear();
    if (this.treeView) {
      await this.validateConfiguration(hideMessage);
      this._onDidChangeTreeData.fire(undefined);
    }
  }
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!this.isConfigValid && !element) {
      return [];
    }

    if (!element) {
      return [new WorkspaceManagerItem()];
    }

    if (this.isLoading) {
      return [new LoadingItem()];
    }

    if (this.workspaces.length === 0) {
      return [];
    }

    if (element instanceof WorkspaceManagerItem) {
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
    const frontendUrl = config.get<string>("frontendUrl");
    const backendUrl = config.get<string>("backendUrl");

    try {
      // Reset all validation states first
      this.isConfigValid = false;

      // Validate backend connectivity

      const backendResult = await validateBackend(backendUrl ?? "");
      const isBackendConnected = backendResult.isAvailable;

      if (!isBackendConnected) {
        !hideMessage &&
          vscode.window.showErrorMessage(
            `${LanguageService.getMessage(
              "error.config.validate.failed"
            )}: ${LanguageService.getMessage("error.backendUrl.invalid")}`
          );
        return;
      }

      // Validate frontend connectivity
      const frontendReuslt = await validateFrontend(frontendUrl ?? "");

      const isFrontendConnected = frontendReuslt.isAvailable;

      if (!isFrontendConnected) {
        !hideMessage &&
          vscode.window.showErrorMessage(
            `${LanguageService.getMessage(
              "error.config.validate.failed"
            )}: ${LanguageService.getMessage("error.frontendUrl.invalid")}`
          );
        return;
      }

      // Validate API key
      const isApikeyValid = await ApiService.validateUserKey(apiKey ?? "");

      if (!isApikeyValid) {
        !hideMessage &&
          vscode.window.showErrorMessage(
            `${LanguageService.getMessage(
              "error.config.validate.failed"
            )}: ${LanguageService.getMessage("license.code.not.valid")}`
          );
        return;
      }

      // All validations passed
      !hideMessage &&
        vscode.window.showInformationMessage(
          LanguageService.getMessage("error.config.validate.success")
        );

      this.isConfigValid = true;
      vscode.commands.executeCommand(
        "setContext",
        "isConfigured",
        this.isConfigValid
      );
      await this.loadData(hideMessage);
    } catch (error: any) {
      this.isConfigValid = false;
      vscode.commands.executeCommand(
        "setContext",
        "isConfigured",
        this.isConfigValid
      );
      !hideMessage &&
        vscode.window.showErrorMessage(
          `${LanguageService.getMessage(
            "error.config.validate.failed"
          )}: ${LanguageService.getMessage(
            error.response?.data?.message ?? ""
          )}`
        );
    }
  }

  private async registerProviders(): Promise<void> {
    // 1. 创建树视图（如果不存在）
    if (!this.treeView) {
      this.treeView = vscode.window.createTreeView("pawsqlSidebar", {
        treeDataProvider: this,
        showCollapseAll: true,
      });
      this.context.subscriptions.push(this.treeView);
    }

    // 2. 验证配置
    const isConfigValid = await this.validateConfig();
    this.isConfigValid = isConfigValid;
    vscode.commands.executeCommand(
      "setContext",
      "isConfigured",
      this.isConfigValid
    );

    // 4. 刷新视图
    this.refresh(true);
  }

  private registerConfigurationChangeListener(): void {
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (this.isApiConfigChanged(event)) {
        await this.registerProviders();
      }
    });
  }
  private isApiConfigChanged(e: vscode.ConfigurationChangeEvent): boolean {
    return (
      e.affectsConfiguration("pawsql.apiKey") ||
      e.affectsConfiguration("pawsql.frontendUrl") ||
      e.affectsConfiguration("pawsql.backendUrl")
    );
  }
  public async validateConfig(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration("pawsql");
    const apiKey = config.get<string>("apiKey");
    const frontendUrl = config.get<string>("frontendUrl");
    const backendUrl = config.get<string>("backendUrl");
    let failedCommand = [];
    try {
      const backendResult = await validateBackend(backendUrl ?? "");
      const isBackendConnected = backendResult.isAvailable;
      if (!isBackendConnected) {
        failedCommand.push(
          LanguageService.getMessage("sidebar.backendUrl.label")
        );
      }

      // Validate frontend connectivity
      const frontendReuslt = await validateFrontend(frontendUrl ?? "");
      const isFrontendConnected = frontendReuslt.isAvailable;
      if (!isFrontendConnected) {
        failedCommand.push(
          LanguageService.getMessage("sidebar.frontendUrl.label")
        );
      }

      // Validate API key
      const isApikeyValid = await validateUserKey(apiKey ?? "");
      if (!isFrontendConnected) {
        failedCommand.push(LanguageService.getMessage("sidebar.apiKey.label"));
      }

      if (!(isBackendConnected && isFrontendConnected && isApikeyValid)) {
        const choice = await vscode.window.showErrorMessage(
          LanguageService.getMessage("pawsql.config.validate.failed") +
            `${
              failedCommand.length === 0 ? "" : `: ${failedCommand.join(",")}`
            }`,
          LanguageService.getMessage("init.pawsql.config")
        );
        if (choice === LanguageService.getMessage("init.pawsql.config")) {
          vscode.commands.executeCommand("pawsql.openSettings");
        }
      }
      return isBackendConnected && isFrontendConnected && isApikeyValid;
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `${LanguageService.getMessage(
          "error.config.validate.failed"
        )}: ${LanguageService.getMessage(error.response?.data?.message ?? "")}`
      );
      return false;
    }
  }

  public async validateConfigurationByKey(key: string): Promise<void> {
    const config = vscode.workspace.getConfiguration("pawsql");
    const value = config.get<string>(key);
    try {
      if (key === "backendUrl") {
        // Validate backend connectivity
        const backendResult = await validateBackend(value ?? "");
        const isBackendConnected = backendResult.isAvailable;
        if (!isBackendConnected) {
          vscode.window.showErrorMessage(
            `${LanguageService.getMessage(
              "error.config.validate.failed"
            )}: ${LanguageService.getMessage("error.backendUrl.invalid")}`
          );
          this.isConfigValid = false;
          vscode.commands.executeCommand(
            "setContext",
            "isConfigured",
            this.isConfigValid
          );
        }
      } else if (key === "frontendUrl") {
        // Validate frontend connectivity
        const frontendReuslt = await validateFrontend(value ?? "");
        const isFrontendConnected = frontendReuslt.isAvailable;

        if (!isFrontendConnected) {
          vscode.window.showErrorMessage(
            `${LanguageService.getMessage(
              "error.config.validate.failed"
            )}: ${LanguageService.getMessage("error.frontendUrl.invalid")}`
          );
          this.isConfigValid = false;
          vscode.commands.executeCommand(
            "setContext",
            "isConfigured",
            this.isConfigValid
          );
        }
      } else if (key === "apiKey") {
        // Validate API key
        const isApikeyValid = await ApiService.validateUserKey(value ?? "");
        if (!isApikeyValid) {
          vscode.window.showErrorMessage(
            `${LanguageService.getMessage(
              "error.config.validate.failed"
            )}: ${LanguageService.getMessage("license.code.not.valid")}`
          );
          this.isConfigValid = false;
          vscode.commands.executeCommand(
            "setContext",
            "isConfigured",
            this.isConfigValid
          );
        }
      }
    } catch (error: any) {
      this.workspaces = [];
      vscode.window.showErrorMessage(
        `${LanguageService.getMessage(
          "error.config.validate.failed"
        )}: ${LanguageService.getMessage(error.response?.data?.message ?? "")}`
      );
      this.isConfigValid = false;
      vscode.commands.executeCommand(
        "setContext",
        "isConfigured",
        this.isConfigValid
      );
    }
  }

  // Rest of the methods remain unchanged...
  private async loadData(hideMessage?: boolean): Promise<void> {
    this.isLoading = true;
    this._onDidChangeTreeData.fire(undefined);

    const apiKey = vscode.workspace
      .getConfiguration("pawsql")
      .get<string>("apiKey");

    try {
      const [workspacesResponse] = await Promise.all([
        ApiService.getWorkspaces(apiKey!),
      ]);

      this.workspaces = workspacesResponse.data.records.map(
        (workspace: any) =>
          new WorkspaceItem(
            workspace.workspaceName,
            workspace.workspaceId,
            workspace.workspaceName,
            workspace.dbType,
            workspace.dbHost,
            workspace.dbPort,
            vscode.TreeItemCollapsibleState.Collapsed
          )
      );
      vscode.commands.executeCommand(
        "setContext",
        "hasNoWorkspace",
        this.workspaces.length === 0
      );
    } catch (error: any) {
      if (error.code === "ECONNREFUSED") {
        !hideMessage &&
          vscode.window.showErrorMessage(
            `${LanguageService.getMessage(
              "error.config.validate.failed"
            )}: ${LanguageService.getMessage("error.backendUrl.invalid")}`
          );
      } else {
        !hideMessage &&
          vscode.window.showErrorMessage(
            `${LanguageService.getMessage(
              "error.load.data.failed"
            )}: ${LanguageService.getMessage(
              error.response?.data?.message ?? ""
            )}`
          );
      }
      this.isConfigValid = false;
      vscode.commands.executeCommand(
        "setContext",
        "isConfigured",
        this.isConfigValid
      );
      this.workspaces = [];
    } finally {
      this.isLoading = false;
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  private async getAnalysisItems(workspaceId: string): Promise<AnalysisItem[]> {
    const apiKey = vscode.workspace
      .getConfiguration("pawsql")
      .get<string>("apiKey");

    try {
      const response = await ApiService.getAnalyses(apiKey!, workspaceId);

      return response.data.records.map(
        (analysis: any) =>
          new AnalysisItem(
            analysis.analysisName,
            analysis.analysisId,
            workspaceId
          )
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `${LanguageService.getMessage("error.load.data.failed")}: ${
          error.message
        }`
      );
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
            `${stmt.stmtName}`,
            stmt.analysisStmtId,
            analysisId,
            workspaceId,
            stmt.sql
          )
      );

      this.statementsCache.set(cacheKey, statements);
      return statements;
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `${LanguageService.getMessage("error.load.data.failed")}: ${
          error.message
        }`
      );
      return [];
    }
  }

  async updateConfig(key: string, value: string): Promise<void> {
    await vscode.workspace.getConfiguration("pawsql").update(key, value, true);
    await this.validateConfigurationByKey(key);
  }

  async setDefaultWorkspace(
    workspaceId: string,
    workspaceName: string,
    dbType: string,
    dbHost: string,
    dbPort: string
  ): Promise<void> {
    // 更新配置中的默认工作空间项
    await vscode.workspace.getConfiguration("pawsql").update(
      "defaultWorkspace",
      {
        workspaceId,
        workspaceName,
        dbType,
        dbHost,
        dbPort,
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
          workspace.dbType,
          workspace.dbHost,
          workspace.dbPort,
          workspace.collapsibleState
        )
    );

    // 刷新 Tree View
    this._onDidChangeTreeData.fire(undefined);
  }
}
