import * as vscode from "vscode";
import { Selection } from "vscode";

import { PawSQLTreeProvider } from "./PawSQLSidebarProvider";
import {
  registerSqlCodeLensProvider,
  SqlCodeLensProvider,
} from "./SqlCodeLensProvider";
import { COMMANDS, CONTEXTS, UI_MESSAGES, getUrls } from "./constants";
import { DecorationManager } from "./DecorationManager";
import { CommandManager } from "./CommandManager";
import type { WorkspaceItem, SummaryResponse } from "./types";
import { getEditorQueryDetails } from "./utils/pawsqlUtils";
import { LanguageService } from "./LanguageService";
import { WorkspaceManager } from "./workspaceManager";
import { ConfigurationService } from "./configurationService";
import { ErrorHandler } from "./errorHandler";
import { OptimizationService } from "./optimizationService";
import { WebviewProvider } from "./webviewProvider";
import { ApiService } from "./apiService";
import path from "path";

export class PawSQLExtension {
  private readonly workspaceManager: WorkspaceManager;
  private readonly decorationManager: DecorationManager;
  private readonly commandManager: CommandManager;
  private readonly sqlCodeLensProvider: SqlCodeLensProvider;
  private readonly webviewProvider: WebviewProvider;
  private treeProvider: PawSQLTreeProvider | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {
    // 初始化管理器和提供者
    this.workspaceManager = new WorkspaceManager(this);
    this.webviewProvider = new WebviewProvider(context);
    this.decorationManager = new DecorationManager(context);
    this.sqlCodeLensProvider = registerSqlCodeLensProvider(context);

    this.commandManager = new CommandManager(
      this,
      context,
      this.sqlCodeLensProvider
    );
  }

  public async activate(): Promise<void> {
    try {
      await this.registerSettingsWebview();
      await this.initializeExtension();
      await this.registerProviders();
      await this.registerEventListeners();
    } catch (error) {
      ErrorHandler.handle("extension.activation.failed", error);
    }
  }

  private async registerSettingsWebview() {
    let disposable = vscode.commands.registerCommand(
      "vscode-webview-react.showWebview",
      () => {
        this.webviewProvider.createSettingsPanel();
      }
    );

    this.context.subscriptions.push(disposable);
  }

  private async initializeExtension(): Promise<void> {
    // 初始化语言服务
    LanguageService.loadLanguage(vscode.env.language);

    // 初始化API密钥和上下文
    const apiKey = await ConfigurationService.getApiKey();
    await this.setApiKeyContext(apiKey);

    // 初始化命令
    await this.commandManager.initializeCommands(apiKey);

    // 更新工作空间上下文
    await this.updateWorkspaceContext();
  }

  private registerEventListeners(): void {
    // 注册配置变更事件
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(
        this.handleConfigurationChange.bind(this)
      )
    );

    // 注册配置输入命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "pawsql.showConfigInput",
        async (configKey: string, label: string) => {
          const result = await vscode.window.showInputBox({
            prompt: `${LanguageService.getMessage(
              "please.enter"
            )} ${LanguageService.getMessage(label)}`,
            password: configKey === "apiKey",
            value: vscode.workspace.getConfiguration("pawsql").get(configKey),
          });

          if (result !== undefined) {
            this.treeProvider &&
              (await this.treeProvider.updateConfig(configKey, result));
          }
        }
      )
    );

    // 注册验证配置命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand("pawsql.validateConfig", async () => {
        this.treeProvider && (await this.treeProvider.validateConfiguration());
      })
    );

    // 注册显示语句详情命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "pawsql.showStatementDetail",
        async (statementId: string) => {
          await this.showStatementResult(statementId);
        }
      )
    );
    // 注册刷新命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand("pawsql.refreshTree", () => {
        this.treeProvider && this.treeProvider.refresh();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand("pawsql.createWorkspace", () => {
        this.openBrowserCreateWorkspace();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "pawsql.setDefaultWorkspace",
        (item: WorkspaceItem) => {
          this.treeProvider &&
            this.treeProvider.setDefaultWorkspace(
              item.workspaceId,
              item.workspaceName,
              item.dbType,
              item.dbHost,
              item.dbPort
            );
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        COMMANDS.OPTIMIZE_WITH_FILE_DEFAULT_WORKSPACE,
        this.optimizeSQLWithButton.bind(this)
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "pawsql.optimizeWithSelectedWorkspace",
        this.handleWorkspaceSelectionWithRangeQuery.bind(this)
      )
    );

    // 注册编辑器事件
    this.decorationManager.registerDecorationListeners();
  }

  public async handleWorkspaceSelectionWithRangeQuery(
    query: string,
    range: vscode.Range
  ): Promise<void> {
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    );
    statusBarItem.text = UI_MESSAGES.QUERYING_WORKSPACES();
    statusBarItem.show();

    try {
      const apiKey = await ConfigurationService.getApiKey();

      const workspaces = await ApiService.getWorkspaces(apiKey ?? "");
      if (workspaces.data.total === "0") {
        await this.commandManager.handleEmptyWorkspaces();
        return;
      }

      const workspaceItems =
        this.commandManager.createWorkspaceItems(workspaces);
      const selected = await this.commandManager.showWorkspaceQuickPick(
        workspaceItems
      );

      if (selected) {
        await this.optimizeSQLWithButton(query, selected.workspaceId, range);
      }
    } catch (error) {
      ErrorHandler.handle("workspace.operation.failed", error);
    } finally {
      statusBarItem.dispose();
    }
  }

  private async openBrowserCreateWorkspace(): Promise<void> {
    const { URLS } = getUrls();
    await vscode.env.openExternal(vscode.Uri.parse(URLS.NEW_WORKSPACE));
  }
  private async showStatementResult(analysisStmtId: string): Promise<void> {
    this.webviewProvider.createResultPanel(analysisStmtId);
  }

  private registerProviders(): void {
    // 注册树视图
    this.treeProvider = new PawSQLTreeProvider(this.context);

    const treeView = vscode.window.createTreeView("pawsqlSidebar", {
      treeDataProvider: this.treeProvider,
      showCollapseAll: true,
    });

    this.context.subscriptions.push(treeView);
  }

  private async handleConfigurationChange(
    e: vscode.ConfigurationChangeEvent
  ): Promise<void> {
    try {
      if (this.isApiConfigChanged(e)) {
        await this.workspaceManager.clearRecentWorkspaces();
        this.treeProvider && (await this.treeProvider.refresh());
      }

      if (e.affectsConfiguration("pawsql.recentWorkspaces")) {
        await this.updateWorkspaceContext();
      }
    } catch (error) {
      ErrorHandler.handle("configuration.update.failed", error);
    }
  }

  private isApiConfigChanged(e: vscode.ConfigurationChangeEvent): boolean {
    return (
      e.affectsConfiguration("pawsql.apiKey") ||
      e.affectsConfiguration("pawsql.frontendUrl") ||
      e.affectsConfiguration("pawsql.backendUrl")
    );
  }

  public async optimizeSql(workspaceId: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error("no.active.editor");
    }
    if (this.treeProvider) {
      this.treeProvider.refresh();
    } else {
      throw new Error("no.active.treeProvider");
    }

    const { currentQuery, range } = getEditorQueryDetails(editor);
    if (!currentQuery.trim()) {
      throw new Error("invalid.sql.text");
    }

    const statusBarItem = this.createStatusBarItem(
      UI_MESSAGES.OPTIMIZING_SQL()
    );

    await vscode.window.showInformationMessage(
      LanguageService.getMessage("start.optimize"),
      { modal: false } // 确保消息不会阻塞用户操作
    );

    try {
      // 设置优化状态为 true

      this.sqlCodeLensProvider.setOptimizing(range, true);

      await this.selectAndRevealQuery(editor, range);
      const result = await this.executeOptimization(workspaceId, currentQuery);
      await this.handleOptimizationResult(result);
    } catch (error) {
      ErrorHandler.handle("sql.optimization.failed", error);
    } finally {
      statusBarItem.dispose();
      // 优化完成后，设置状态为 false
      this.sqlCodeLensProvider.setOptimizing(range, false);
    }
  }

  public async optimizeSQLWithButton(
    query: string,
    workspaceId: string,
    range: vscode.Range
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error("no.active.editor");
    }
    if (this.treeProvider) {
      this.treeProvider.refresh();
    } else {
      throw new Error("no.active.treeProvider");
    }

    const validateResult = await this.treeProvider.validateConfig();

    if (!validateResult) {
      return;
    }

    if (!workspaceId) {
      await vscode.window.showInformationMessage(
        UI_MESSAGES.NO_DEFAULT_WORKSPACE()
      );
      return;
    }

    const statusBarItem = this.createStatusBarItem(
      UI_MESSAGES.OPTIMIZING_SQL()
    );

    await vscode.window.showInformationMessage(
      LanguageService.getMessage("start.optimize"),
      { modal: false } // 确保消息不会阻塞用户操作
    );

    try {
      // 设置优化状态为 true
      this.sqlCodeLensProvider.setOptimizing(range, true);

      const result = await this.executeOptimization(workspaceId, query); // 使用获取到的 SQL 文本
      // 3. 优化完成后更新消息
      if (statusBarItem) {
        statusBarItem.dispose(); // 清除之前的消息
      }

      await this.handleOptimizationResult(result);
    } catch (error) {
      ErrorHandler.handle("sql.optimization.failed", error);
    } finally {
      statusBarItem.dispose();
      this.sqlCodeLensProvider.setOptimizing(range, false);
    }
  }

  private async selectAndRevealQuery(
    editor: vscode.TextEditor,
    range: vscode.Range
  ): Promise<void> {
    editor.selection = new Selection(range.start, range.end);
    editor.revealRange(range);
  }

  private async executeOptimization(
    workspaceId: string,
    sql: string
  ): Promise<SummaryResponse> {
    const userKey = await ConfigurationService.getApiKey();
    if (!userKey) {
      throw new Error("api.key.not.configured");
    }

    const analysisResponse = await OptimizationService.createAnalysis({
      userKey,
      workspace: workspaceId,
      workload: sql,
      queryMode: "plain_sql",
      singleQueryFlag: true,
      validateFlag: true,
    });

    return await OptimizationService.getAnalysisSummary({
      userKey,
      analysisId: analysisResponse.data.analysisId,
    });
  }

  private async handleOptimizationResult(
    result: SummaryResponse
  ): Promise<void> {
    const statementId = result.data.summaryStatementInfo[0]?.analysisStmtId;
    if (statementId) {
      await this.webviewProvider.createResultPanel(statementId);
    }
  }

  private async updateWorkspaceContext(): Promise<void> {
    const count = this.workspaceManager.getRecentWorkspaces().length;
    await this.context.workspaceState.update(
      "pawsql.recentWorkspacesCount",
      count
    );
    await vscode.commands.executeCommand(
      "setContext",
      "pawsql:recentWorkspacesCount",
      count
    );
  }

  private async setApiKeyContext(apiKey: string | undefined): Promise<void> {
    await vscode.commands.executeCommand(
      "setContext",
      CONTEXTS.HAS_API_KEY,
      !!apiKey
    );
  }

  private createStatusBarItem(text: string): vscode.StatusBarItem {
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    );
    statusBarItem.text = text;
    statusBarItem.show();
    return statusBarItem;
  }

  public deactivate(): void {
    try {
      this.workspaceManager.clear();
      this.workspaceManager.clearRecent();
      this.decorationManager.dispose();
    } catch (error) {
      console.error("Extension deactivation failed:", error);
    }
  }
}
