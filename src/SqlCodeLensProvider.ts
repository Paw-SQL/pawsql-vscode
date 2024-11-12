import * as vscode from "vscode";
import { ConfigurationService } from "./configurationService";
import parse from "./utils/parse";
import { LanguageService } from "./LanguageService";
import { ApiService } from "./apiService";

interface OptimizeState {
  isOptimizing: boolean;
  optimizingRanges: Map<
    string,
    {
      range: vscode.Range;
      timestamp: number;
    }
  >;
}

export class SqlCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  private disposables: vscode.Disposable[] = [];
  private refreshDebounceTimeout: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 50; // ms

  private state: OptimizeState = {
    isOptimizing: false,
    optimizingRanges: new Map(),
  };

  constructor(private context: vscode.ExtensionContext) {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.languageId === "sql") {
          this.refresh();
        }
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor?.document.languageId === "sql") {
          this.refresh();
        }
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("pawsql")) {
          this.refresh();
        }
      })
    );

    context.subscriptions.push(...this.disposables);
  }

  private getRangeKey(range: vscode.Range): string {
    return `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
  }

  public async setOptimizing(
    range: vscode.Range,
    isOptimizing: boolean
  ): Promise<void> {
    const rangeKey = this.getRangeKey(range);

    if (isOptimizing) {
      this.state.optimizingRanges.set(rangeKey, {
        range,
        timestamp: Date.now(),
      });
    } else {
      this.state.optimizingRanges.delete(rangeKey);
    }

    this.state.isOptimizing = this.state.optimizingRanges.size > 0;

    // 这两个调用都需要保留await，因为它们涉及UI更新和状态同步
    await this.debouncedRefresh();
    await this.ensureStateUpdate();
  }

  private debouncedRefresh(): Promise<void> {
    return new Promise((resolve) => {
      if (this.refreshDebounceTimeout) {
        clearTimeout(this.refreshDebounceTimeout);
      }

      this.refreshDebounceTimeout = setTimeout(() => {
        this._onDidChangeCodeLenses.fire();
        resolve();
      }, this.DEBOUNCE_DELAY);
    });
  }

  private ensureStateUpdate(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (typeof window !== "undefined" && window.requestAnimationFrame) {
        window.requestAnimationFrame(() => {
          setTimeout(resolve, 16);
        });
      } else {
        setTimeout(resolve, 16);
      }
    });
  }

  public isRangeOptimizing(range: vscode.Range): boolean {
    return Array.from(this.state.optimizingRanges.values()).some((item) =>
      this.rangesEqual(item.range, range)
    );
  }

  private rangesEqual(range1: vscode.Range, range2: vscode.Range): boolean {
    return (
      range1.start.line === range2.start.line &&
      range1.start.character === range2.start.character &&
      range1.end.line === range2.end.line &&
      range1.end.character === range2.end.character
    );
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    if (document.languageId !== "sql") {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];

    try {
      const optimizingRanges = Array.from(this.state.optimizingRanges.values());

      // 需要保留await，因为这涉及文件系统操作
      const fileWorkspace = await this.addFileConfigurationLens(
        document,
        codeLenses
      );

      if (!token.isCancellationRequested) {
        // 需要保留await，因为这涉及文本解析和工作区配置
        await this.addSqlQueryLenses(
          document,
          codeLenses,
          token,
          optimizingRanges
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
  ) {
    const fileUri = document.uri.toString();
    // 需要保留await，因为这涉及文件系统操作
    const fileWorkspace = await ConfigurationService.getFileDefaultWorkspace(
      fileUri
    );

    const separatorRange = new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(1, 0)
    );

    const defaultWorkspace = vscode.workspace.getConfiguration("pawsql").get<{
      workspaceId: string;
      workspaceName: string;
      dbType: string;
      dbHost: string;
      dbPort: string;
    }>("defaultWorkspace");

    const apiKey = vscode.workspace
      .getConfiguration("pawsql")
      .get<string>("apiKey");

    // 需要保留await，因为这是API调用
    const isApikeyValid = await ApiService.validateUserKey(apiKey ?? "");

    if (!isApikeyValid) {
      codeLenses.push(
        new vscode.CodeLens(separatorRange, {
          title: LanguageService.getMessage("init.pawsql.config"),
          command: "pawsql.openSettings",
          arguments: [document.uri],
        })
      );
    } else if (fileWorkspace?.workspaceId) {
      codeLenses.push(
        new vscode.CodeLens(separatorRange, {
          title: `$(pawsql-icon) ${LanguageService.getMessage(
            "codelens.file.default.workspace.title"
          )}: ${fileWorkspace.dbType}:${fileWorkspace.workspaceName}`,
          command: "pawsql.selectFileDefaultWorkspace",
          arguments: [document.uri],
        })
      );
    } else if (defaultWorkspace?.workspaceId) {
      codeLenses.push(
        new vscode.CodeLens(separatorRange, {
          title: `$(pawsql-icon) ${LanguageService.getMessage(
            "codelens.file.default.workspace.title"
          )}: ${defaultWorkspace.dbType}:${defaultWorkspace.workspaceName}`,
          command: "pawsql.selectFileDefaultWorkspace",
          arguments: [document.uri],
        })
      );
    } else {
      codeLenses.push(
        new vscode.CodeLens(separatorRange, {
          title: `$(pawsql-icon) ${LanguageService.getMessage(
            "codelens.config.file.default.workspace"
          )}`,
          command: "pawsql.selectFileDefaultWorkspace",
          arguments: [document.uri],
        })
      );
    }

    return fileWorkspace;
  }

  private async addSqlQueryLenses(
    document: vscode.TextDocument,
    codeLenses: vscode.CodeLens[],
    token: vscode.CancellationToken,
    optimizingRanges: Array<{ range: vscode.Range; timestamp: number }>
  ) {
    const text = document.getText();
    // 需要保留await，因为这涉及文本解析
    const queries = await this.parseWithThrottle(text);
    // 需要保留await，因为这涉及文件系统操作
    const fileWorkspace = await ConfigurationService.getFileDefaultWorkspace(
      document.uri.toString()
    );
    // 需要保留await，因为这涉及工作区配置
    const defaultWorkspace = await ConfigurationService.getDefaultWorkspace();

    let lastIndex = 0;
    for (const query of queries) {
      if (token.isCancellationRequested) {
        return;
      }

      const queryIndex = text.indexOf(query, lastIndex);
      if (queryIndex === -1) continue;

      const startPos = document.positionAt(queryIndex);
      const endPos = document.positionAt(queryIndex + query.length);

      const queryRange = new vscode.Range(startPos, endPos);

      const isOptimizing = optimizingRanges.some((item) =>
        this.rangesEqual(item.range, queryRange)
      );

      this.addQueryCodeLenses(
        codeLenses,
        queryRange,
        query,
        fileWorkspace ?? defaultWorkspace,
        isOptimizing
      );

      lastIndex = queryIndex + query.length;
    }
  }

  private addQueryCodeLenses(
    codeLenses: vscode.CodeLens[],
    queryRange: vscode.Range,
    query: string,
    workspace: any,
    isOptimizing: boolean
  ) {
    if (isOptimizing) {
      codeLenses.push(
        new vscode.CodeLens(queryRange, {
          title: LanguageService.getMessage("OPTIMIZING_SQL"),
          command: "",
        })
      );
    } else {
      codeLenses.push(
        new vscode.CodeLens(queryRange, {
          title: LanguageService.getMessage(
            "codelens.optimize.sql.with.default.workspace"
          ),
          command: "pawsql.optimizeWithDefaultWorkspace",
          arguments: [query, workspace?.workspaceId, queryRange],
        })
      );

      codeLenses.push(
        new vscode.CodeLens(queryRange, {
          title: LanguageService.getMessage(
            "codelens.optimize.sql.with.selected.workspace"
          ),
          command: "pawsql.optimizeWithSelectedWorkspace",
          arguments: [query, queryRange],
        })
      );
    }
  }

  private parseThrottleTimeout: NodeJS.Timeout | null = null;
  private parseWithThrottle(text: string): Promise<string[]> {
    return new Promise((resolve) => {
      if (this.parseThrottleTimeout) {
        clearTimeout(this.parseThrottleTimeout);
      }

      this.parseThrottleTimeout = setTimeout(() => {
        resolve(parse(text));
      }, 250);
    });
  }

  private cleanupStaleOptimizingStates() {
    const now = Date.now();
    const STALE_THRESHOLD = 30000; // 30 seconds

    for (const [key, value] of this.state.optimizingRanges) {
      if (now - value.timestamp > STALE_THRESHOLD) {
        this.state.optimizingRanges.delete(key);
      }
    }

    this.state.isOptimizing = this.state.optimizingRanges.size > 0;
  }

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public dispose(): void {
    if (this.refreshDebounceTimeout) {
      clearTimeout(this.refreshDebounceTimeout);
    }
    if (this.parseThrottleTimeout) {
      clearTimeout(this.parseThrottleTimeout);
    }
    this.disposables.forEach((d) => d.dispose());
  }
}
