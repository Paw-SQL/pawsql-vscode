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
  const allQueries = parse(text);

  // 如果光标在注释中，查找下一个有效的查询
  if (isCursorInComment(text, currentOffset)) {
    const nextQueryInfo = findNextValidQuery(text, currentOffset, allQueries);
    if (nextQueryInfo) {
      const { query, startIndex } = nextQueryInfo;
      const startPos = editor.document.positionAt(startIndex);
      const endPos = editor.document.positionAt(startIndex + query.length);
      return {
        currentQuery: query,
        range: new Range(startPos, endPos),
      };
    }
    return {
      currentQuery: null,
      range: null,
    };
  }

  // 处理常规情况（光标不在注释中）
  const prefix = text.slice(0, currentOffset);
  const prefixQueries = parse(prefix);

  if (prefixQueries.length === 0) {
    return {
      currentQuery: null,
      range: null,
    };
  }

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

// 检查光标是否在注释内
const isCursorInComment = (text: string, offset: number): boolean => {
  let isInComment = false;
  let isInString = false;
  let i = 0;

  while (i < offset) {
    const char = text[i];

    // 处理字符串
    if (!isInComment && (char === "'" || char === '"')) {
      isInString = !isInString;
      i++;
      continue;
    }

    // 跳过字符串内容
    if (isInString) {
      i++;
      continue;
    }

    // 处理单行注释
    if (char === "-" && text[i + 1] === "-") {
      const nextNewline = text.indexOf("\n", i);
      if (nextNewline === -1 || nextNewline >= offset) {
        return true;
      }
      i = nextNewline + 1;
      continue;
    }

    // 处理多行注释
    if (char === "/" && text[i + 1] === "*") {
      const commentEnd = text.indexOf("*/", i);
      if (commentEnd === -1 || commentEnd >= offset) {
        return true;
      }
      i = commentEnd + 2;
      continue;
    }

    i++;
  }

  return false;
};

// 在给定位置后找到下一个有效的SQL查询
const findNextValidQuery = (
  text: string,
  currentOffset: number,
  allQueries: string[]
): { query: string; startIndex: number } | null => {
  // 找到当前注释的结束位置
  let commentEnd = currentOffset;
  let isMultilineComment = false;

  // 检查是否在多行注释中
  const beforeComment = text.slice(0, currentOffset).lastIndexOf("/*");
  if (
    beforeComment !== -1 &&
    text.slice(beforeComment, currentOffset).indexOf("*/") === -1
  ) {
    isMultilineComment = true;
    const endComment = text.indexOf("*/", currentOffset);
    commentEnd = endComment !== -1 ? endComment + 2 : text.length;
  } else {
    // 单行注释情况
    const nextNewline = text.indexOf("\n", currentOffset);
    commentEnd = nextNewline !== -1 ? nextNewline + 1 : text.length;
  }

  // 在注释结束位置之后查找查询
  for (const query of allQueries) {
    const queryStart = text.indexOf(query, commentEnd);
    if (queryStart !== -1) {
      return {
        query,
        startIndex: queryStart,
      };
    }
  }

  return null;
};
