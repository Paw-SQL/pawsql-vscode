import * as vscode from "vscode";

// 模拟 API 调用
async function getToken(): Promise<string> {
  return new Promise((resolve) =>
    setTimeout(() => resolve("mock-token"), 1000)
  );
}

async function getWorkspaces(token: string): Promise<string[]> {
  // 模拟返回工作空间列表
  return new Promise((resolve) =>
    setTimeout(
      () => resolve(["Workspace 1", "Workspace 2", "Workspace 3"]),
      1000
    )
  );
}

async function optimizeSql(
  token: string,
  workspace: string,
  sql: string,
  type: string
): Promise<string> {
  // 模拟 SQL 优化请求
  return new Promise((resolve) =>
    setTimeout(() => resolve("mock-optimization-id"), 1000)
  );
}

async function getOptimizationResult(
  token: string,
  optimizationId: string
): Promise<any> {
  // 模拟获取优化结果
  return new Promise((resolve) =>
    setTimeout(
      () => resolve({ result: "优化成功", details: "优化详细信息" }),
      1000
    )
  );
}

export async function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "pawsql.optimizeSql",
    async () => {
      const token = await getToken(); // 获取 token
      const workspaces = await getWorkspaces(token); // 获取工作空间列表

      // 选择工作空间
      const workspace = await selectWorkspace(workspaces);
      if (!workspace) {
        vscode.window.showErrorMessage("未选择工作空间");
        return;
      }

      // 获取选中的 SQL 语句
      const editor = vscode.window.activeTextEditor;
      let sql: string | undefined;

      if (editor) {
        sql = editor.document.getText(editor.selection);
      }

      // 如果没有选中的 SQL，则请求输入
      if (!sql) {
        sql = await vscode.window.showInputBox({
          placeHolder: "请输入要优化的 SQL 语句",
        });
      }

      if (!sql) {
        vscode.window.showErrorMessage("请提供 SQL 语句进行优化");
        return;
      }

      const optimizationId = await optimizeSql(token, workspace, sql, "sql"); // 执行优化
      const result = await getOptimizationResult(token, optimizationId);

      vscode.window.showInformationMessage(
        `优化结果: ${JSON.stringify(result)}`
      );
    }
  );

  context.subscriptions.push(disposable);
}

// 选择工作空间的函数
async function selectWorkspace(
  workspaces: string[]
): Promise<string | undefined> {
  const workspaceChoices = workspaces.map((workspace) => {
    return { label: workspace, value: workspace };
  });

  const selectedWorkspace = await vscode.window.showQuickPick(
    workspaceChoices,
    {
      placeHolder: "选择工作空间进行 SQL 优化",
    }
  );

  return selectedWorkspace?.value; // 返回选择的工作空间
}
