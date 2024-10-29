class QueryParser {
  static parse(
    query: string,
    driver: "pg" | "mysql" | "mssql" | "cql" = "mysql"
  ): Array<string> {
    // 移除 MSSQL 的 GO 命令
    if (driver === "mssql") {
      query = query.replace(/^[ \t]*GO;?[ \t]*$/gim, "");
    }

    const delimiter: string = ";"; // 定义分隔符
    const queries: Array<string> = [];
    let restOfQuery: string | null = query;

    while (restOfQuery && restOfQuery.trim() !== "") {
      const [statement, newRestOfQuery] = QueryParser.getStatements(
        restOfQuery,
        driver,
        delimiter
      );

      if (statement && statement.trim() !== "") {
        queries.push(statement.trim()); // 添加查询并去除多余空白
      }

      restOfQuery = newRestOfQuery; // 更新剩余查询
    }

    return queries;
  }

  static getStatements(
    query: string,
    driver: string,
    delimiter: string
  ): [string | null, string | null] {
    let isInComment: boolean = false;
    let isInString: boolean = false;
    let charArray: Array<string> = Array.from(query);
    let statementStart: number | null = null; // 记录查询的起始位置

    for (let index = 0; index < charArray.length; index++) {
      const char = charArray[index];

      // 处理字符串
      if (!isInComment && (char === "'" || char === '"')) {
        isInString = !isInString;
        // 如果在字符串中，不处理此字符
        continue;
      }

      // 处理单行注释
      if (!isInString && char === "-" && charArray[index + 1] === "-") {
        isInComment = true; // 开始单行注释
        continue;
      }

      // 处理多行注释
      if (!isInString && char === "/" && charArray[index + 1] === "*") {
        isInComment = true; // 开始多行注释
        index++; // 跳过 '*'
        continue;
      }

      // 结束单行注释
      if (isInComment && char === "\n") {
        isInComment = false; // 结束单行注释
        continue;
      }

      // 结束多行注释
      if (isInComment && char === "*" && charArray[index + 1] === "/") {
        isInComment = false; // 结束多行注释
        index++; // 跳过 '/'
        continue;
      }

      // 如果当前在注释中，跳过后续处理
      if (isInComment) {
        continue;
      }

      // 处理分隔符
      if (
        char === delimiter ||
        (driver === "mssql" &&
          char.toLowerCase() === "g" &&
          charArray[index + 1]?.toLowerCase() === "o")
      ) {
        // 查找分隔符
        if (statementStart !== null) {
          const splittingIndex = index + 1; // 分隔符后面的索引
          return QueryParser.getQueryParts(
            query,
            splittingIndex,
            statementStart
          );
        }
      }

      // 记录查询起始位置
      if (
        !isInComment &&
        !isInString &&
        statementStart === null &&
        char.trim()
      ) {
        statementStart = index; // 记录查询的起始位置
      }
    }

    // 如果没有找到分隔符，返回剩余的查询
    if (statementStart !== null) {
      return [query.substring(statementStart).trim(), null]; // 返回整个查询
    }

    return [null, null]; // 如果没有找到任何查询
  }

  static getQueryParts(
    query: string,
    splittingIndex: number,
    statementStart: number
  ): [string | null, string | null] {
    const statement: string = query
      .substring(statementStart, splittingIndex)
      .trim();
    const restOfQuery: string = query.substring(splittingIndex).trim();
    return [statement || null, restOfQuery || null];
  }
}

export default QueryParser.parse;
