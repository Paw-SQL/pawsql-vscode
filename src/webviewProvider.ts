import { URLS } from "./constants";
import { SummaryResponse } from "./types";
import * as vscode from "vscode";

export class WebviewProvider {
  static createResultPanel(
    result: SummaryResponse["data"]
  ): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      "pawsqlOptimizationResult",
      "SQL优化结果",
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    const analysisStmtId = result.summaryStatementInfo[0]?.analysisStmtId || "";
    panel.webview.html = this.getWebviewContent(analysisStmtId);

    return panel;
  }

  private static getWebviewContent(analysisStmtId: string): string {
    const statementUrl = `${URLS.STATEMENT_BASE}/${analysisStmtId}`;

    return `
    <!DOCTYPE html>
    <html lang="zh">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SQL优化结果</title>
        <style>
            body, html { 
                margin: 0;
                padding: 0;
                height: 100%;
                overflow: hidden;
            }
            iframe {
                width: 100%;
                height: 100%;
                border: none;
            }
        </style>
    </head>
    <body>
        <iframe 
            src="${statementUrl}"
            title="SQL优化结果"
            allowfullscreen>
        </iframe>
    </body>
    </html>`;
  }
}