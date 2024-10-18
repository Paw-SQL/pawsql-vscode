export class ApiService {
  private mockWorkspaces = [
    { id: "ws1", name: "开发环境工作空间" },
    { id: "ws2", name: "测试环境工作空间" },
    { id: "ws3", name: "生产环境工作空间" },
  ];

  private mockOptimizeResponse = {
    originalSql: "",
    optimizedSql: "",
    improvements: [],
    performance: {},
    suggestions: [],
  };

  async getWorkspaces(): Promise<any[]> {
    // 模拟API延迟
    await new Promise((resolve) => setTimeout(resolve, 500));
    return this.mockWorkspaces;
  }

  async optimizeSql(sql: string, workspaceId: string): Promise<any> {
    // 模拟API延迟
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 根据不同的SQL返回不同的优化建议
    const response = {
      ...this.mockOptimizeResponse,
      originalSql: sql,
      optimizedSql: this.getOptimizedSql(sql),
      improvements: this.getImprovements(sql),
      performance: this.getPerformanceMetrics(),
      suggestions: this.getSuggestions(sql),
    };

    return response;
  }

  private getOptimizedSql(sql: string): string {
    // 模拟SQL优化
    // 示例：为SELECT语句添加索引提示
    if (sql.toLowerCase().includes("select")) {
      return sql.replace(
        /select\s+/i,
        "SELECT /*+ INDEX(table_name idx_column) */ "
      );
    }
    return sql;
  }

  private getImprovements(sql: string): any[] {
    // 根据SQL特征返回相应的改进建议
    const improvements = [];

    if (sql.toLowerCase().includes("select *")) {
      improvements.push({
        type: "performance",
        severity: "warning",
        message: "建议指定具体的列名替代 SELECT *",
        impact: "减少不必要的数据传输，提高查询效率",
      });
    }

    if (!sql.toLowerCase().includes("where")) {
      improvements.push({
        type: "performance",
        severity: "warning",
        message: "没有WHERE条件可能导致全表扫描",
        impact: "建议添加适当的查询条件",
      });
    }

    return improvements;
  }

  private getPerformanceMetrics(): any {
    return {
      estimatedCost: Math.random() * 100,
      estimatedRows: Math.floor(Math.random() * 1000),
      executionTime: Math.random() * 2,
      indexUsage: Math.random() * 100,
    };
  }

  private getSuggestions(sql: string): any[] {
    const suggestions = [];

    // 索引建议
    if (sql.toLowerCase().includes("where")) {
      suggestions.push({
        type: "index",
        message: "建议在WHERE子句中的列上创建索引",
        example: "CREATE INDEX idx_column ON table_name(column_name)",
      });
    }

    // 分页建议
    if (!sql.toLowerCase().includes("limit")) {
      suggestions.push({
        type: "pagination",
        message: "建议添加LIMIT子句进行分页",
        example: sql + " LIMIT 100",
      });
    }

    return suggestions;
  }
}
