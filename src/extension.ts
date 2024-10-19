import * as vscode from "vscode";
import { ApiService } from "./services/apiService";
import { ConfigurationService } from "./services/configurationService";
import { OptimizationService } from "./services/optimizationService";

const registeredWorkspaceCommands: vscode.Disposable[] = [];

export async function activate(context: vscode.ExtensionContext) {
  const apiService = new ApiService();
  const configService = new ConfigurationService();
  const optimizationService = new OptimizationService(apiService);

  // 获取 API Key 并设置状态
  const apiKey = await configService.getApiKey();
  await vscode.commands.executeCommand(
    "setContext",
    "pawsql:hasApiKey",
    !!apiKey
  );

  registerConfigureApiKeyCommand(context);
  registerConfigureApiKeyCommandWhenHasNoApiKey(context);

  // 注册优化 SQL 的命令
  registerOptimizeWithWorkspaceCommand(context, optimizationService);

  // 根据 API Key 的状态更新工作空间菜单
  await updateWorkspaceMenu(apiService, context, !!apiKey);

  // 监听 API Key 配置的变化
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      console.log(`e.affectsConfiguration("pawsql.apiKey")`);
      console.log(e.affectsConfiguration("pawsql.apiKey"));

      if (e.affectsConfiguration("pawsql.apiKey")) {
        const newApiKey = await configService.getApiKey();
        console.log("当前的apikey:" + newApiKey);
        console.log(newApiKey);

        console.log("该不该更新按钮");
        console.log(!!newApiKey);

        // 根据新的 API Key 状态更新工作空间菜单
        await updateWorkspaceMenu(apiService, context, !!newApiKey);
      }
    })
  );
}

async function updateWorkspaceMenu(
  apiService: ApiService,
  context: vscode.ExtensionContext,
  apiKeyPresent: boolean
) {
  try {
    console.log(apiKeyPresent);

    if (apiKeyPresent) {
      // 如果存在 API Key，更新工作空间命令
      const workspaces = await apiService.getWorkspaces();

      // 清除旧的工作空间命令
      clearWorkspaceCommands();

      // 注册新的工作空间命令
      workspaces.forEach((workspace) => {
        registerWorkspaceCommand(workspace, context);
      });

      // 确保 `pawsql:hasApiKey` 状态为 true
      await vscode.commands.executeCommand(
        "setContext",
        "pawsql:hasApiKey",
        true
      );
    } else {
      // 如果没有 API Key，移除工作空间相关命令并展示提示
      clearWorkspaceCommands();

      // 确保 `pawsql:hasApiKey` 状态为 false
      await vscode.commands.executeCommand(
        "setContext",
        "pawsql:hasApiKey",
        false
      );

      // // 注册一个配置 API Key 的提示命令
      // registerConfigureApiKeyCommandWhenHasNoApiKey(context);
    }
  } catch (error: any) {
    vscode.window.showErrorMessage("工作空间更新失败：" + error.message);
  }
}

// 清除之前注册的工作空间命令
function clearWorkspaceCommands() {
  // 遍历已注册的命令，并逐个 dispose
  registeredWorkspaceCommands.forEach((command) => command.dispose());

  // 清空命令列表
  registeredWorkspaceCommands.length = 0;
}

// 注册配置 API Key 的命令
function registerConfigureApiKeyCommand(context: vscode.ExtensionContext) {
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
}

// 注册配置 未添加 API Key 时配置的命令
function registerConfigureApiKeyCommandWhenHasNoApiKey(
  context: vscode.ExtensionContext
) {
  const configureApiKeyCommand = vscode.commands.registerCommand(
    "pawsql.noApiKeyHint",
    async () => {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "pawsql.apiKey"
      );
    }
  );
  context.subscriptions.push(configureApiKeyCommand);
}

// 注册优化 SQL 的命令
function registerOptimizeWithWorkspaceCommand(
  context: vscode.ExtensionContext,
  optimizationService: OptimizationService
) {
  const optimizeWithWorkspaceCommand = vscode.commands.registerCommand(
    "pawsql.optimizeWithWorkspace",
    async (workspaceId: string, workspaceName: string) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("未找到活动编辑器");
        return;
      }

      const selection = editor.selection;
      const text = editor.document.getText(selection);

      if (!text) {
        vscode.window.showErrorMessage("请选择SQL文本");
        return;
      }

      vscode.window.showInformationMessage(
        `正在使用工作空间 "${workspaceName}" 优化SQL...`
      );

      try {
        const optimizedSql = await optimizationService.optimizeSql(
          text,
          workspaceId
        );
        await showOptimizationResult(optimizedSql);
      } catch (error: any) {
        vscode.window.showErrorMessage("SQL优化失败：" + error.message);
      }
    }
  );
  context.subscriptions.push(optimizeWithWorkspaceCommand);
}
// 在注册工作空间命令时将其存储到 registeredWorkspaceCommands 中
function registerWorkspaceCommand(
  workspace: { id: string; name: string },
  context: vscode.ExtensionContext
) {
  const commandId = `pawsql.workspace.${workspace.id}`;
  const disposable = vscode.commands.registerCommand(commandId, async () => {
    // 命令执行逻辑
    await vscode.commands.executeCommand(
      "pawsql.optimizeWithWorkspace",
      workspace.id,
      workspace.name
    );
  });

  // 将命令添加到已注册的命令列表中
  registeredWorkspaceCommands.push(disposable);

  // 也可以继续将其加入到 context.subscriptions 中进行全局管理
  context.subscriptions.push(disposable);
}

// 显示优化结果
function showOptimizationResult(result: any) {
  const panel = vscode.window.createWebviewPanel(
    "pawsqlOptimizationResult",
    "SQL优化结果",
    vscode.ViewColumn.One,
    {}
  );

  const htmlContent = generateOptimizationResultHTML(result);
  panel.webview.html = htmlContent;
}

// 生成优化结果的 HTML 页面
function generateOptimizationResultHTML(result: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { padding: 20px; font-family: sans-serif; }
        .section { margin-bottom: 24px; }
        .sql-box { background: #2d2d2d; color: #fff; padding: 16px; border-radius: 4px; }
        .improvement { background: #f0f0f0; margin: 8px 0; padding: 8px; border-left: 4px solid #ffd700; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .metric-card { background: #fff; padding: 16px; border-radius: 4px; }
        .suggestion { background: #e9ecef; padding: 12px; margin: 8px 0; border-radius: 4px; }
      </style>
    </head>
    <body>
      <h2>SQL优化结果</h2>

      <div class="section">
        <h3>原始SQL</h3>
        <pre class="sql-box">${escapeHtml(result.originalSql)}</pre>
        <h3>优化后SQL</h3>
        <pre class="sql-box">${escapeHtml(result.optimizedSql)}</pre>
      </div>

      <div class="section">
        <h3>改进建议</h3>
        ${result.improvements
          .map(
            (imp: { message: any; impact: any }) => `
          <div class="improvement">
            <strong>${imp.message}</strong>
            <p>影响: ${imp.impact}</p>
          </div>
        `
          )
          .join("")}
      </div>

      <div class="section">
        <h3>性能指标</h3>
        <div class="metrics">
          <div class="metric-card">
            <strong>预估成本</strong>
            <p>${result.performance.estimatedCost.toFixed(2)}</p>
          </div>
          <div class="metric-card">
            <strong>预估行数</strong>
            <p>${result.performance.estimatedRows}</p>
          </div>
          <div class="metric-card">
            <strong>执行时间</strong>
            <p>${result.performance.executionTime.toFixed(2)}s</p>
          </div>
          <div class="metric-card">
            <strong>索引使用率</strong>
            <p>${result.performance.indexUsage.toFixed(2)}%</p>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>优化建议</h3>
        ${result.suggestions
          .map(
            (sug: { message: any; example: any }) => `
          <div class="suggestion">
            <strong>${sug.message}</strong>
            <pre>${escapeHtml(sug.example)}</pre>
          </div>
        `
          )
          .join("")}
      </div>
    </body>
    </html>
  `;
}

// HTML 转义函数
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
