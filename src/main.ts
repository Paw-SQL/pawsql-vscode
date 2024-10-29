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

export class PawSQLExtension {
  private readonly workspaceManager: WorkspaceManager;
  private readonly decorationManager: DecorationManager;
  private readonly commandManager: CommandManager;
  private readonly sqlCodeLensProvider: SqlCodeLensProvider;
  private readonly treeProvider: PawSQLTreeProvider;

  constructor(private readonly context: vscode.ExtensionContext) {
    // 初始化管理器和提供者
    this.workspaceManager = new WorkspaceManager(this);
    this.decorationManager = new DecorationManager(context);
    this.commandManager = new CommandManager(this, context);
    this.sqlCodeLensProvider = registerSqlCodeLensProvider(context);

    this.treeProvider = new PawSQLTreeProvider(context);
  }

  public async activate(): Promise<void> {
    try {
      await this.initializeExtension();
      this.registerEventListeners();
      this.registerProviders();
    } catch (error) {
      ErrorHandler.handle("extension.activation.failed", error);
    }
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
    // 注册文档关闭事件
    this.context.subscriptions.push(
      vscode.workspace.onDidCloseTextDocument(
        this.handleDocumentClose.bind(this)
      )
    );

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
        async (configKey: string) => {
          const result = await vscode.window.showInputBox({
            prompt: `请输入 ${configKey}`,
            password: configKey === "apiKey",
            value: vscode.workspace.getConfiguration("pawsql").get(configKey),
          });

          if (result !== undefined) {
            await this.treeProvider.updateConfig(configKey, result);
          }
        }
      )
    );

    // 注册验证配置命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand("pawsql.validateConfig", async () => {
        await this.treeProvider.validateConfiguration();
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
        this.treeProvider.refresh();
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
          this.treeProvider.setDefaultWorkspace(
            item.workspaceName,
            item.workspaceId
          );
        }
      )
    );

    // 注册编辑器事件
    this.decorationManager.registerDecorationListeners();
  }

  private async openBrowserCreateWorkspace(): Promise<void> {
    const { URLS } = getUrls();
    await vscode.env.openExternal(vscode.Uri.parse(URLS.NEW_WORKSPACE));
  }
  private async showStatementResult(analysisStmtId: string): Promise<void> {
    const { URLS } = getUrls();
    const panel = WebviewProvider.createResultPanel(analysisStmtId);

    // // 获取通知和按钮文本
    // const messageKey = "sql.optimization.completed"; // 假设这个键在语言文件中
    // const buttonKey = "open.in.browser"; // 新增的按钮文本键

    // const notificationMessage = LanguageService.getMessage(messageKey);
    // const buttonText = LanguageService.getMessage(buttonKey);

    // // 右下角显示通知，包含跳转按钮
    // const choice = await vscode.window.showInformationMessage(
    //   notificationMessage,
    //   buttonText // 使用动态按钮文本
    // );

    // // 如果用户点击了按钮
    // if (choice === buttonText) {
    //   const statementUrl = `${URLS.STATEMENT_BASE}/${analysisStmtId}`;
    //   await vscode.env.openExternal(vscode.Uri.parse(statementUrl));
    // }
  }

  private registerProviders(): void {
    // 注册树视图
    const treeView = vscode.window.createTreeView("pawsqlSidebar", {
      treeDataProvider: this.treeProvider,
      showCollapseAll: true,
    });
    this.context.subscriptions.push(treeView);
  }

  private async handleDocumentClose(
    document: vscode.TextDocument
  ): Promise<void> {
    if (document.languageId === "sql") {
      const config = vscode.workspace.getConfiguration("pawsql");
      if (config.get("defaultWorkspace")) {
        await config.update(
          "defaultWorkspace",
          undefined,
          vscode.ConfigurationTarget.WorkspaceFolder
        );
      }
    }
  }

  private async handleConfigurationChange(
    e: vscode.ConfigurationChangeEvent
  ): Promise<void> {
    try {
      if (this.isApiConfigChanged(e)) {
        await this.workspaceManager.clearRecentWorkspaces();
      }

      if (e.affectsConfiguration("pawsql.recentWorkspaces")) {
        await this.updateWorkspaceContext();
      }

      if (e.affectsConfiguration("pawsql.apiKey")) {
        const newApiKey = await ConfigurationService.getApiKey();
        await this.commandManager.updateWorkspaceCommands(newApiKey);
      }
    } catch (error) {
      ErrorHandler.handle("configuration.update.failed", error);
    }
  }

  private isApiConfigChanged(e: vscode.ConfigurationChangeEvent): boolean {
    return (
      e.affectsConfiguration("pawsql.apiKey") ||
      e.affectsConfiguration("pawsql.url.frontendUrl") ||
      e.affectsConfiguration("pawsql.url.backendUrl")
    );
  }

  public async optimizeSql(workspaceId: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error("no.active.editor");
    }

    const { currentQuery, range } = getEditorQueryDetails(editor);
    if (!currentQuery.trim()) {
      throw new Error("invalid.sql.text");
    }

    const statusBarItem = this.createStatusBarItem(
      UI_MESSAGES.OPTIMIZING_SQL()
    );

    try {
      await this.selectAndRevealQuery(editor, range);
      const result = await this.executeOptimization(workspaceId, currentQuery);
      await this.handleOptimizationResult(result);
    } catch (error) {
      ErrorHandler.handle("sql.optimization.failed", error);
    } finally {
      statusBarItem.dispose();
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
      await WebviewProvider.createResultPanel(statementId);
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
