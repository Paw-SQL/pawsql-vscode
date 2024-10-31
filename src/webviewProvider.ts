import { getUrls } from "./constants";
import { LanguageService } from "./LanguageService";
import { SummaryResponse } from "./types";
import * as vscode from "vscode";

export class WebviewProvider {
  static createResultPanel(analysisStmtId: string): vscode.WebviewPanel {
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

    // 监听来自 Webview 的消息
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
      [] // 如果没有其他需要清理的订阅，可以传入空数组
    );

    return panel;
  }

  static openOptimizationSummary(optimizationId: string) {
    const panel = vscode.window.createWebviewPanel(
      "pawsqlOptimizationResult",
      LanguageService.getMessage("webview.anlysis.result.title"),
      vscode.ViewColumn.Two,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = WebviewProvider.getWebviewContent(optimizationId);
  }

  private static getWebviewContent(analysisStmtId: string): string {
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
            font-size: 30%; /* 调整字体大小到90% */
        }
            #openLink {
            background-color: #ffffff; /* 按钮背景颜色为白色 */
            color: #333333; /* 按钮文本颜色为深灰色 */
            border: 2px solid #cccccc; /* 边框颜色为浅灰色 */
            border-radius: 5px; /* 圆角 */
            padding: 5px 10px; /* 内边距 */
            font-size: 12px; /* 字体大小 */
            cursor: pointer;
            position: fixed; /* 固定在页面 */
            bottom: 10px; /* 距离顶部的距离 */
            left: 50%; /* 水平居中 */
            transform: translateX(-50%); /* 通过平移实现精确居中 */
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); /* 添加阴影效果 */
            transition: background-color 0.3s, color 0.3s; /* 平滑过渡 */
        }

        #openLink:hover {
            background-color: #f0f0f0; /* 悬停时背景颜色为浅灰色 */
            color: #000000; /* 悬停时文本颜色为黑色 */
        }
    </style>
</head>
<body>
    <button id="openLink">${LanguageService.getMessage(
      "open.in.browser"
    )}${getUrls().DOMAIN.Frontend}</button>
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
