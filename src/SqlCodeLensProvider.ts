import * as vscode from "vscode";
import { ConfigurationService } from "./configurationService";
import parse from "./utils/parse";
import { COMMANDS } from "./constants";
import { LanguageService } from "./LanguageService";

interface OptimizeState {
  isOptimizing: boolean;
  optimizingRanges: Set<string>;
}

export class SqlCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  private disposables: vscode.Disposable[] = [];

  private state: OptimizeState = {
    isOptimizing: false,
    optimizingRanges: new Set<string>(),
  };

  private getRangeKey(range: vscode.Range): string {
    return `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
  }

  // 修改设置状态的方法，添加刷新触发
  public setOptimizing(range: vscode.Range, isOptimizing: boolean) {
    console.log(this.state);

    const rangeKey = this.getRangeKey(range);
    if (isOptimizing) {
      this.state.optimizingRanges.add(rangeKey);
    } else {
      this.state.optimizingRanges.delete(rangeKey);
    }
    this.state.isOptimizing = this.state.optimizingRanges.size > 0;

    // 触发 CodeLens 刷新
    this._onDidChangeCodeLenses.fire();
  }

  public isRangeOptimizing(range: vscode.Range): boolean {
    return this.state.optimizingRanges.has(this.getRangeKey(range));
  }

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

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    if (document.languageId !== "sql") {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];

    try {
      // 1. 处理文件级别的配置
      await this.addFileConfigurationLens(document, codeLenses);

      // 2. 处理 SQL 查询级别的操作
      await this.addSqlQueryLenses(document, codeLenses, token);

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
    // 获取文件和用户的工作空间设置
    const fileUri = document.uri.toString();
    const fileWorkspace = await ConfigurationService.getFileDefaultWorkspace(
      fileUri
    );

    // 在文件开头添加注释分隔符
    // 使用 range 从 (0,0) 到 (1,0) 确保文件级配置占据单独的一行
    const separatorRange = new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(1, 0)
    );

    // 从配置中读取默认工作空间
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

    if (!apiKey) {
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
          title: fileWorkspace.dbHost
            ? `\u200B$(pawsql-icon) ${LanguageService.getMessage(
                "codelens.file.default.workspace.title"
              )}: ${fileWorkspace.dbType}:${fileWorkspace.dbHost}@${
                fileWorkspace.dbPort
              }`
            : `\u200B$(pawsql-icon) ${LanguageService.getMessage(
                "codelens.file.default.workspace.title"
              )}: ${fileWorkspace.dbType}:${fileWorkspace.workspaceName}`,
          command: "pawsql.selectFileDefaultWorkspace",
          arguments: [document.uri],
        })
      );
    } else if (defaultWorkspace?.workspaceId) {
      codeLenses.push(
        new vscode.CodeLens(separatorRange, {
          title: defaultWorkspace.dbHost
            ? `${LanguageService.getMessage(
                "codelens.file.default.workspace.title"
              )}: ${defaultWorkspace.dbType}:${defaultWorkspace.dbHost}@${
                defaultWorkspace.dbPort
              }`
            : `${LanguageService.getMessage(
                "codelens.file.default.workspace.title"
              )}: ${defaultWorkspace.dbType}:${defaultWorkspace.workspaceName}`,
          command: "pawsql.selectFileDefaultWorkspace",
          arguments: [document.uri],
        })
      );
    } else {
      codeLenses.push(
        new vscode.CodeLens(separatorRange, {
          title: `\u200B$(pawsql-icon) ${LanguageService.getMessage(
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
    token: vscode.CancellationToken
  ) {
    const text = document.getText();
    const queries = await this.parseWithThrottle(text);
    const fileWorkspace = await ConfigurationService.getFileDefaultWorkspace(
      document.uri.toString()
    );

    const defaultWorkspace = await ConfigurationService.getDefaultWorkspace();

    let lastIndex = 0;
    for (const query of queries) {
      if (token.isCancellationRequested) {
        return;
      }

      const queryIndex = text.indexOf(query, lastIndex);
      if (queryIndex === -1) continue;

      // 获取查询的起始行号
      const startPos = document.positionAt(queryIndex);
      const endPos = document.positionAt(queryIndex + query.length);

      // 如果查询从第一行开始，我们调整其范围以避免与文件级配置冲突
      if (startPos.line === 0) {
        const adjustedStartPos = new vscode.Position(1, 0);
        const queryRange = new vscode.Range(adjustedStartPos, endPos);

        this.addQueryCodeLenses(
          codeLenses,
          queryRange,
          query,
          fileWorkspace ?? defaultWorkspace
        );
      } else {
        const queryRange = new vscode.Range(startPos, endPos);
        this.addQueryCodeLenses(
          codeLenses,
          queryRange,
          query,
          fileWorkspace ?? defaultWorkspace
        );
      }

      lastIndex = queryIndex + query.length;
    }
  }

  private addQueryCodeLenses(
    codeLenses: vscode.CodeLens[],
    queryRange: vscode.Range,
    query: string,
    fileWorkspace: any
  ) {
    const isOptimizing = this.isRangeOptimizing(queryRange);

    if (isOptimizing) {
      // 在优化过程中显示加载状态的 CodeLens
      codeLenses.push(
        new vscode.CodeLens(queryRange, {
          title: LanguageService.getMessage("OPTIMIZING_SQL"),
          command: "", // 空命令使其不可点击
        })
      );
    } else {
      // 正常状态下显示两个可点击的 CodeLens
      codeLenses.push(
        new vscode.CodeLens(queryRange, {
          title: LanguageService.getMessage(
            "codelens.optimize.sql.with.default.workspace"
          ),
          command: COMMANDS.OPTIMIZE_WITH_FILE_DEFAULT_WORKSPACE,
          arguments: [query, fileWorkspace?.workspaceId, queryRange],
        })
      );

      codeLenses.push(
        new vscode.CodeLens(queryRange, {
          title: LanguageService.getMessage(
            "codelens.optimize.sql.with.selected.workspace"
          ),
          command: COMMANDS.OPTIMIZE_WITH_FILE_SELECTED_WORKSPACE,
          arguments: [query, queryRange],
        })
      );
    }
  }

  private parseThrottleTimeout: NodeJS.Timeout | null = null;
  private async parseWithThrottle(text: string): Promise<string[]> {
    return new Promise((resolve) => {
      if (this.parseThrottleTimeout) {
        clearTimeout(this.parseThrottleTimeout);
      }

      this.parseThrottleTimeout = setTimeout(() => {
        resolve(parse(text));
      }, 250);
    });
  }

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

// 注册 CodeLens Provider 的辅助函数
export function registerSqlCodeLensProvider(context: vscode.ExtensionContext) {
  const provider = new SqlCodeLensProvider(context);

  const disposable = vscode.languages.registerCodeLensProvider(
    { language: "sql", scheme: "file" },
    provider
  );

  // 确保在文件打开时创建分隔符
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async (document) => {
      if (document.languageId === "sql") {
        provider.refresh();
      }
    })
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(provider);

  return provider;
}
