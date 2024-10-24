import * as vscode from "vscode";
import { getEditorQueryDetails } from "./utils/pawsqlUtils"; // 请根据实际路径修改
import { WorkspaceItem } from "./types";

export class SqlCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor(private context: vscode.ExtensionContext) {}

  provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    return this.createCodeLenses(document);
  }

  resolveCodeLens?(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens> {
    return codeLens;
  }

  // 触发 CodeLens 更新
  public refresh() {
    this._onDidChangeCodeLenses.fire();
  }

  private createCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];

    // 获取当前活动的编辑器
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor && activeEditor.document === document) {
      // 将 document 作为 editor 传递给 getEditorQueryDetails
      const { currentQuery, range } = getEditorQueryDetails(activeEditor);
      // 获取 pawsql:recentWorkspacesCount 配置值

      const configuration = vscode.workspace.getConfiguration("pawsql");
      const recentWorkspaces =
        configuration.get<WorkspaceItem[]>("recentWorkspaces") || [];

      // 只有在最近工作空间数量 >= 1 时才添加 CodeLens
      if (currentQuery && range && recentWorkspaces.length >= 1) {
        // 添加“使用上次的优化空间进行优化”按钮
        codeLenses.push(
          new vscode.CodeLens(range, {
            command: "pawsql.recentWorkspace",
            title: "使用上次的优化空间进行优化",
            arguments: [currentQuery],
          })
        );
      }
    }

    return codeLenses;
  }
}
