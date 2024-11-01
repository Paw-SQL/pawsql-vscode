// src/App.tsx 或其他使用 ConfigForm 的组件
import * as React from "react";
import ConfigForm from "./components/ConfigForm";
import * as ReactDOM from "react-dom";

const App: React.FC = () => {
  const handleConfigSubmit = (config: {
    apiKey: string;
    backendUrl: string;
    frontendUrl: string;
  }) => {
    const vscode = window.acquireVsCodeApi();
    vscode.postMessage({
      command: "saveConfig",
      config,
    });
  };

  return (
    <div>
      <h1>欢迎使用 PawSQL</h1>
      <ConfigForm onSubmit={handleConfigSubmit} />
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("settings-webview"));
