// 在扩展代码中使用 SecretStorage
import * as vscode from "vscode";

export class PasswordManager {
  constructor(private context: vscode.ExtensionContext) {}

  // 存储密码
  async storePassword(password: string) {
    await this.context.secrets.store("pawsql-password", password);
  }

  // 获取密码
  async getPassword(): Promise<string | undefined> {
    return await this.context.secrets.get("pawsql-password");
  }

  // 删除密码
  async deletePassword() {
    await this.context.secrets.delete("pawsql-password");
  }
}
