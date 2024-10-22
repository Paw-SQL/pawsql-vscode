import * as vscode from "vscode";
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

export class PawSQLExtension {
  private workspaceManager = new WorkspaceManager();

  constructor(private context: vscode.ExtensionContext) {}

  async activate(): Promise<void> {
    try {
      // 在扩展激活时加载语言
      const lang = vscode.env.language; // 获取当前环境语言
      LanguageService.loadLanguage(lang);
      const apiKey = await ConfigurationService.getApiKey();
      await this.setApiKeyContext(apiKey);
      await this.initializeCommands(apiKey);
      this.registerConfigurationListener();
    } catch (error) {
      ErrorHandler.handle("extension.activation.failed", error);
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
  private registerConfigurationListener(): void {
    const disposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
      try {
        if (e.affectsConfiguration("pawsql.apiKey")) {
          const newApiKey = await ConfigurationService.getApiKey();
          await this.updateWorkspaceCommands(newApiKey);
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
      UI_MESSAGES.QUERYING_WORKSPACES
    );

    try {
      // 显示“正在查询工作空间”的状态
      statusBarItem.text = UI_MESSAGES.QUERYING_WORKSPACES;
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
        await this.optimizeSql(selected.workspaceId);
      }
    } catch (error) {
      // 如果查询失败，显示错误提示
      // vscode.window.showErrorMessage("查询工作空间失败，请重试。");
      ErrorHandler.handle("workspace.operation.failed", error);
    } finally {
      // 在操作完成后清理状态栏
      statusBarItem.dispose();
    }
  }

  private async handleEmptyWorkspaces(): Promise<void> {
    const { URLS } = getUrls();
    const choice = await vscode.window.showInformationMessage(
      UI_MESSAGES.NO_WORKSPACE,
      UI_MESSAGES.CREATE_WORKSPACE
    );

    if (choice === UI_MESSAGES.CREATE_WORKSPACE) {
      await vscode.env.openExternal(vscode.Uri.parse(URLS.NEW_WORKSPACE));
    }
  }

  private createWorkspaceItems(
    workspaces: WorkspacesResponse
  ): WorkspaceItem[] {
    return workspaces.data.records.map((workspace) => ({
      label: workspace.workspaceName,
      workspaceId: workspace.workspaceId,
    }));
  }

  private async showWorkspaceQuickPick(
    items: WorkspaceItem[]
  ): Promise<WorkspaceItem | undefined> {
    return vscode.window.showQuickPick(items, {
      placeHolder: UI_MESSAGES.WORKSPACE_SELECTOR_PLACEHOLDER,
    });
  }

  private async optimizeSql(workspaceId: string): Promise<void> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        throw new Error("no.active.editor");
      }

      const sql = editor.document.getText(editor.selection);
      if (!sql.trim()) {
        throw new Error("invalid.sql.text");
      }

      // 创建状态栏提示并立即显示
      const statusBarItem = this.createStatusBarItem(
        UI_MESSAGES.OPTIMIZING_SQL
      );

      try {
        // 显示“正在优化”提示
        statusBarItem.text = UI_MESSAGES.OPTIMIZING_SQL;
        statusBarItem.show();

        // 执行优化操作
        const result = await this.performOptimization(workspaceId, sql);

        // SQL 优化成功，更新状态栏提示为“优化已完成”
        statusBarItem.text = UI_MESSAGES.SQL_OPTIMIZED;

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
    // Panel disposal is handled by VS Code

    // 右下角显示通知，包含跳转按钮
    const choice = await vscode.window.showInformationMessage(
      "SQL 优化已完成，您可以在 Web 浏览器中查看详细报告。",
      "在浏览器中打开"
    );

    // 如果用户点击了“在浏览器中打开”
    if (choice === "在浏览器中打开") {
      const analysisStmtId =
        result.data.summaryStatementInfo[0]?.analysisStmtId || "";
      const statementUrl = `${URLS.STATEMENT_BASE}/${analysisStmtId}`;
      await vscode.env.openExternal(vscode.Uri.parse(statementUrl));
    }
  }

  deactivate(): void {
    try {
      this.workspaceManager.clear();
    } catch (error) {
      console.error("扩展停用时清理失败:", error);
    }
  }
}
