declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: any) => void;
      getState: () => any; // 根据需要添加其他函数的类型
    };
  }
}

// 如果没有这个行，TypeScript 可能会认为这个文件是一个模块
export {};
