import { PawSQLExtension } from "./main";
import * as vscode from "vscode";

let extension: PawSQLExtension;

export async function activate(context: vscode.ExtensionContext) {
  extension = new PawSQLExtension(context);
  await extension.activate();
}

export function deactivate() {
  extension?.deactivate();
}
