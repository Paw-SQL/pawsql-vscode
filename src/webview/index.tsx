import * as React from "react";
import * as ReactDOM from "react-dom";
import ConfigForm from "./components/ConfigForm";

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

  const vscode = React.useMemo(() => {
    return window.acquireVsCodeApi();
  }, []);

  const handleConfigSubmit = React.useCallback(
    (newConfig: Config) => {
      vscode.postMessage({
        command: "saveConfig",
        config: newConfig,
      });
    },
    [vscode]
  );

  React.useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      console.log("Received message:", message);

      if (message.command === "configResponse") {
        const newConfig = {
          apiKey: message.apiKey || "",
          backendUrl: message.backendUrl || "",
          frontendUrl: message.frontendUrl || "",
        };
        console.log("Updating config:", newConfig);
        setConfig(newConfig);
      }
    };

    window.addEventListener("message", messageHandler);

    // Request initial config
    console.log("Requesting initial config");
    vscode.postMessage({ command: "getConfig" });

    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, [vscode]);

  return (
    <div>
      <ConfigForm initialConfig={config} onSubmit={handleConfigSubmit} />
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("settings-webview"));
