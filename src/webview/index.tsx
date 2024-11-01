import * as React from "react";
import * as ReactDOM from "react-dom";

const vscode = window.acquireVsCodeApi();

function App() {
  const [count, setCount] = React.useState(0);

  const handleClick = () => {
    setCount((prev) => prev + 1);
    vscode.postMessage({
      command: "alert",
      text: `Count is now ${count + 1}`,
    });
  };

  return (
    <div>
      <h1>VSCode React Webview</h1>
      <button onClick={handleClick}>Count: {count}</button>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("settings-webview"));
function acquireVsCodeApi() {
  throw new Error("Function not implemented.");
}
