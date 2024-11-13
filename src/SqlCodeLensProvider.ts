import * as vscode from "vscode";
import { ConfigurationService } from "./configurationService";
import { LanguageService } from "./LanguageService";
import { ApiService, WorkspaceItem } from "./apiService";
import parse from "./utils/parse";

interface OptimizingRange {
  range: vscode.Range;
  timestamp: number;
}

interface Workspace {
  workspaceId: string;
  workspaceName: string;
  dbType: string;
  dbHost: string;
  dbPort: string;
}

export class SqlCodeLensProvider implements vscode.CodeLensProvider {
  private static readonly STALE_THRESHOLD = 30000; // 30 seconds
  private static readonly PARSE_DELAY = 250; // ms

  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private readonly optimizingRanges = new Map<string, OptimizingRange>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {
    this.initializeEventListeners();
  }

  private initializeEventListeners(): void {
    // 文档改变事件
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.languageId === "sql") {
          this.refresh();
        }
      })
    );

    // 活动编辑器改变事件
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor?.document.languageId === "sql") {
          this.refresh();
        }
      })
    );

    // 配置改变事件
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("pawsql")) {
          this.refresh();
        }
      })
    );

    this.context.subscriptions.push(...this.disposables);
  }

  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    if (document.languageId !== "sql") {
      return [];
    }

    try {
      this.cleanupStaleOptimizingStates();

      const codeLenses: vscode.CodeLens[] = [];
      const fileWorkspace = await this.addFileConfigurationLens(
        document,
        codeLenses
      );

      if (!token.isCancellationRequested) {
        await this.addSqlQueryLenses(
          document,
          codeLenses,
          token,
          fileWorkspace
        );
      }

      return codeLenses;
    } catch (error) {
      console.error("Error providing CodeLenses:", error);
      return [];
    }
  }

  private async addFileConfigurationLens(
    document: vscode.TextDocument,
    codeLenses: vscode.CodeLens[]
  ): Promise<WorkspaceItem | null> {
    const fileUri = document.uri.toString();
    const fileWorkspace = await ConfigurationService.getFileDefaultWorkspace(
      fileUri
    );
    const config = vscode.workspace.getConfiguration("pawsql");
    const defaultWorkspace = config.get<WorkspaceItem>("defaultWorkspace");
    const apiKey = config.get<string>("apiKey");

    const separatorRange = new vscode.Range(0, 0, 1, 0);
    const isApikeyValid = await ApiService.validateUserKey(apiKey ?? "");

    if (!isApikeyValid) {
      codeLenses.push(this.createInitConfigLens(separatorRange, document));
    } else if (fileWorkspace?.workspaceId || defaultWorkspace?.workspaceId) {
      codeLenses.push(
        this.createWorkspaceLens(
          separatorRange,
          document,
          fileWorkspace ?? defaultWorkspace!
        )
      );
    } else {
      codeLenses.push(this.createSelectWorkspaceLens(separatorRange, document));
    }

    return fileWorkspace;
  }

  private async addSqlQueryLenses(
    document: vscode.TextDocument,
    codeLenses: vscode.CodeLens[],
    token: vscode.CancellationToken,
    fileWorkspace?: Workspace | null
  ): Promise<void> {
    const text = document.getText();
    const queries = await this.parseQueriesWithThrottle(text);
    const defaultWorkspace = await ConfigurationService.getDefaultWorkspace();
    const workspace = fileWorkspace ?? defaultWorkspace;

    for (const query of this.findQueriesInDocument(document, queries)) {
      if (token.isCancellationRequested) return;

      const isOptimizing = this.isRangeOptimizing(query.range);
      this.addQueryCodeLenses(
        codeLenses,
        query.range,
        query.text,
        workspace,
        isOptimizing
      );
    }
  }

  private *findQueriesInDocument(
    document: vscode.TextDocument,
    queries: string[]
  ): Generator<{ range: vscode.Range; text: string }> {
    const text = document.getText();
    let lastIndex = 0;

    for (const query of queries) {
      const queryIndex = text.indexOf(query, lastIndex);
      if (queryIndex === -1) continue;

      const startPos = document.positionAt(queryIndex);
      const endPos = document.positionAt(queryIndex + query.length);
      const range = new vscode.Range(startPos, endPos);

      yield { range, text: query };
      lastIndex = queryIndex + query.length;
    }
  }

  // Lens Creation Methods
  private createInitConfigLens(
    range: vscode.Range,
    document: vscode.TextDocument
  ): vscode.CodeLens {
    return new vscode.CodeLens(range, {
      title: LanguageService.getMessage("init.pawsql.config"),
      command: "pawsql.openSettings",
      arguments: [document.uri],
    });
  }

  private createWorkspaceLens(
    range: vscode.Range,
    document: vscode.TextDocument,
    workspace: Workspace
  ): vscode.CodeLens {
    return new vscode.CodeLens(range, {
      title: `$(pawsql-icon) ${LanguageService.getMessage(
        "codelens.file.default.workspace.title"
      )}: ${workspace.dbType}:${workspace.workspaceName}`,
      command: "pawsql.selectFileDefaultWorkspace",
      arguments: [document.uri],
    });
  }

  private createSelectWorkspaceLens(
    range: vscode.Range,
    document: vscode.TextDocument
  ): vscode.CodeLens {
    return new vscode.CodeLens(range, {
      title: `$(pawsql-icon) ${LanguageService.getMessage(
        "codelens.config.file.default.workspace"
      )}`,
      command: "pawsql.selectFileDefaultWorkspace",
      arguments: [document.uri],
    });
  }

  private addQueryCodeLenses(
    codeLenses: vscode.CodeLens[],
    range: vscode.Range,
    query: string,
    workspace: Workspace | undefined,
    isOptimizing: boolean
  ): void {
    if (isOptimizing) {
      codeLenses.push(this.createOptimizingLens(range));
    } else {
      codeLenses.push(
        this.createDefaultWorkspaceLens(range, query, workspace?.workspaceId),
        this.createSelectedWorkspaceLens(range, query)
      );
    }
  }

  private createOptimizingLens(range: vscode.Range): vscode.CodeLens {
    return new vscode.CodeLens(range, {
      title: LanguageService.getMessage("OPTIMIZING_SQL"),
      command: "",
    });
  }

  private createDefaultWorkspaceLens(
    range: vscode.Range,
    query: string,
    workspaceId?: string
  ): vscode.CodeLens {
    return new vscode.CodeLens(range, {
      title: LanguageService.getMessage(
        "codelens.optimize.sql.with.default.workspace"
      ),
      command: "pawsql.optimizeWithDefaultWorkspace",
      arguments: [query, workspaceId, range],
    });
  }

  private createSelectedWorkspaceLens(
    range: vscode.Range,
    query: string
  ): vscode.CodeLens {
    return new vscode.CodeLens(range, {
      title: LanguageService.getMessage(
        "codelens.optimize.sql.with.selected.workspace"
      ),
      command: "pawsql.optimizeWithSelectedWorkspace",
      arguments: [query, range],
    });
  }

  // Optimization State Management
  public async setOptimizing(
    range: vscode.Range,
    isOptimizing: boolean
  ): Promise<void> {
    const rangeKey = this.getRangeKey(range);

    if (isOptimizing) {
      this.optimizingRanges.set(rangeKey, {
        range,
        timestamp: Date.now(),
      });
    } else {
      this.optimizingRanges.delete(rangeKey);
    }

    await this.forceUIUpdate();
  }

  private isRangeOptimizing(range: vscode.Range): boolean {
    return Array.from(this.optimizingRanges.values()).some((item) =>
      this.rangesEqual(item.range, range)
    );
  }

  private getRangeKey(range: vscode.Range): string {
    return `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
  }

  private rangesEqual(range1: vscode.Range, range2: vscode.Range): boolean {
    return (
      range1.start.line === range2.start.line &&
      range1.start.character === range2.start.character &&
      range1.end.line === range2.end.line &&
      range1.end.character === range2.end.character
    );
  }

  // UI Updates
  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  private async forceUIUpdate(): Promise<void> {
    const updatePromises = [
      new Promise<void>((resolve) => {
        if (typeof window !== "undefined" && window.requestAnimationFrame) {
          window.requestAnimationFrame(() => {
            this._onDidChangeCodeLenses.fire();
            resolve();
          });
        } else {
          setImmediate(() => {
            this._onDidChangeCodeLenses.fire();
            resolve();
          });
        }
      }),
      Promise.resolve().then(() => {
        this._onDidChangeCodeLenses.fire();
      }),
    ];

    await Promise.all(updatePromises);
  }

  // Cleanup and Performance
  private cleanupStaleOptimizingStates(): void {
    const now = Date.now();
    let hasChanges = false;

    for (const [key, value] of this.optimizingRanges.entries()) {
      if (now - value.timestamp > SqlCodeLensProvider.STALE_THRESHOLD) {
        this.optimizingRanges.delete(key);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this._onDidChangeCodeLenses.fire();
    }
  }

  private async parseQueriesWithThrottle(text: string): Promise<string[]> {
    return parse(text);
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
