class QueryParser {
  static parse(
    query: string,
    driver: "pg" | "mysql" | "mssql" | "cql" = "mysql"
  ): Array<string> {
    if (driver === "mssql") {
      query = query.replace(/^[ \t]*GO;?[ \t]*$/gim, "");
    }
    const delimiter: string = ";";
    const queries: Array<string> = [];
    let restOfQuery: string | null = query;

    while (restOfQuery && restOfQuery.trim() !== "") {
      const statementAndRest = QueryParser.getStatements(
        restOfQuery,
        driver,
        delimiter
      );

      const statement = statementAndRest[0];
      if (statement && statement.trim() !== "") {
        queries.push(statement);
      }

      restOfQuery = statementAndRest[1];
    }

    return queries;
  }

  static getStatements(
    query: string,
    driver: string,
    delimiter: string
  ): [string | null, string | null] {
    let previousChar: string | null = null;
    let isInComment: boolean = false;
    let isInString: boolean = false;
    let isInTag: boolean = false;
    let nextChar: string | null = null;
    let commentChar: string | null = null;
    let stringChar: string | null = null;
    let tagChar: string | null = null;
    const charArray: Array<string> = Array.from(query);

    let resultQueries: [string | null, string | null] = [null, null];
    for (let index = 0; index < charArray.length; index++) {
      let char = charArray[index];
      previousChar = index > 0 ? charArray[index - 1] : null;
      nextChar = index < charArray.length ? charArray[index + 1] : null;

      if (
        previousChar !== "\\" &&
        (char === "'" || char === '"') &&
        !isInString &&
        !isInComment
      ) {
        isInString = true;
        stringChar = char;
        continue;
      }

      if (
        ((char === "#" && nextChar === " ") ||
          (char === "-" && nextChar === "-") ||
          (char === "/" && nextChar === "*")) &&
        !isInString
      ) {
        isInComment = true;
        commentChar = char;
        continue;
      }

      if (
        isInComment &&
        (((commentChar === "#" || commentChar === "-") && char === "\n") ||
          (commentChar === "/" && char === "*" && nextChar === "/"))
      ) {
        isInComment = false;
        commentChar = null;
        continue;
      }

      if (previousChar !== "\\" && char === stringChar && isInString) {
        isInString = false;
        stringChar = null;
        continue;
      }

      if (char.toLowerCase() === "d" && !isInComment && !isInString) {
        const delimiterResult = QueryParser.getDelimiter(index, query, driver);
        if (delimiterResult) {
          const delimiterSymbol: string = delimiterResult[0];
          const delimiterEndIndex: number = delimiterResult[1];
          query = query.substring(delimiterEndIndex);
          resultQueries = QueryParser.getStatements(
            query,
            driver,
            delimiterSymbol
          );
          break;
        }
      }

      if (char === "$" && !isInComment && !isInString) {
        const queryUntilTagSymbol = query.substring(index);
        if (!isInTag) {
          const tagSymbolResult = QueryParser.getTag(
            queryUntilTagSymbol,
            driver
          );
          if (tagSymbolResult) {
            isInTag = true;
            tagChar = tagSymbolResult[0];
          }
        } else {
          const tagSymbolResult = QueryParser.getTag(
            queryUntilTagSymbol,
            driver
          );
          if (tagSymbolResult && tagSymbolResult[0] === tagChar) {
            isInTag = false;
            tagChar = null;
          }
        }
      }

      if (
        driver === "mssql" &&
        char.toLowerCase() === "g" &&
        `${charArray[index + 1] || ""}`.toLowerCase() === "o" &&
        /go\b/gi.test(`${char}${charArray[index + 1]}${charArray[index + 2]}`)
      ) {
        char = `${char}${charArray[index + 1]}`;
      }

      if (
        (char.toLowerCase() === delimiter.toLowerCase() ||
          char.toLowerCase() === "go") &&
        !isInString &&
        !isInComment &&
        !isInTag
      ) {
        let splittingIndex = index + 1;
        if (driver === "mssql" && char.toLowerCase() === "go") {
          splittingIndex = index;
          resultQueries = QueryParser.getQueryParts(query, splittingIndex, 2);
          break;
        }
        resultQueries = QueryParser.getQueryParts(query, splittingIndex);
        break;
      }
    }

    if (!resultQueries[0]) {
      query = query?.trim() || "";
      resultQueries = [query, null];
    }

    return resultQueries;
  }

  static getQueryParts(
    query: string,
    splittingIndex: number,
    numChars: number = 1
  ): [string | null, string | null] {
    let statement: string = query.substring(0, splittingIndex).trim();
    const restOfQuery: string = query
      .substring(splittingIndex + numChars)
      .trim();
    return [statement || null, restOfQuery || null];
  }

  static getDelimiter(
    index: number,
    query: string,
    driver: string
  ): [string, number] | null {
    if (driver === "mysql") {
      const delimiterKeyword = "delimiter ";
      const delimiterLength = delimiterKeyword.length;
      const parsedQueryAfterIndexOriginal = query.substring(index);
      const indexOfDelimiterKeyword = parsedQueryAfterIndexOriginal
        .toLowerCase()
        .indexOf(delimiterKeyword);

      if (indexOfDelimiterKeyword === 0) {
        let parsedQueryAfterIndex = query.substring(index);
        let indexOfNewLine = parsedQueryAfterIndex.indexOf("\n");
        indexOfNewLine = indexOfNewLine === -1 ? query.length : indexOfNewLine;
        parsedQueryAfterIndex = parsedQueryAfterIndex
          .substring(0, indexOfNewLine)
          .substring(delimiterLength);

        let delimiterSymbol = QueryParser.clearTextUntilComment(
          parsedQueryAfterIndex
        );
        delimiterSymbol = delimiterSymbol?.trim() || "";

        if (delimiterSymbol) {
          const delimiterSymbolEndIndex =
            parsedQueryAfterIndexOriginal.indexOf(delimiterSymbol) +
            index +
            delimiterSymbol.length;
          return [delimiterSymbol, delimiterSymbolEndIndex];
        }
      }
    }
    return null;
  }

  static getTag(query: string, driver: string): [string, number] | null {
    if (driver === "pg") {
      const matchTag = query.match(/^(\$[a-zA-Z]*\$)/i);
      if (matchTag && matchTag.length > 1) {
        const tagSymbol = matchTag[1].trim();
        const indexOfCmd = query.indexOf(tagSymbol);
        return [tagSymbol, indexOfCmd];
      }
    }
    return null;
  }

  static clearTextUntilComment(text: string): string | null {
    let clearedText: string | null = null;
    const charArray: Array<string> = Array.from(text);

    for (let index = 0; index < charArray.length; index++) {
      const char = charArray[index];
      const nextChar = index < charArray.length ? charArray[index + 1] : null;

      if (
        (char === "#" && nextChar === " ") ||
        (char === "-" && nextChar === "-") ||
        (char === "/" && nextChar === "*")
      ) {
        break;
      } else {
        clearedText = clearedText ? clearedText + char : char;
      }
    }

    return clearedText;
  }
}

export default QueryParser.parse;
