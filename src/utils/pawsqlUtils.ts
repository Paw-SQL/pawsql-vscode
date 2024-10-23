import { window, Range, Selection } from "vscode";
import parse from "./parse";

export const getEditorQueryDetails = (editor: any) => {
  if (!editor || !editor.document || editor.document.uri.scheme === "output") {
    return {
      currentQuery: null,
      range: null,
    };
  }

  // 如果用户已经选择了查询块，直接返回该块内容
  if (!editor.selection.isEmpty) {
    return {
      currentQuery: editor.document.getText(editor.selection),
      range: editor.selection,
    };
  }

  // 自动获取光标所在行的 SQL 查询
  const text = editor.document.getText();
  const currentOffset = editor.document.offsetAt(editor.selection.active);
  const prefix = text.slice(0, currentOffset);
  const allQueries = parse(text);
  const prefixQueries = parse(prefix);

  const currentQuery = allQueries[prefixQueries.length - 1];
  const startIndex = prefix.lastIndexOf(
    prefixQueries[prefixQueries.length - 1]
  );
  const startPos = editor.document.positionAt(startIndex);
  const endPos = editor.document.positionAt(startIndex + currentQuery.length);

  return {
    currentQuery,
    range: new Range(startPos, endPos),
  };
};
