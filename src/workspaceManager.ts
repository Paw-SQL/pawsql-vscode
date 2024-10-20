import * as vscode from "vscode";
export class WorkspaceManager {
  private disposables: vscode.Disposable[] = [];

  clear(): void {
    this.disposables.forEach((cmd) => {
      try {
        cmd.dispose();
      } catch (error) {
        console.error("清除命令失败:", error);
      }
    });
    this.disposables = [];
  }

  addDisposable(disposable: vscode.Disposable): void {
    this.disposables.push(disposable);
  }
}
