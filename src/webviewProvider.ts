import path from "path";
import { getUrls } from "./constants";
import { LanguageService } from "./LanguageService";
import * as vscode from "vscode";
import { PawSQLTreeProvider } from "./PawSQLSidebarProvider";
import { PasswordManager } from "./PasswordManager";

export class WebviewProvider {
  private context: vscode.ExtensionContext;
  private treeProvider: PawSQLTreeProvider;
  private passwordManager: PasswordManager;

  private settingPanel: vscode.WebviewPanel | undefined;
  private resultPanels: Map<string, vscode.WebviewPanel> = new Map();

  constructor(
    context: vscode.ExtensionContext,
    treeProvider: PawSQLTreeProvider
  ) {
    this.context = context;
    this.treeProvider = treeProvider;
    this.passwordManager = new PasswordManager(context);
  }

  public createSettingsPanel() {
    // 如果面板已经存在，重新激活并刷新内容
    if (this.settingPanel) {
      this.settingPanel.reveal(vscode.ViewColumn.One); // 重新显示面板
      this.settingPanel.webview.html = this.getSettingsWebviewContent(
        this.settingPanel.webview,
        vscode.Uri.file(
          path.join(this.context.extensionPath, "dist", "webview.js")
        )
      ); // 刷新内容
      return; // 结束函数
    }

    // 创建新的面板
    this.settingPanel = vscode.window.createWebviewPanel(
      "reactWebview",
      LanguageService.getMessage("form.config.title"),
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      }
    );

    const iconPath = path.join(
      __dirname,
      "../resources/icon/pawsql-black-icon.svg"
    ); // 向上移动到 src 同级
    this.settingPanel.iconPath = vscode.Uri.file(iconPath);

    const webviewJsPath = vscode.Uri.file(
      path.join(this.context.extensionPath, "dist", "webview.js")
    );

    this.settingPanel.webview.html = this.getSettingsWebviewContent(
      this.settingPanel.webview,
      webviewJsPath
    );

    // 监听消息
    this.settingPanel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "alert":
            vscode.window.showErrorMessage(message.text);
            return;
          case "saveConfig":
            this.handleSaveConfig(message.config); // 处理保存配置
            vscode.commands.executeCommand(
              "workbench.view.extension.pawsqlContainer"
            );
            return;
          case "getConfig":
            if (this.settingPanel) {
              this.handleGetConfig(this.settingPanel); // 处理获取配置
            }
            return;
          case "getLanguage":
            if (this.settingPanel) {
              this.handleGetLanguage(this.settingPanel);
            }
            return;
          case "openLink":
            vscode.env.openExternal(vscode.Uri.parse(message.url));
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );

    // 监听面板关闭事件
    this.settingPanel.onDidDispose(() => {
      this.settingPanel = undefined; // 清除面板引用
    });
  }
  private handleGetLanguage(panel: vscode.WebviewPanel) {
    const currentLanguage = vscode.env.language;
    panel.webview.postMessage({
      command: "languageResponse",
      locale: currentLanguage,
    });
  }

  private async handleGetConfig(panel: vscode.WebviewPanel) {
    console.log("this.passwordManager.getPassword()");
    console.log(this.passwordManager.getPassword());

    const config = {
      email: vscode.workspace.getConfiguration("pawsql").get("email") || "",
      password: await this.passwordManager.getPassword(),
      backendUrl:
        vscode.workspace.getConfiguration("pawsql").get("backendUrl") || "",
      frontendUrl:
        vscode.workspace.getConfiguration("pawsql").get("frontendUrl") || "",
    };

    panel.webview.postMessage({ command: "configResponse", ...config });
  }

  // 修改保存配置的方法
  private async handleSaveConfig(config: {
    email: string;
    password: string;
    backendUrl: string;
    frontendUrl: string;
  }) {
    try {
      // 分别更新每个配置项
      await vscode.workspace
        .getConfiguration("pawsql")
        .update("email", config.email, true);

      await vscode.workspace
        .getConfiguration("pawsql")
        .update("password", config.password, true);

      await this.passwordManager.storePassword(config.password);

      await vscode.workspace
        .getConfiguration("pawsql")
        .update("backendUrl", config.backendUrl, true);
      await vscode.workspace
        .getConfiguration("pawsql")
        .update("frontendUrl", config.frontendUrl, true);
      await this.treeProvider.updateApikey(config);
      await this.treeProvider.refresh();
      // 配置保存成功反馈
      vscode.window.showInformationMessage(
        LanguageService.getMessage("webview.settings.save.config.success")
      );
    } catch (error: any) {
      console.log(error);

      // 错误处理
      vscode.window.showErrorMessage(
        `${LanguageService.getMessage(error.message)}`
      );
    }
  }

  public createResultPanel(
    analysisStmtId: string,
    analysisName: string
  ): vscode.WebviewPanel {
    // 检查是否已经存在对应的面板
    if (this.resultPanels.has(analysisStmtId)) {
      const existingPanel = this.resultPanels.get(analysisStmtId)!; // 获取已存在的面板
      existingPanel.reveal(vscode.ViewColumn.Two); // 重新显示面板
      existingPanel.webview.html = this.getWebviewContent(analysisStmtId); // 更新内容
      return existingPanel; // 返回现有面板
    }

    // 创建新的面板
    const newPanel = vscode.window.createWebviewPanel(
      "pawsqlOptimizationResult",
      `${
        analysisName ??
        LanguageService.getMessage("webview.anlysis.result.title")
      }`,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    const iconPath = path.join(
      __dirname,
      "../resources/icon/pawsql-black-icon.svg"
    ); // 向上移动到 src 同级
    newPanel.iconPath = vscode.Uri.file(iconPath);
    newPanel.webview.html = this.getWebviewContent(analysisStmtId);

    // 存储新面板
    this.resultPanels.set(analysisStmtId, newPanel);

    // 监听来自 Webview 的消息
    newPanel.webview.onDidReceiveMessage(
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

    // 监听面板关闭事件
    newPanel.onDidDispose(() => {
      this.resultPanels.delete(analysisStmtId); // 移除对应的面板引用
    });

    return newPanel; // 返回新创建的面板
  }

  private getSettingsWebviewContent(
    webview: vscode.Webview,
    scriptPath: vscode.Uri
  ): string {
    const scriptUri = webview.asWebviewUri(scriptPath);

    return `<!DOCTYPE html>
      <html lang=${vscode.env.language}>
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
    const queryUrl = `${URLS.QUERY_BASE}/${analysisStmtId}?lang=${vscode.env.language}`;
    const statementUrl = `${URLS.STATEMENT_BASE}/${analysisStmtId}?lang=${vscode.env.language}`;

    return `<!DOCTYPE html>
<html lang=${vscode.env.language}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
            allowfullscreen>
        </iframe>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        document.documentElement.lang = "${vscode.env.language}";
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
