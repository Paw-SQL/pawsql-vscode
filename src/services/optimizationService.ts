import { ApiService } from "./apiService";

// src/services/optimizationService.ts
export class OptimizationService {
  constructor(private apiService: ApiService) {}

  async optimizeSql(sql: string, workspaceId: string): Promise<any> {
    return this.apiService.optimizeSql(sql, workspaceId);
  }
}
