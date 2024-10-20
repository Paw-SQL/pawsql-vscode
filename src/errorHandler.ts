import * as vscode from "vscode";
import { LanguageService } from "./LanguageService";

export class ErrorHandler {
  static handle(message: string, error: any): void {
    console.error(`${message}:`, error);
    const errorMessage =
      error.response?.data?.message || error.message || "unknown.error";

    // 确保 errorMessage 是一个有效的国际化键
    const translatedMessage = LanguageService.getMessage(errorMessage);

    vscode.window.showErrorMessage(
      `${LanguageService.getMessage(message)}: ${translatedMessage}`
    );
  }
}
