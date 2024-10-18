import * as vscode from "vscode";
import { ApiService } from "./services/apiService";
import { ConfigurationService } from "./services/configurationService";
import { OptimizationService } from "./services/optimizationService";

export function activate(context: vscode.ExtensionContext) {
  const apiService = new ApiService();
  const configService = new ConfigurationService();
  const optimizationService = new OptimizationService(apiService);

  // Store workspace command disposables for cleanup
  let workspaceCommandDisposables: vscode.Disposable[] = [];

  // 配置 API Key 命令
  let configureApiKeyCommand = vscode.commands.registerCommand(
    "pawsql.configureApiKey",
    async () => {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "pawsql.apiKey"
      );
    }
  );

  // 未配置提示命令
  let notConfiguredCommand = vscode.commands.registerCommand(
    "pawsql.notConfigured",
    () => {
      vscode.window.showInformationMessage("请先配置 API Key");
    }
  );

  // 使用工作空间优化命令
  let optimizeWithWorkspaceCommand = vscode.commands.registerCommand(
    "pawsql.optimizeWithWorkspace",
    async (workspaceId: string, workspaceName: string) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const selection = editor.selection;
      const text = editor.document.getText(selection);

      if (!text) {
        vscode.window.showErrorMessage("请选择SQL文本");
        return;
      }

      try {
        vscode.window.showInformationMessage(
          `正在使用工作空间 "${workspaceName}" 优化SQL...`
        );
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

  // 清理工作空间命令
  function disposeWorkspaceCommands() {
    workspaceCommandDisposables.forEach((d) => d.dispose());
    workspaceCommandDisposables = [];
  }

  // 动态更新工作空间菜单
  async function updateWorkspaceMenu() {
    const apiKey = await configService.getApiKey();

    // 更新 API Key 状态上下文
    await vscode.commands.executeCommand(
      "setContext",
      "pawsql:hasApiKey",
      Boolean(apiKey)
    );

    // 清理现有的工作空间命令
    disposeWorkspaceCommands();

    if (!apiKey) {
      // 注册未配置提示命令
      const notConfiguredDisposable = vscode.commands.registerCommand(
        "pawsql.workspace.notConfigured",
        () => vscode.commands.executeCommand("pawsql.notConfigured")
      );
      workspaceCommandDisposables.push(notConfiguredDisposable);

      // 添加未配置提示菜单项
      const extension = vscode.extensions.getExtension("your-publisher.pawsql");
      if (extension) {
        const packageJson = extension.packageJSON;
        packageJson.contributes.menus["pawsql.workspaceMenu"] = [
          {
            command: "pawsql.workspace.notConfigured",
            group: "workspace",
            title: "未配置 API Key，点击配置",
          },
        ];
      }
      return;
    }

    try {
      const workspaces = await apiService.getWorkspaces();

      // 为每个工作空间创建命令
      const workspaceCommands = workspaces.map((workspace) => {
        const commandId = `pawsql.workspace.${workspace.id}`;

        // 注册工作空间特定的命令
        const disposable = vscode.commands.registerCommand(commandId, () =>
          vscode.commands.executeCommand(
            "pawsql.optimizeWithWorkspace",
            workspace.id,
            workspace.name
          )
        );

        return {
          disposable,
          menuItem: {
            command: commandId,
            group: "workspace",
            title: workspace.name,
            when: "pawsql:hasApiKey",
          },
        };
      });

      // 添加命令到disposables
      workspaceCommandDisposables = workspaceCommands.map(
        (wc) => wc.disposable
      );
      context.subscriptions.push(...workspaceCommandDisposables);

      // 更新菜单配置
      const extension = vscode.extensions.getExtension("your-publisher.pawsql");
      if (extension) {
        const packageJson = extension.packageJSON;
        packageJson.contributes.menus["pawsql.workspaceMenu"] =
          workspaceCommands.map((wc) => wc.menuItem);
      }
    } catch (error: any) {
      vscode.window.showErrorMessage("获取工作空间列表失败：" + error.message);

      // 错误时显示错误提示菜单项
      const extension = vscode.extensions.getExtension("your-publisher.pawsql");
      if (extension) {
        const packageJson = extension.packageJSON;
        packageJson.contributes.menus["pawsql.workspaceMenu"] = [
          {
            command: "pawsql.workspace.error",
            group: "workspace",
            title: "获取工作空间失败，请检查 API Key",
          },
        ];
      }
    }
  }

  // 监听配置变化
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("pawsql.apiKey")) {
        await updateWorkspaceMenu();
      }
    })
  );

  // 初始化时更新菜单
  updateWorkspaceMenu();

  context.subscriptions.push(
    configureApiKeyCommand,
    notConfiguredCommand,
    optimizeWithWorkspaceCommand
  );
}
function showOptimizationResult(result: any) {
  return `
		  <!DOCTYPE html>
		  <html>
			  <head>
				  <meta charset="UTF-8">
				  <style>
					  body {
						  padding: 20px;
						  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
						  line-height: 1.6;
					  }
					  .section {
						  margin-bottom: 24px;
						  padding: 16px;
						  border-radius: 8px;
						  background: #f8f9fa;
					  }
					  .sql-box {
						  background: #2d2d2d;
						  color: #fff;
						  padding: 16px;
						  border-radius: 4px;
						  overflow-x: auto;
					  }
					  .improvement {
						  padding: 8px 16px;
						  margin: 8px 0;
						  border-left: 4px solid #ffd700;
						  background: #fff;
					  }
					  .metrics {
						  display: grid;
						  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
						  gap: 16px;
					  }
					  .metric-card {
						  background: #fff;
						  padding: 16px;
						  border-radius: 4px;
						  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
					  }
					  .suggestion {
						  background: #e9ecef;
						  padding: 12px;
						  margin: 8px 0;
						  border-radius: 4px;
					  }
				  </style>
			  </head>
			  <body>
				  <h2>SQL优化结果</h2>
				  
				  <div class="section">
					  <h3>原始SQL</h3>
					  <pre class="sql-box">${result.originalSql}</pre>
					  
					  <h3>优化后SQL</h3>
					  <pre class="sql-box">${result.optimizedSql}</pre>
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
							  <pre>${sug.example}</pre>
						  </div>
					  `
              )
              .join("")}
				  </div>
			  </body>
		  </html>
	  `;
}
