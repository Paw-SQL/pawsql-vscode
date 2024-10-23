import * as vscode from "vscode";
import { getEditorQueryDetails } from "./utils/pawsqlUtils"; // 请根据实际路径修改

export class SqlCodeLensProvider implements vscode.CodeLensProvider {
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

  private createCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];

    // 获取当前活动的编辑器
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor && activeEditor.document === document) {
      // 将 document 作为 editor 传递给 getEditorQueryDetails
      const { currentQuery, range } = getEditorQueryDetails(activeEditor);

      console.log(currentQuery, range);

      if (currentQuery && range) {
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
