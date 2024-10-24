import * as vscode from "vscode";
import { Selection } from "vscode";

import { ConfigurationService } from "./configurationService";
import { ApiService } from "./apiService";
import { OptimizationService } from "./optimizationService";
import { ErrorHandler } from "./errorHandler";
import { WorkspaceManager } from "./workspaceManager";
import { WebviewProvider } from "./webviewProvider";
import { COMMANDS, CONTEXTS, UI_MESSAGES, getUrls } from "./constants";
import type {
  SummaryResponse,
  WorkspaceItem,
  WorkspacesResponse,
} from "./types";
import { LanguageService } from "./LanguageService";
import { getEditorQueryDetails } from "./utils/pawsqlUtils";
import { SqlCodeLensProvider } from "./SqlCodeLensProvider";

// 获取颜色配置
const currentQueryBg = new vscode.ThemeColor("pawsql.currentQueryBg");
const currentQueryOutline = new vscode.ThemeColor("pawsql.currentQueryOutline");

export class PawSQLExtension {
  private workspaceManager = new WorkspaceManager(this);
  private highlightDecoration: vscode.TextEditorDecorationType;
  private sqlCodeLensProvider: SqlCodeLensProvider; // 添加 CodeLens 提供者

  constructor(private context: vscode.ExtensionContext) {
    // 初始化高亮装饰器
    this.highlightDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: currentQueryBg,
      borderColor: currentQueryOutline,
      borderWidth: "1px",
      borderStyle: "solid",
    });
    this.sqlCodeLensProvider = new SqlCodeLensProvider(context); // 实例化 CodeLens 提供者
  }

  async activate(): Promise<void> {
    try {
      // 在扩展激活时加载语言
      const lang = vscode.env.language; // 获取当前环境语言
      LanguageService.loadLanguage(lang);
      const apiKey = await ConfigurationService.getApiKey();
      await this.setApiKeyContext(apiKey);
      await this.initializeCommands(apiKey);
      this.registerConfigurationListener();

      // 加载最近工作空间并设置上下文状态
      this.updateRecentWorkspaceContext(this.workspaceManager, this.context);

      // 监听配置变化
      this.context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
          // 检查特定配置是否发生变化
          if (
            e.affectsConfiguration("pawsql.apiKey") ||
            e.affectsConfiguration("pawsql.url.frontendUrl") ||
            e.affectsConfiguration("pawsql.url.backendUrl")
          ) {
            // 清空最近工作空间的内容
            await this.workspaceManager.clearRecentWorkspaces();
          }
          if (e.affectsConfiguration("pawsql.recentWorkspaces")) {
            console.log(123);

            this.updateRecentWorkspaceContext(
              this.workspaceManager,
              this.context
            );
          }
        })
      );

      this.createDecorations(); // 注册高亮功能

      // 注册 CodeLens 提供者
      this.context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
          { scheme: "file", language: "sql" },
          this.sqlCodeLensProvider
        )
      );
    } catch (error) {
      ErrorHandler.handle("extension.activation.failed", error);
    }
  }

  private updateRecentWorkspaceContext(
    workspaceManager: WorkspaceManager,
    context: vscode.ExtensionContext
  ) {
    const count = workspaceManager.getRecentWorkspaces().length;
    console.log(count);

    context.workspaceState.update("pawsql.recentWorkspacesCount", count);
    vscode.commands.executeCommand(
      "setContext",
      "pawsql:recentWorkspacesCount",
      count
    );
  }

  private createDecorations(): void {
    // 当活动编辑器更改时更新高亮
    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor) {
          this.updateHighlight(editor);
        }
      },
      null,
      this.context.subscriptions
    );

    // 监听文本变化
    vscode.workspace.onDidChangeTextDocument(
      (event) => {
        if (
          vscode.window.activeTextEditor &&
          event.document === vscode.window.activeTextEditor.document
        ) {
          this.updateHighlight(vscode.window.activeTextEditor);
        }
      },
      null,
      this.context.subscriptions
    );

    // 监听光标选择变化
    vscode.window.onDidChangeTextEditorSelection(
      (event) => {
        if (event.textEditor === vscode.window.activeTextEditor) {
          this.updateHighlight(vscode.window.activeTextEditor);
        }

        if (event.textEditor.document.languageId === "sql") {
          this.sqlCodeLensProvider.refresh(); // 触发更新
        }
      },
      null,
      this.context.subscriptions
    );
  }

  private updateHighlight(editor: vscode.TextEditor): void {
    // 检查文件的语言 ID 是否为 SQL
    if (editor.document.languageId !== "sql") {
      return; // 如果不是 SQL 文件，直接返回
    }
    const { currentQuery, range } = getEditorQueryDetails(editor); // 获取光标附近的 SQL 语句和范围
    if (currentQuery) {
      editor.setDecorations(this.highlightDecoration, [range]); // 设置高亮装饰
    } else {
      editor.setDecorations(this.highlightDecoration, []); // 清除高亮
    }
  }

  private async setApiKeyContext(apiKey: string | undefined): Promise<void> {
    await vscode.commands.executeCommand(
      "setContext",
      CONTEXTS.HAS_API_KEY,
      !!apiKey
    );
  }

  private async initializeCommands(apiKey: string | undefined): Promise<void> {
    try {
      this.registerApiKeyCommands();
      await this.updateWorkspaceCommands(apiKey);
    } catch (error) {
      ErrorHandler.handle("initialize.commands.failed", error);
    }
  }

  private registerApiKeyCommands(): void {
    const commands = [
      {
        command: COMMANDS.NO_API_KEY_HINT,
        callback: () => this.openApiKeySettings(),
      },
      {
        command: COMMANDS.CONFIGURE_API_KEY,
        callback: () => this.openApiKeySettings(),
      },
      {
        command: COMMANDS.CONFIGURE_API_URL,
        callback: () => this.openApiURLSettings(),
      },
    ];

    commands.forEach(({ command, callback }) => {
      const disposable = vscode.commands.registerCommand(command, callback);
      this.context.subscriptions.push(disposable);
    });
  }

  private async openApiKeySettings(): Promise<void> {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "pawsql.apiKey"
    );
  }

  private async openApiURLSettings(): Promise<void> {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "pawsql.url"
    );
  }

  public async registerRecentWorkspaceCommands(): Promise<void> {
    try {
      // 让 WorkspaceManager 处理命令注册
      await this.workspaceManager.registerRecentWorkspaceCommands(this.context);

      // 更新上下文状态
      this.updateRecentWorkspaceContext(this.workspaceManager, this.context);
    } catch (error) {
      ErrorHandler.handle("register.recent.workspace.commands.failed", error);
    }
  }

  private registerConfigurationListener(): void {
    const disposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
      try {
        if (e.affectsConfiguration("pawsql.apiKey")) {
          const newApiKey = await ConfigurationService.getApiKey();
          await this.updateWorkspaceCommands(newApiKey);
        }

        if (e.affectsConfiguration("pawsql.recentWorkspaces")) {
          await this.registerRecentWorkspaceCommands(); // 动态注册最近工作空间命令
        }
      } catch (error) {
        ErrorHandler.handle("configuration.update.failed", error);
      }
    });
    this.context.subscriptions.push(disposable);
  }

  private async updateWorkspaceCommands(
    apiKey: string | undefined
  ): Promise<void> {
    try {
      this.workspaceManager.clear();

      if (apiKey) {
        await this.registerWorkspaceCommand(apiKey);
        await this.setApiKeyContext(apiKey);
        await this.registerRecentWorkspaceCommands(); // 注册最近工作空间命令
      } else {
        await this.setApiKeyContext(undefined);
      }
    } catch (error) {
      ErrorHandler.handle("menu.update.failed", error);
    }
  }

  private async registerWorkspaceCommand(apiKey: string): Promise<void> {
    const disposable = vscode.commands.registerCommand(
      COMMANDS.SELECT_WORKSPACE,
      () => this.handleWorkspaceSelection(apiKey)
    );
    this.workspaceManager.addDisposable(disposable);
    this.context.subscriptions.push(disposable);
  }

  private async handleWorkspaceSelection(apiKey: string): Promise<void> {
    // 创建状态栏提示并立即显示
    const statusBarItem = this.createStatusBarItem(
      UI_MESSAGES.QUERYING_WORKSPACES()
    );

    try {
      // 显示“正在查询工作空间”的状态
      statusBarItem.text = UI_MESSAGES.QUERYING_WORKSPACES();
      statusBarItem.show();

      // 查询工作空间
      const workspaces = await ApiService.getWorkspaces(apiKey);

      if (workspaces.data.total === "0") {
        await this.handleEmptyWorkspaces();
        return;
      }

      // 创建工作空间选择列表
      const workspaceItems = this.createWorkspaceItems(workspaces);
      const selected = await this.showWorkspaceQuickPick(workspaceItems);

      // 如果用户选择了某个工作空间，执行优化操作
      if (selected) {
        statusBarItem.dispose();
        this.workspaceManager.addRecentWorkspace(selected); // 记录最近使用的工作空间
        await this.registerRecentWorkspaceCommands(); // 重新注册命令

        await this.optimizeSql(selected.workspaceId);
      }
    } catch (error) {
      // 如果查询失败，显示错误提示
      // vscode.window.showErrorMessage("查询工作空间失败，请重试。");
      ErrorHandler.handle("workspace.operation.failed", error);
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

  private createWorkspaceItems(
    workspaces: WorkspacesResponse
  ): WorkspaceItem[] {
    return workspaces.data.records.map((workspace) => ({
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

  public async optimizeSql(workspaceId: string): Promise<void> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        throw new Error("no.active.editor");
      }

      const { currentQuery, range } = getEditorQueryDetails(editor);
      console.log("距离光标最近的SQL：" + currentQuery);

      // const sql = editor.document.getText(editor.selection);
      if (!currentQuery.trim()) {
        throw new Error("invalid.sql.text");
      }

      // 自动选中（高亮）当前 SQL 语句
      editor.selection = new Selection(range.start, range.end);
      editor.revealRange(range); // 确保编辑器视图展示选中的内容

      // 创建状态栏提示并立即显示
      const statusBarItem = this.createStatusBarItem(
        UI_MESSAGES.OPTIMIZING_SQL()
      );

      try {
        // 显示“正在优化”提示
        statusBarItem.text = UI_MESSAGES.OPTIMIZING_SQL();
        statusBarItem.show();

        // 执行优化操作
        const result = await this.performOptimization(
          workspaceId,
          currentQuery
        );

        // SQL 优化成功，更新状态栏提示为“优化已完成”
        statusBarItem.text = UI_MESSAGES.SQL_OPTIMIZED();

        // 显示优化结果
        await this.showOptimizationResult(result);
      } catch (error) {
        // 在右下角显示错误信息
        // vscode.window.showErrorMessage("SQL 优化失败，请重试。");
        ErrorHandler.handle("sql.optimization.failed", error);
      } finally {
        // 确保状态栏在操作完成后被清理
        statusBarItem.dispose();
      }
    } catch (error) {
      // 如果一开始就出错，捕获并显示错误信息
      //   vscode.window.showErrorMessage("SQL 优化失败，请重试。");
      ErrorHandler.handle("sql.optimization.failed", error);
    }
  }

  // 创建状态栏提示的函数
  private createStatusBarItem(text: string): vscode.StatusBarItem {
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    );
    statusBarItem.text = text;
    statusBarItem.show();
    return statusBarItem;
  }

  private async performOptimization(
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
    });

    return await OptimizationService.getAnalysisSummary({
      userKey,
      analysisId: analysisResponse.data.analysisId,
    });
  }

  private async showOptimizationResult(result: SummaryResponse): Promise<void> {
    const { URLS } = getUrls();
    const panel = WebviewProvider.createResultPanel(result.data);

    // 获取通知和按钮文本
    const messageKey = "sql.optimization.completed"; // 假设这个键在语言文件中
    const buttonKey = "open.in.browser"; // 新增的按钮文本键

    const notificationMessage = LanguageService.getMessage(messageKey);
    const buttonText = LanguageService.getMessage(buttonKey);

    // 右下角显示通知，包含跳转按钮
    const choice = await vscode.window.showInformationMessage(
      notificationMessage,
      buttonText // 使用动态按钮文本
    );

    // 如果用户点击了按钮
    if (choice === buttonText) {
      const analysisStmtId =
        result.data.summaryStatementInfo[0]?.analysisStmtId || "";
      const statementUrl = `${URLS.STATEMENT_BASE}/${analysisStmtId}`;
      await vscode.env.openExternal(vscode.Uri.parse(statementUrl));
    }
  }

  deactivate(): void {
    try {
      this.workspaceManager.clear();
      this.workspaceManager.clearRecent();
      this.highlightDecoration.dispose(); // 清理高亮装饰器
    } catch (error) {
      console.error("扩展停用时清理失败:", error);
    }
  }
}
