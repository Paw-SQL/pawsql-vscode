import * as React from "react";
import ConfigForm from "./components/ConfigForm";
import * as ReactDOM from "react-dom";

interface Config {
  apiKey: string;
  backendUrl: string;
  frontendUrl: string;
}

const App: React.FC = () => {
  const [config, setConfig] = React.useState<Config>({
    apiKey: "",
    backendUrl: "",
    frontendUrl: "",
  });

  const handleConfigSubmit = (newConfig: Config) => {
    const vscode = window.acquireVsCodeApi();
    vscode.postMessage({
      command: "saveConfig",
      config: newConfig,
    });
  };

  React.useEffect(() => {
    const vscode = window.acquireVsCodeApi();

    // 监听来自 VSCode 的消息
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "configResponse") {
        setConfig(message); // 更新状态
      }
    };

    window.addEventListener("message", messageHandler);

    // 初始化时请求配置
    vscode.postMessage({ command: "getConfig" });

    // 清理函数
    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, []);

  return (
    <div>
      <ConfigForm initialConfig={config} onSubmit={handleConfigSubmit} />
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("settings-webview"));
