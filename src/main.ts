import * as vscode from "vscode";
import { Selection } from "vscode";

import { PawSQLTreeProvider } from "./PawSQLSidebarProvider";
import { SqlCodeLensProvider } from "./SqlCodeLensProvider";
import { getUrls } from "./constants";
import { DecorationManager } from "./DecorationManager";
import { CommandManager } from "./CommandManager";
import type { WorkspaceItem, AnalysisAndSummaryResponse } from "./apiService";
import { LanguageService } from "./LanguageService";
import { ConfigurationService } from "./configurationService";
import { ErrorHandler } from "./errorHandler";
import { WebviewProvider } from "./webviewProvider";
import { ApiService } from "./apiService";

export class PawSQLExtension {
  private readonly decorationManager: DecorationManager;
  private readonly commandManager: CommandManager;
  private readonly sqlCodeLensProvider: SqlCodeLensProvider;
  private readonly webviewProvider: WebviewProvider;
  private readonly treeProvider: PawSQLTreeProvider;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.decorationManager = new DecorationManager(context);
    this.sqlCodeLensProvider = new SqlCodeLensProvider(context);
    this.treeProvider = new PawSQLTreeProvider(context);
    this.webviewProvider = new WebviewProvider(context, this.treeProvider);
    this.commandManager = new CommandManager(
      this,
      context,
      this.sqlCodeLensProvider
    );
  }

  public async activate(): Promise<void> {
    try {
      LanguageService.loadLanguage(vscode.env.language);
      this.registerSettingsWebview();
      await this.commandManager.initializeCommands();
      await this.decorationManager.registerDecorationListeners();
      this.registerEventListeners();
      this.registerSqlCodeLensProvider();
    } catch (error) {
      ErrorHandler.handle("extension.activation.failed", error);
    }
  }

  private registerSettingsWebview() {
    let disposable = vscode.commands.registerCommand(
      "pawsql.openSettings",
      () => {
        this.webviewProvider.createSettingsPanel();
      }
    );

    this.context.subscriptions.push(disposable);
  }

  private registerSqlCodeLensProvider() {
    const disposable = vscode.languages.registerCodeLensProvider(
      { language: "sql", scheme: "file" },
      this.sqlCodeLensProvider
    );
    this.context.subscriptions.push(disposable);

    this.context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === "sql") {
          this.sqlCodeLensProvider.refresh();
        }
      })
    );
    this.context.subscriptions.push(this.sqlCodeLensProvider);
  }

  private registerEventListeners(): void {
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(
        this.handleConfigurationChange.bind(this)
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand("pawsql.validateConfig", async () => {
        await this.treeProvider.validateConfiguration();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "pawsql.showStatementDetail",
        (statementId, analysisId, analysisName) => {
          this.showStatementResult(statementId, analysisName);
        }
      )
    );

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
    const isConfigValid = await this.treeProvider.validateConfig();

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
          this.selectAndRevealQuery(editor, range);
          const result = await this.executeOptimization(workspaceId, query);

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
      await this.sqlCodeLensProvider.setOptimizing(range, false);
      if (statusBarItem) {
        statusBarItem.dispose();
      }
    }
  }

  private async openBrowserCreateWorkspace(): Promise<void> {
    const { URLS } = getUrls();
    await vscode.env.openExternal(vscode.Uri.parse(URLS.NEW_WORKSPACE));
  }

  private showStatementResult(
    analysisStmtId: string,
    analysisName: string
  ): void {
    this.webviewProvider.createResultPanel(analysisStmtId, analysisName);
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

  public async optimizeSqlBelowButton(
    query: string,
    workspaceId: string,
    range: vscode.Range
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error("no.active.editor");
    }

    const isConfigValid = await this.treeProvider.validateConfig();
    if (!isConfigValid) {
      return;
    }

    if (!workspaceId) {
      await vscode.window.showErrorMessage(
        LanguageService.getMessage("NO_DEFAULT_WORKSPACE")
      );
      return;
    }

    await this.sqlCodeLensProvider.setOptimizing(range, true);

    const statusBarItem = this.createStatusBarItem(
      LanguageService.getMessage("OPTIMIZING_SQL")
    );

    try {
      this.selectAndRevealQuery(editor, range);
      const result = await this.executeOptimization(workspaceId, query);
      await this.handleOptimizationResult(result, workspaceId);
    } catch (error) {
      ErrorHandler.handle("sql.optimization.failed", error);
    } finally {
      statusBarItem.dispose();
      await this.sqlCodeLensProvider.setOptimizing(range, false);
    }
  }

  private selectAndRevealQuery(
    editor: vscode.TextEditor,
    range: vscode.Range
  ): void {
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

    const analysisResponse = await ApiService.createAnalysis({
      userKey,
      workspace: workspaceId,
      workload: sql,
      queryMode: "plain_sql",
      singleQueryFlag: true,
      validateFlag: true,
    });

    return {
      analysis: analysisResponse,
      analysisSummary: await ApiService.getAnalysisSummary({
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
        this.webviewProvider.createResultPanel(
          statementId,
          result.analysisSummary.data.analysisName
        );
        await this.treeProvider.revealAnalysis(result.analysis.data.analysisId);
      }
    } else {
      const statementId =
        result.analysisSummary.data.summaryStatementInfo[0]?.analysisStmtId;
      if (statementId) {
        this.webviewProvider.createResultPanel(
          statementId,
          result.analysisSummary.data.analysisName
        );
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
