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
    const iconPath = path.join(
      __dirname,
      "../resources/icon/pawsql-black-icon.svg"
    ); // 向上移动到 src 同级

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
  constructor(public readonly type: string) {
    super(
      LanguageService.getMessage(
        type === "workspace" ? "workspaces.isLoading" : "analyses.isLoading"
      ),
      vscode.TreeItemCollapsibleState.None
    );
    this.iconPath = new vscode.ThemeIcon("loading~spin"); // 使用 VS Code 自带的 loading 图标
  }
}

class EmptyItem extends vscode.TreeItem {
  constructor() {
    super(
      LanguageService.getMessage("workspace.has.no.analysis"),
      vscode.TreeItemCollapsibleState.None
    );
    this.iconPath = new vscode.ThemeIcon("info"); // 使用警告图标
  }
}

class WorkspaceItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly workspaceId: string,
    public readonly workspaceName: string,
    public readonly workspaceDefinitionId: string,
    public readonly dbType: string,
    public readonly dbHost: string,
    public readonly dbPort: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.contextValue = "workspaceItem";

    // 先根据数据库类型设置基础图标
    this.iconPath = {
      light: path.join(
        __filename,
        "..",
        "..",
        "resources",
        "icon",
        this.workspaceDefinitionId ? "workspace" : "database",
        `${
          this.workspaceDefinitionId
            ? this.workspaceDefinitionId
            : this.dbType
            ? this.dbType.toLowerCase()
            : "mysql"
        }.svg`
      ),
      dark: path.join(
        __filename,
        "..",
        "..",
        "resources",
        "icon",
        this.workspaceDefinitionId ? "workspace" : "database",
        `${
          this.workspaceDefinitionId
            ? this.workspaceDefinitionId
            : this.dbType
            ? this.dbType.toLowerCase()
            : "mysql"
        }.svg`
      ),
    };

    // 判断是否为默认工作空间
    const defaultWorkspace = vscode.workspace
      .getConfiguration("pawsql")
      .get<{ workspaceId: string }>("defaultWorkspace");

    if (defaultWorkspace?.workspaceId === this.workspaceId) {
      // 如果是默认工作空间,则在数据库图标前添加一个 ThemeIcon
      this.iconPath = new vscode.ThemeIcon("star-full");
    }
  }
}

class AnalysisItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly analysisId: string,
    public readonly workspaceId: string,
    public readonly numberOfQuery: number,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command | undefined
  ) {
    super(label, collapsibleState);
    this.contextValue = "analysisItem";
    this.iconPath = new vscode.ThemeIcon("graph");
    if (numberOfQuery === 1) {
      this.command = command;
    }
  }
}

class StatementItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly statementId: string,
    public readonly analysisId: string,
    public readonly analysisName: string,
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
        this.analysisName,
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
  private workspaceManagerItem: WorkspaceManagerItem =
    new WorkspaceManagerItem();
  private workspaces: WorkspaceItem[] = [];
  private isConfigValid: boolean = false;
  private isWorkspaceLoading: boolean = false;
  private isAnalysisLoading: Map<string, boolean> = new Map();
  // 缓存工作空间和其对应的分析
  private workspaceAnalysisCache: Map<WorkspaceItem, AnalysisItem[]> =
    new Map();
  // 缓存分析和其对应的语句
  private analysisStatementCache: Map<AnalysisItem, StatementItem[]> =
    new Map();

  constructor(private context: vscode.ExtensionContext) {
    // Initialize configuration items
    this.registerProviders();
    this.registerConfigurationChangeListener();
  }

  async refresh(hideMessage?: boolean): Promise<void> {
    this.workspaceAnalysisCache.clear();
    this.analysisStatementCache.clear();
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
      this.workspaceManagerItem = new WorkspaceManagerItem();
      return [this.workspaceManagerItem];
    }

    if (this.isWorkspaceLoading) {
      return [new LoadingItem("workspace")];
    }

    if (this.workspaces.length === 0) {
      return [];
    }

    if (element instanceof WorkspaceManagerItem) {
      return this.workspaces;
    }

    if (element instanceof WorkspaceItem) {
      return await this.getAnalysisItems(element);
    }

    if (element instanceof WorkspaceItem) {
      if (this.isAnalysisLoading.get(element.workspaceId)) {
        return [new LoadingItem("analysis")];
      }
    }

    if (element instanceof WorkspaceItem) {
      return await this.getAnalysisItems(element);
    }

    if (element instanceof AnalysisItem) {
      if (element.numberOfQuery > 1) {
        if (this.analysisStatementCache.has(element)) {
          return this.analysisStatementCache.get(element)!;
        }
        return await this.getStatementItems(element);
      }
    }

    return [];
  }
  // getParent 方法实现
  getParent(element: vscode.TreeItem): vscode.TreeItem | null {
    // 语句项的父节点是对应的分析项
    if (element instanceof StatementItem) {
      for (const [analysis, statements] of this.analysisStatementCache) {
        if (statements.includes(element)) {
          return analysis;
        }
      }
    }

    // 分析项的父节点是对应的工作空间项
    if (element instanceof AnalysisItem) {
      for (const [workspace, analyses] of this.workspaceAnalysisCache) {
        if (analyses.includes(element)) {
          return workspace;
        }
      }
    }

    // 工作空间项的父节点是根节点，返回 null
    if (element instanceof WorkspaceItem) {
      return null;
    }

    return null; // 如果无法确定父节点，返回 null
  }
  async addAnalysisAndStatement(workspaceId: string, analysisId: string) {
    const workspace = this.workspaces.find(
      (item) => item.workspaceId === workspaceId
    );
    if (!workspace) {
      throw Error("workspace.not.exist");
    }

    await this.getAnalysisItems(workspace);

    const analysis = this.workspaceAnalysisCache
      .get(workspace)
      ?.find((item) => item.analysisId === analysisId);

    if (!analysis) {
      throw Error("analysis.not.exist");
    }
    await this.getStatementItems(analysis);
    this._onDidChangeTreeData.fire(undefined);
  }
  // // 自动展开并聚焦到特定语句
  // async revealStatement(statementId: string) {
  //   const statementItem = [...this.analysisStatementCache.values()]
  //     .flat()
  //     .find((statement) => statement.statementId === statementId);

  //   if (statementItem) {
  //     await this.treeView?.reveal(statementItem, { expand: true });
  //   } else {
  //     vscode.window.showErrorMessage("找不到指定的语句。");
  //   }
  // }

  // 自动展开并聚焦到特定语句，同时折叠整个侧边栏
  async revealStatement(statementId: string) {
    const statementItem = [...this.analysisStatementCache.values()]
      .flat()
      .find((statement) => statement.statementId === statementId);

    if (statementItem) {
      //先折叠整个侧边栏，替换 `<viewId>` 为你的视图 ID
      await vscode.commands.executeCommand(
        "workbench.actions.treeView.pawsqlSidebar.collapseAll"
      );
      await this.treeView?.reveal(this.workspaceManagerItem, { expand: true });
      // 展开并聚焦到目标 statementItem
      await this.treeView?.reveal(statementItem, { expand: true });
    } else {
      vscode.window.showErrorMessage("找不到指定的语句。");
    }
  }
  async revealAnalysis(analysisId: string) {
    const analysisItem = [...this.workspaceAnalysisCache.values()]
      .flat()
      .find((analysis) => analysis.analysisId === analysisId);

    if (analysisItem) {
      //先折叠整个侧边栏，替换 `<viewId>` 为你的视图 ID
      await vscode.commands.executeCommand(
        "workbench.actions.treeView.pawsqlSidebar.collapseAll"
      );
      await this.treeView?.reveal(this.workspaceManagerItem, { expand: true });
      // 展开并聚焦到目标 statementItem
      await this.treeView?.reveal(analysisItem, { expand: true });
    } else {
      vscode.window.showErrorMessage("找不到指定的分析。");
    }
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
  public isApiConfigChanged(e: vscode.ConfigurationChangeEvent): boolean {
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
    this.isWorkspaceLoading = true;
    this._onDidChangeTreeData.fire(undefined);

    const apiKey = vscode.workspace
      .getConfiguration("pawsql")
      .get<string>("apiKey");

    try {
      const [workspacesResponse] = await Promise.all([
        ApiService.getWorkspaces(apiKey!),
      ]);

      this.workspaces = workspacesResponse.data.records.map(
        (workspace) =>
          new WorkspaceItem(
            workspace.workspaceName,
            workspace.workspaceId,
            workspace.workspaceName,
            workspace.workspaceDefinitionId,
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
      console.log(1);
      console.log(error);

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
      this.isWorkspaceLoading = false;
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  private async getAnalysisItems(
    workspace: WorkspaceItem
  ): Promise<AnalysisItem[] | EmptyItem[]> {
    this.isAnalysisLoading.set(workspace.workspaceId, true);
    const apiKey = vscode.workspace
      .getConfiguration("pawsql")
      .get<string>("apiKey");

    try {
      const response = await ApiService.getAnalyses(
        apiKey!,
        workspace.workspaceId
      );

      // 如果没有数据，直接返回 EmptyItem
      if (response.data.total === "0") {
        return [new EmptyItem()];
      }

      // 使用 Promise.all 等待所有 async 操作完成
      const commands = await Promise.all(
        response.data.records.map(async (analysis) => {
          let statements: StatementItem[] = [];

          // 使用 await 来简化 then() 的嵌套
          const summary = await ApiService.getAnalysisSummary({
            userKey: apiKey!,
            analysisId: analysis.analysisId,
          });

          statements = summary.data.summaryStatementInfo.map((stmt) => {
            return new StatementItem(
              `${stmt.stmtName}`,
              stmt.analysisStmtId,
              analysis.analysisId,
              analysis.analysisName,
              analysis.workspaceId,
              stmt.stmtText
            );
          });

          if (statements.length > 0) {
            const firstStatement = statements[0];
            return {
              analysisId: firstStatement.analysisId,
              command: "pawsql.showStatementDetail",
              title: LanguageService.getMessage(
                "sidebar.show.statement.detail"
              ),
              arguments: [
                firstStatement.statementId,
                firstStatement.analysisId,
                analysis.analysisName,
                firstStatement.workspaceId,
                firstStatement.sql,
              ],
            };
          }

          return null; // 如果没有 statements, 返回 null
        })
      );

      // 过滤掉 null 的 command
      const validCommands = commands.filter((command) => command !== null);

      // 创建分析项
      const analyses = response.data.records.map(
        (analysis) =>
          new AnalysisItem(
            analysis.analysisName,
            analysis.analysisId,
            workspace.workspaceId,
            analysis.numberOfQuery,
            analysis.numberOfQuery === 1
              ? vscode.TreeItemCollapsibleState.None
              : vscode.TreeItemCollapsibleState.Collapsed,
            analysis.numberOfQuery === 1
              ? validCommands.find(
                  (item) => item && item.analysisId === analysis.analysisId
                ) ?? undefined
              : undefined
          )
      );

      // 缓存分析项
      this.workspaceAnalysisCache.set(workspace, analyses);
      this.isAnalysisLoading.set(workspace.workspaceId, false);
      return analyses;
    } catch (error: any) {
      console.log(2);
      console.log(error);

      vscode.window.showErrorMessage(
        `${LanguageService.getMessage("error.load.data.failed")}: ${
          error.message
        }`
      );
      return []; // 出现错误时返回空数组
    } finally {
      this.isAnalysisLoading.set(workspace.workspaceId, false);
    }
  }

  private async getStatementItems(
    analysis: AnalysisItem
  ): Promise<StatementItem[]> {
    const apiKey = vscode.workspace
      .getConfiguration("pawsql")
      .get<string>("apiKey");

    try {
      const response = await ApiService.getAnalysisSummary({
        userKey: apiKey!,
        analysisId: analysis.analysisId,
      });

      const statements = response.data.summaryStatementInfo.map(
        (stmt: any) =>
          new StatementItem(
            `${stmt.stmtName}`,
            stmt.analysisStmtId,
            analysis.analysisId,
            analysis.label,
            analysis.workspaceId,
            stmt.sql
          )
      );

      // 缓存分析下的语句
      this.analysisStatementCache.set(analysis, statements);
      return statements;
    } catch (error: any) {
      console.log(3);
      console.log(error);
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
          workspace.workspaceDefinitionId,
          workspace.dbType,
          workspace.dbHost,
          workspace.dbPort,
          workspace.collapsibleState
        )
    );

    // 刷新 Tree View
    this._onDidChangeTreeData.fire(undefined);
  }

  async updateApikey(config: {
    email: string;
    password: string;
    backendUrl: string;
    frontendUrl: string;
  }) {
    const apiKey = await ApiService.getUserKey(config.email, config.password);
    console.log(apiKey);
    if (!apiKey) {
      throw Error("error.login.invalidCredentials");
    }
    await vscode.workspace
      .getConfiguration("pawsql")
      .update("apiKey", apiKey, true);

    return apiKey;
  }
}
