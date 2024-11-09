import * as React from "react";
import * as ReactDOM from "react-dom";
import ConfigForm from "./components/ConfigForm";
import { IntlProvider, FormattedMessage } from "react-intl";
import messages_en from "../i18n/en.json";
import messages_zh from "../i18n/zh-cn.json";

// 定义消息类型
interface Messages {
  [key: string]: string; // 定义键为字符串，值为字符串
}

const messages: { [key: string]: Messages } = {
  en: messages_en as Messages, // 使用类型断言
  "zh-cn": messages_zh as Messages, // 使用类型断言
};

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

  const [locale, setLocale] = React.useState<"en" | "zh-cn">("en"); // 使用字面量类型

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

      if (message.command === "languageResponse") {
        setLocale(message.locale);
      }
    };

    window.addEventListener("message", messageHandler);

    // Request initial config
    console.log("Requesting initial config");
    vscode.postMessage({ command: "getConfig" });
    vscode.postMessage({ command: "getLanguage" });

    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, [vscode]);

  return (
    <IntlProvider locale={locale} messages={messages[locale]}>
      <div>
        <ConfigForm
          vscode={vscode}
          initialConfig={config}
          onSubmit={handleConfigSubmit}
        />
      </div>
    </IntlProvider>
  );
};

ReactDOM.render(<App />, document.getElementById("settings-webview"));
