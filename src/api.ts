// api.ts
export async function getToken(): Promise<string> {
  // 模拟网络延迟
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("mock-token"); // 返回一个模拟的 Token
    }, 500); // 模拟 0.5 秒的网络延迟
  });
}

export async function getWorkspaces(token: string): Promise<string[]> {
  // 模拟网络延迟
  return new Promise((resolve) => {
    setTimeout(() => {
      if (token === "mock-token") {
        resolve(["Workspace 1", "Workspace 2", "Workspace 3"]); // 返回模拟的工作空间
      } else {
        resolve([]); // 如果 Token 无效，返回空数组
      }
    }, 1000); // 模拟 1 秒的网络延迟
  });
}

export async function optimizeSql(
  token: string,
  workspace: string,
  sql: string
): Promise<string> {
  // 模拟网络延迟
  return new Promise((resolve) => {
    setTimeout(() => {
      if (token === "mock-token") {
        resolve("mock-optimization-id"); // 返回一个模拟的优化 ID
      } else {
        throw new Error("无效的 Token"); // 模拟 Token 无效
      }
    }, 1000); // 模拟 1 秒的网络延迟
  });
}

export async function getOptimizationResult(
  token: string,
  optimizationId: string
): Promise<any> {
  // 模拟网络延迟
  return new Promise((resolve) => {
    setTimeout(() => {
      if (token === "mock-token" && optimizationId === "mock-optimization-id") {
        // 返回一个模拟的优化结果
        resolve({
          id: optimizationId,
          status: "优化成功",
          optimizedSql: "SELECT * FROM users WHERE active = 1", // 返回优化后的 SQL
        });
      } else {
        throw new Error("无法获取优化结果"); // 模拟无法获取结果
      }
    }, 1000); // 模拟 1 秒的网络延迟
  });
}
