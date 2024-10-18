import * as vscode from "vscode";
import { ApiService } from "./services/apiService";
import { ConfigurationService } from "./services/configurationService";
import { OptimizationService } from "./services/optimizationService";

export async function activate(context: vscode.ExtensionContext) {
  const apiService = new ApiService();
  const configService = new ConfigurationService();
  const optimizationService = new OptimizationService(apiService);

  // 获取 API Key 并设置状态
  const apiKey = await configService.getApiKey();
  console.log(apiKey);

  await vscode.commands.executeCommand(
    "setContext",
    "pawsql:hasApiKey",
    !!apiKey
  );

  registerConfigureApiKeyCommand(context);

  // // 注册未配置 API Key 时的提示命令
  // context.subscriptions.push(
  //   vscode.commands.registerCommand("pawsql.noApiKeyHint", async () => {
  //     await vscode.commands.executeCommand(
  //       "workbench.action.openSettings",
  //       "pawsql.apiKey"
  //     );
  //   })
  // );

  // 注册优化 SQL 的命令
  registerOptimizeWithWorkspaceCommand(context, optimizationService);

  // 如果有 API Key，初始化工作空间菜单
  if (apiKey) {
    await updateWorkspaceMenu(apiService, context);
  }

  // 监听 API Key 配置的变化
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("pawsql.apiKey")) {
        const newApiKey = await configService.getApiKey();
        await vscode.commands.executeCommand(
          "setContext",
          "pawsql:hasApiKey",
          !!newApiKey
        );

        if (newApiKey) {
          await updateWorkspaceMenu(apiService, context);
        }
      }
    })
  );
}

async function updateWorkspaceMenu(
  apiService: ApiService,
  context: vscode.ExtensionContext
) {
  try {
    const workspaces = await apiService.getWorkspaces();

    // 注册每个工作空间的命令
    workspaces.forEach((workspace) => {
      const commandId = `pawsql.workspace.${workspace.id}`;

      // 注册工作空间命令
      const disposable = vscode.commands.registerCommand(
        commandId,
        async () => {
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
            `正在使用工作空间 "${workspace.name}" 优化SQL...`
          );

          try {
            const optimizedSql = await apiService.optimizeSql(
              text,
              workspace.id
            );
            await showOptimizationResult(optimizedSql);
          } catch (error: any) {
            vscode.window.showErrorMessage("SQL优化失败：" + error.message);
          }
        }
      );

      context.subscriptions.push(disposable);

      // 添加到工作空间菜单
      const menuItem = {
        command: commandId,
        group: "workspace",
        when: "pawsql:hasApiKey",
      };

      // 动态添加菜单项
      vscode.commands.executeCommand("setContext", `pawsql:workspaceMenu`, [
        ...((context.workspaceState.get("workspaceMenu") as any[]) || []),
        {
          command: commandId,
          title: workspace.name,
        },
      ]);
    });
  } catch (error: any) {
    vscode.window.showErrorMessage("工作空间更新失败：" + error.message);
  }
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

// 注册特定工作空间的命令
function registerWorkspaceCommand(
  workspace: { id: string; name: string },
  context: vscode.ExtensionContext
) {
  const commandId = `pawsql.workspace.${workspace.id}`;
  const disposable = vscode.commands.registerCommand(commandId, () =>
    vscode.commands.executeCommand(
      "pawsql.optimizeWithWorkspace",
      workspace.id,
      workspace.name
    )
  );
  context.subscriptions.push(disposable);

  return disposable;
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

// HTML转义
function escapeHtml(unsafe: string) {
  return unsafe.replace(/[&<"']/g, (match) => {
    const escapeMap: { [key: string]: string } = {
      "&": "&amp;",
      "<": "&lt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return escapeMap[match];
  });
}
