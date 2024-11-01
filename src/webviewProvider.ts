import path from "path";
import { getUrls } from "./constants";
import { LanguageService } from "./LanguageService";
import * as vscode from "vscode";

export class WebviewProvider {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public createSettingsPanel() {
    const panel = vscode.window.createWebviewPanel(
      "reactWebview",
      "React Webview",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      }
    );

    const webviewJsPath = vscode.Uri.file(
      path.join(this.context.extensionPath, "dist", "webview.js")
    );

    panel.webview.html = this.getSettingsWebviewContent(
      panel.webview,
      webviewJsPath
    );

    panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "alert":
            vscode.window.showInformationMessage(message.text);
            return;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  public createResultPanel(analysisStmtId: string): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      "pawsqlOptimizationResult",
      LanguageService.getMessage("webview.anlysis.result.title"),
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = this.getWebviewContent(analysisStmtId);

    panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "showError":
            vscode.window.showErrorMessage(message.text);
            break;
          case "openLink":
            vscode.env.openExternal(vscode.Uri.parse(message.url));
            break;
        }
      },
      undefined,
      []
    );

    return panel;
  }

  private getSettingsWebviewContent(
    webview: vscode.Webview,
    scriptPath: vscode.Uri
  ): string {
    const scriptUri = webview.asWebviewUri(scriptPath);

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>React Webview</title>
          <style>
            body { padding: 20px; }
            button { 
              padding: 8px 16px;
              background: #007acc;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            }
            button:hover {
              background: #005999;
            }
          </style>
      </head>
      <body>
          <div id="settings-webview"></div>
          <script src="${scriptUri}"></script>
      </body>
      </html>`;
  }

  private getWebviewContent(analysisStmtId: string): string {
    const { URLS } = getUrls();
    const queryUrl = `${URLS.QUERY_BASE}/${analysisStmtId}`;
    const statementUrl = `${URLS.STATEMENT_BASE}/${analysisStmtId}`;

    return `<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${LanguageService.getMessage("webview.anlysis.result.title")}</title>
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
        .iframe-container {
            width: 100%;
            height: 100%;
        }
        #openLink {
            background-color: #ffffff;
            color: #333333;
            border: 2px solid #cccccc;
            border-radius: 5px;
            padding: 5px 10px;
            font-size: 12px;
            cursor: pointer;
            position: fixed;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            transition: background-color 0.3s, color 0.3s;
        }

        #openLink:hover {
            background-color: #f0f0f0;
            color: #000000;
        }
    </style>
</head>
<body>
    <button id="openLink">${LanguageService.getMessage("open.in.browser")}${
      getUrls().DOMAIN.Frontend
    }</button>
    <div class="iframe-container">
        <iframe 
            src="${queryUrl}"
            title=${LanguageService.getMessage("webview.anlysis.result.title")}
            allowfullscreen>
        </iframe>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('openLink').addEventListener('click', () => {
                vscode.postMessage({ command: 'openLink', url: '${statementUrl}' });
            });
        });
    </script>
</body>
</html>`;
  }
}
