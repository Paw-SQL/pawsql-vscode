import * as vscode from "vscode";
import { ConfigurationService } from "./configurationService";
import parse from "./utils/parse";
import { COMMANDS } from "./constants";

export class SqlCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  private disposables: vscode.Disposable[] = [];

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
    const defaultWorkspace = vscode.workspace
      .getConfiguration("pawsql")
      .get<{ workspaceId: string; workspaceName: string }>("defaultWorkspace");

    if (fileWorkspace) {
      codeLenses.push(
        new vscode.CodeLens(separatorRange, {
          title: `📁 当前工作空间: ${fileWorkspace.workspaceName} (编辑)`,
          command: "pawsql.selectFileDefaultWorkspace",
          arguments: [document.uri],
        })
      );
    } else if (defaultWorkspace) {
      codeLenses.push(
        new vscode.CodeLens(separatorRange, {
          title: `📁 默认工作空间: ${defaultWorkspace.workspaceName} (点击选择)`,
          command: "pawsql.selectFileDefaultWorkspace",
          arguments: [document.uri],
        })
      );
    } else {
      codeLenses.push(
        new vscode.CodeLens(separatorRange, {
          title: "📁 配置文件默认工作空间",
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

        this.addQueryCodeLenses(codeLenses, queryRange, query, fileWorkspace);
      } else {
        const queryRange = new vscode.Range(startPos, endPos);
        this.addQueryCodeLenses(codeLenses, queryRange, query, fileWorkspace);
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
    // 添加使用默认工作空间的优化按钮
    codeLenses.push(
      new vscode.CodeLens(queryRange, {
        title: "⚡ Optimize",
        command: COMMANDS.OPTIMIZE_WITH_FILE_DEFAULT_WORKSPACE,
        arguments: [query, fileWorkspace?.workspaceId, queryRange], // 传递范围
      })
    );

    // 添加选择其他工作空间的优化按钮
    codeLenses.push(
      new vscode.CodeLens(queryRange, {
        title: "⚡ Optimize...",
        command: COMMANDS.OPTIMIZE_WITH_FILE_SELECTED_WORKSPACE,
        arguments: [query, queryRange], // 传递范围
      })
    );
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
