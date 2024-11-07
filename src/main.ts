import * as vscode from "vscode";
import { Selection } from "vscode";

import { PawSQLTreeProvider } from "./PawSQLSidebarProvider";
import { SqlCodeLensProvider } from "./SqlCodeLensProvider";
import { getUrls } from "./constants";
import { DecorationManager } from "./DecorationManager";
import { CommandManager } from "./CommandManager";
import type { WorkspaceItem, AnalysisAndSummaryResponse } from "./apiService";
import { getEditorQueryDetails } from "./utils/pawsqlUtils";
import { LanguageService } from "./LanguageService";
import { ConfigurationService } from "./configurationService";
import { ErrorHandler } from "./errorHandler";
import { OptimizationService } from "./optimizationService";
import { WebviewProvider } from "./webviewProvider";
import { ApiService } from "./apiService";

export class PawSQLExtension {
  private readonly decorationManager: DecorationManager;
  private readonly commandManager: CommandManager;
  private readonly sqlCodeLensProvider: SqlCodeLensProvider;
  private readonly webviewProvider: WebviewProvider;
  private readonly treeProvider: PawSQLTreeProvider;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.webviewProvider = new WebviewProvider(context);
    this.decorationManager = new DecorationManager(context);
    this.sqlCodeLensProvider = new SqlCodeLensProvider(context);
    this.treeProvider = new PawSQLTreeProvider(context);
    this.commandManager = new CommandManager(
      this,
      context,
      this.sqlCodeLensProvider
    );
  }

  public async activate(): Promise<void> {
    try {
      LanguageService.loadLanguage(vscode.env.language);
      await this.registerSettingsWebview();
      await this.commandManager.initializeCommands();
      await this.decorationManager.registerDecorationListeners();
      await this.registerEventListeners();
      await this.registerSqlCodeLensProvider();
    } catch (error) {
      ErrorHandler.handle("extension.activation.failed", error);
    }
  }

  private async registerSettingsWebview() {
    let disposable = vscode.commands.registerCommand(
      "pawsql.openSettings",
      () => {
        this.webviewProvider.createSettingsPanel();
      }
    );

    this.context.subscriptions.push(disposable);
  }

  // 注册 CodeLens Provider 的辅助函数
  private async registerSqlCodeLensProvider() {
    const disposable = vscode.languages.registerCodeLensProvider(
      { language: "sql", scheme: "file" },
      this.sqlCodeLensProvider
    );
    this.context.subscriptions.push(disposable);

    // 确保在文件打开时创建分隔符
    this.context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument(async (document) => {
        if (document.languageId === "sql") {
          this.sqlCodeLensProvider.refresh();
        }
      })
    );
    this.context.subscriptions.push(this.sqlCodeLensProvider);
  }

  private registerEventListeners(): void {
    // 注册配置变更事件
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(
        this.handleConfigurationChange.bind(this)
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
        this.sqlCodeLensProvider.refresh();
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
        "pawsql.optimizeWithDefaultWorkspace",
        this.optimizeSqlBelowButton.bind(this)
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "pawsql.optimizeWithSelectedWorkspace",
        this.handleWorkspaceSelectionWithRangeQuery.bind(this)
      )
    );
  }

  public async handleWorkspaceSelectionWithRangeQuery(
    query: string,
    range: vscode.Range
  ): Promise<void> {
    const isConfigValid = this.treeProvider.validateConfig();
    if (!isConfigValid) {
      return;
    }
    const apiKey = await ConfigurationService.getApiKey();
    const workspaces = await ApiService.getWorkspaces(apiKey ?? "");
    if (workspaces.data.total === "0") {
      await this.commandManager.handleEmptyWorkspaces();
      return;
    }

    await this.sqlCodeLensProvider.setOptimizing(range, true);
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    );
    try {
      statusBarItem.text = LanguageService.getMessage("QUERYING_WORKSPACES");
      statusBarItem.show();

      const workspaceItems =
        this.commandManager.createWorkspaceItems(workspaces);
      const selected = await this.commandManager.showWorkspaceQuickPick(
        workspaceItems
      );

      if (selected) {
        statusBarItem.dispose();

        const workspaceId = selected.workspaceId;

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          throw new Error("no.active.editor");
        }

        const optimizationStatusBarItem = this.createStatusBarItem(
          LanguageService.getMessage("OPTIMIZING_SQL")
        );

        try {
          // 设置优化状态为 true
          await this.selectAndRevealQuery(editor, range);
          const result = await this.executeOptimization(workspaceId, query); // 使用获取到的 SQL 文本
          // 3. 优化完成后更新消息
          if (optimizationStatusBarItem) {
            optimizationStatusBarItem.dispose(); // 清除之前的消息
          }

          await this.handleOptimizationResult(result, workspaceId);
        } catch (error) {
          ErrorHandler.handle("sql.optimization.failed", error);
        } finally {
          optimizationStatusBarItem.dispose();
        }
      }
    } catch (error) {
      ErrorHandler.handle("workspace.operation.failed", error);
    } finally {
      this.sqlCodeLensProvider.setOptimizing(range, false);
      if (statusBarItem) {
        statusBarItem.dispose();
      }
    }
  }

  private async openBrowserCreateWorkspace(): Promise<void> {
    const { URLS } = getUrls();
    await vscode.env.openExternal(vscode.Uri.parse(URLS.NEW_WORKSPACE));
  }
  private async showStatementResult(analysisStmtId: string): Promise<void> {
    this.webviewProvider.createResultPanel(analysisStmtId);
  }

  private async handleConfigurationChange(
    e: vscode.ConfigurationChangeEvent
  ): Promise<void> {
    try {
      if (this.treeProvider.isApiConfigChanged(e)) {
        ConfigurationService.clearUserDefaultWorkspace();
        ConfigurationService.clearFileDefaultWorkspace();
        await this.treeProvider.refresh();
        await this.sqlCodeLensProvider.refresh();
      }
    } catch (error) {
      ErrorHandler.handle("configuration.update.failed", error);
    }
  }

  // optimizeSqlBelowButton 方法修改
  public async optimizeSqlBelowButton(
    query: string,
    workspaceId: string,
    range: vscode.Range
  ): Promise<void> {
    // 2. 确保编辑器存在
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error("no.active.editor");
    }

    // 3. 验证配置
    const isConfigValid = await this.treeProvider.validateConfig();
    if (!isConfigValid) {
      // const range = new vscode.Range(0, 0, 0, 0); // 替换为按钮所在行的 Range

      // // 创建诊断对象
      // const diagnostic = new vscode.Diagnostic(
      //   range,
      //   message,
      //   vscode.DiagnosticSeverity.Error
      // );
      // vscode.languages.setDiagnostics(editor.document.uri, [diagnostic]);

      // const message = "验证失败"; // 汇总错误信息
      // let errors = vscode.languages.createDiagnosticCollection("foo");
      // errors.clear();
      // errors.set(editor.document.uri, [new vscode.Diagnostic(range, message)]);

      // const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);

      return;
    }

    if (!workspaceId) {
      await vscode.window.showErrorMessage(
        LanguageService.getMessage("NO_DEFAULT_WORKSPACE")
      );
      return;
    }

    // 1. 先设置状态并等待UI更新完成
    await this.sqlCodeLensProvider.setOptimizing(range, true);

    const statusBarItem = this.createStatusBarItem(
      LanguageService.getMessage("OPTIMIZING_SQL")
    );

    try {
      // 4. 选择并显示查询
      await this.selectAndRevealQuery(editor, range);

      // 5. 执行优化
      const result = await this.executeOptimization(workspaceId, query);

      // 6. 处理结果
      await this.handleOptimizationResult(result, workspaceId);
    } catch (error) {
      ErrorHandler.handle("sql.optimization.failed", error);
    } finally {
      statusBarItem.dispose();
      // 7. 重置状态
      await this.sqlCodeLensProvider.setOptimizing(range, false);
    }
  }
  private async selectAndRevealQuery(
    editor: vscode.TextEditor,
    range: vscode.Range
  ): Promise<void> {
    // 将光标定位到指定的 SQL 查询范围，并确保该范围在编辑器中可见
    editor.selection = new Selection(range.start, range.end);
    editor.revealRange(range);
  }

  private async executeOptimization(
    workspaceId: string,
    sql: string
  ): Promise<AnalysisAndSummaryResponse> {
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

    return {
      analysis: analysisResponse,
      analysisSummary: await OptimizationService.getAnalysisSummary({
        userKey,
        analysisId: analysisResponse.data.analysisId,
      }),
    };
  }

  private async handleOptimizationResult(
    result: AnalysisAndSummaryResponse,
    workspaceId: string
  ): Promise<void> {
    await this.treeProvider.addAnalysisAndStatement(
      workspaceId,
      result.analysis.data.analysisId
    );
    const queryNumber = result.analysisSummary.data.basicSummary.numberOfQuery;
    if (queryNumber === 1) {
      const statementId =
        result.analysisSummary.data.summaryStatementInfo[0]?.analysisStmtId;
      if (statementId) {
        this.webviewProvider.createResultPanel(statementId);
        await this.treeProvider.revealAnalysis(result.analysis.data.analysisId);
      }
    } else {
      const statementId =
        result.analysisSummary.data.summaryStatementInfo[0]?.analysisStmtId;
      if (statementId) {
        this.webviewProvider.createResultPanel(statementId);
        await this.treeProvider.revealStatement(statementId);
      }
    }
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
      this.decorationManager.dispose();
    } catch (error) {
      console.error("Extension deactivation failed:", error);
    }
  }
}
