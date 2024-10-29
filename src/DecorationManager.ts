import * as vscode from "vscode";
import { getEditorQueryDetails } from "./utils/pawsqlUtils";

export class DecorationManager {
  private readonly highlightDecoration: vscode.TextEditorDecorationType;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.highlightDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor("pawsql.currentQueryBg"),
      borderColor: new vscode.ThemeColor("pawsql.currentQueryOutline"),
      borderWidth: "1px",
      borderStyle: "solid",
    });
  }

  public registerDecorationListeners(): void {
    // 当活动编辑器改变时更新高亮
    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.updateHighlight(editor);
        }
      })
    );

    // 监听文本变化
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (
          vscode.window.activeTextEditor &&
          event.document === vscode.window.activeTextEditor.document
        ) {
          this.updateHighlight(vscode.window.activeTextEditor);
        }
      })
    );

    // 监听选择变化
    this.context.subscriptions.push(
      vscode.window.onDidChangeTextEditorSelection((event) => {
        if (event.textEditor === vscode.window.activeTextEditor) {
          this.updateHighlight(event.textEditor);
        }
      })
    );
  }

  private updateHighlight(editor: vscode.TextEditor): void {
    if (editor.document.languageId !== "sql") {
      return;
    }

    const { currentQuery, range } = getEditorQueryDetails(editor);
    if (currentQuery) {
      editor.setDecorations(this.highlightDecoration, [range]);
    } else {
      editor.setDecorations(this.highlightDecoration, []);
    }
  }

  public dispose(): void {
    this.highlightDecoration.dispose();
  }
}
