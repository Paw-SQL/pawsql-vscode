import * as vscode from "vscode";
import { ConfigurationService } from "./configurationService";
import { ApiService } from "./apiService";
import { OptimizationService } from "./optimizationService";

let workspaceCommandDisposables: vscode.Disposable[] = []; // 用于存储工作空间命令的 Disposable

export async function activate(context: vscode.ExtensionContext) {
  const apiKey = await ConfigurationService.getApiKey();
  await vscode.commands.executeCommand(
    "setContext",
    "pawsql:hasApiKey",
    !!apiKey
  );

  await initCommand(context, apiKey);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("pawsql.apiKey")) {
        const newApiKey = await ConfigurationService.getApiKey();
        console.log("更新workspace menu，当前的apikey:" + newApiKey);
        await updateMenuWhenApikeyConfigChanged(context, newApiKey);
      }
    })
  );
}

const updateMenuWhenApikeyConfigChanged = async (
  context: vscode.ExtensionContext,
  userKey: string | undefined
) => {
  clearWorkspaceCommands(); // 清除之前的命令

  if (userKey) {
    try {
      registerSelectWorkspaceCommand(userKey, context);
      await vscode.commands.executeCommand(
        "setContext",
        "pawsql:hasApiKey",
        true
      );
    } catch (error: any) {
      console.log(error);
      vscode.window.showErrorMessage(
        "无法获取工作空间列表：" + error.response.data.message
      );
    }
  } else {
    await vscode.commands.executeCommand(
      "setContext",
      "pawsql:hasApiKey",
      false
    );
  }
};

const clearWorkspaceCommands = () => {
  // 清空已注册的工作空间命令
  workspaceCommandDisposables.forEach((cmd) => cmd.dispose());
  workspaceCommandDisposables = []; // 清空数组
};

const initCommand = async (
  context: vscode.ExtensionContext,
  userKey: string | undefined
) => {
  const initApiKeyCommand = vscode.commands.registerCommand(
    "pawsql.noApiKeyHint",
    async () => {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "pawsql.apiKey"
      );
    }
  );
  context.subscriptions.push(initApiKeyCommand);

  const configureApiKeyCommand = vscode.commands.registerCommand(
    "pawsql.configureApiKey",
    async () => {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "pawsql.apiKey"
      );
    }
  );
  context.subscriptions.push(configureApiKeyCommand);

  await updateMenuWhenApikeyConfigChanged(context, userKey);
};

const registerSelectWorkspaceCommand = (
  userKey: string,
  context: vscode.ExtensionContext
) => {
  const disposable = vscode.commands.registerCommand(
    "pawsql.selectWorkspace",
    async () => {
      const workspaces = await ApiService.getWorkspaces(userKey);
      console.log(workspaces.data);
      console.log(workspaces.data.total === "0");

      // 检查工作空间列表是否为空
      if (workspaces.data.total === "0") {
        console.log("显示创建工作空间连接提醒");

        const openLink = "去创建工作空间"; // 提示信息中的链接文本
        const choice = await vscode.window.showInformationMessage(
          "当前没有工作空间。请登录 pawsql.com 创建自己的工作空间。",
          openLink
        );

        // 如果用户选择了链接文本，打开指定的链接
        if (choice === openLink) {
          const uri = vscode.Uri.parse(
            "https://www.pawsql.com/app/workspaces/new-workspace"
          );
          await vscode.env.openExternal(uri);
        }

        return; // 直接返回，避免后续逻辑
      }

      const workspaceItems = workspaces.data.records.map((workspace) => ({
        label: workspace.workspaceName,
        workspaceId: workspace.workspaceId,
      }));

      const selected = await vscode.window.showQuickPick(workspaceItems, {
        placeHolder: "请选择一个工作空间进行优化",
      });

      if (selected) {
        optimizeSql(selected.workspaceId);
      }
    }
  );
  workspaceCommandDisposables.push(disposable); // 存储新注册的命令

  context.subscriptions.push(disposable);
};

const optimizeSql = async (workspaceId: string) => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("未找到活动编辑器");
    return;
  }

  const selection = editor.selection;
  const sql = editor.document.getText(selection);

  if (!sql) {
    vscode.window.showErrorMessage("请选择SQL文本");
    return;
  }

  vscode.window.showInformationMessage(
    `正在使用工作空间 ID "${workspaceId}" 优化 SQL...`
  );

  try {
    const userKey = await ConfigurationService.getApiKey();
    const analysisResponse = await OptimizationService.createAnalysis({
      userKey: userKey!,
      workspace: workspaceId,
      workload: sql,
      queryMode: "plain_sql", // 这里假设使用普通SQL模式，您可以根据需要进行调整
    });

    console.log(analysisResponse);

    // 获取优化结果
    const summaryResponse = await OptimizationService.getAnalysisSummary({
      userKey: userKey!,
      analysisId: analysisResponse.data.analysisId,
    });

    console.log(summaryResponse);

    await showOptimizationResult(summaryResponse.data);
  } catch (error: any) {
    vscode.window.showErrorMessage("SQL 优化失败：" + error.message);
  }
};

const showOptimizationResult = async (result: any) => {
  const panel = vscode.window.createWebviewPanel(
    "pawsqlOptimizationResult",
    "SQL优化结果",
    vscode.ViewColumn.One,
    {}
  );

  const htmlContent = generateOptimizationResultHTML(result.basicSummary);
  panel.webview.html = htmlContent;
};

const generateOptimizationResultHTML = (result: any): string => {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SQL优化结果</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>优化结果</h1>
    <p>状态: ${result.status}</p>
    <p>优化ID: ${result.analysisId}</p>
    <h2>SQL语句分析</h2>
    <pre>${result.summaryMarkdownZh || "无分析结果"}</pre>
</body>
</html>`;
};

export function deactivate() {}
