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
    if (this.settingPanel) {
      this.settingPanel.reveal(vscode.ViewColumn.One);
      this.settingPanel.webview.html = this.getSettingsWebviewContent(
        this.settingPanel.webview,
        vscode.Uri.file(
          path.join(this.context.extensionPath, "dist", "webview.js")
        )
      );
      return;
    }

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
    );
    this.settingPanel.iconPath = vscode.Uri.file(iconPath);

    const webviewJsPath = vscode.Uri.file(
      path.join(this.context.extensionPath, "dist", "webview.js")
    );

    this.settingPanel.webview.html = this.getSettingsWebviewContent(
      this.settingPanel.webview,
      webviewJsPath
    );

    this.settingPanel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "alert":
            vscode.window.showErrorMessage(message.text);
            return;
          case "saveConfig":
            this.handleSaveConfig(message.config);
            vscode.commands.executeCommand(
              "workbench.view.extension.pawsqlContainer"
            );
            return;
          case "getConfig":
            if (this.settingPanel) {
              this.handleGetConfig(this.settingPanel);
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

    this.settingPanel.onDidDispose(() => {
      this.settingPanel = undefined;
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
    const password = await this.passwordManager.getPassword();

    const config = {
      email: vscode.workspace.getConfiguration("pawsql").get("email") || "",
      password,
      backendUrl:
        vscode.workspace.getConfiguration("pawsql").get("backendUrl") || "",
    };

    panel.webview.postMessage({ command: "configResponse", ...config });
  }

  private async handleSaveConfig(config: {
    email: string;
    password: string;
    backendUrl: string;
  }) {
    try {
      // These operations need to be awaited as they involve async operations
      await Promise.all([
        this.treeProvider.updateApikey(config),
        this.passwordManager.storePassword(config.password),
        vscode.workspace
          .getConfiguration("pawsql")
          .update("email", config.email, true),
        vscode.workspace
          .getConfiguration("pawsql")
          .update("backendUrl", config.backendUrl, true),
      ]);

      await this.treeProvider.refresh();

      vscode.window.showInformationMessage(
        LanguageService.getMessage("webview.settings.save.config.success")
      );
    } catch (error: any) {
      console.log(error);
      vscode.window.showErrorMessage(
        `${LanguageService.getMessage(error.message)}`
      );
    }
  }

  public createResultPanel(
    analysisStmtId: string,
    analysisName: string
  ): vscode.WebviewPanel {
    if (this.resultPanels.has(analysisStmtId)) {
      const existingPanel = this.resultPanels.get(analysisStmtId)!;
      existingPanel.reveal(vscode.ViewColumn.Two);
      existingPanel.webview.html = this.getWebviewContent(analysisStmtId);
      return existingPanel;
    }

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
    );
    newPanel.iconPath = vscode.Uri.file(iconPath);
    newPanel.webview.html = this.getWebviewContent(analysisStmtId);

    this.resultPanels.set(analysisStmtId, newPanel);

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

    newPanel.onDidDispose(() => {
      this.resultPanels.delete(analysisStmtId);
    });

    return newPanel;
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
    const statementUrl = `${URLS.STATEMENT_BASE}/${analysisStmtId}`;

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
