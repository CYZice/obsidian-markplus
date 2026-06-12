import {
  CONTENT_SIGNATURE_SEPARATOR,
  HEADER_SIGNATURE_SEPARATOR,
  ROW_SIGNATURE_SEPARATOR,
} from "./constants";
import type {
  MarkdownTableColumn,
  MarkdownTableSpec,
  MarkdownViewLike,
  TableAlignment,
} from "./types";

export function extractMarkdownTableSpecs(markdown: string): MarkdownTableSpec[] {
  const lines = markdown.split(/\r?\n/);
  const specs: MarkdownTableSpec[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const separator = parseSeparatorLine(lines[lineIndex]);
    if (!separator) {
      continue;
    }

    const headerLine = lines[lineIndex - 1] || "";
    const headerCells = splitMarkdownRow(headerLine);
    if (!headerCells.length) {
      continue;
    }

    const bodyLines: string[] = [];
    let bodyIndex = lineIndex + 1;
    while (bodyIndex < lines.length) {
      const line = lines[bodyIndex];
      if (!isMarkdownTableRow(line)) {
        break;
      }

      bodyLines.push(line);
      bodyIndex += 1;
    }

    specs.push({
      separatorLineIndex: lineIndex,
      headerLineIndex: lineIndex - 1,
      tableOrdinal: specs.length,
      columns: separator.columns,
      headerCells,
      bodyLines,
      rawHeaderLine: headerLine,
      rawSeparatorLine: lines[lineIndex],
    });

    lineIndex = bodyIndex - 1;
  }

  return specs;
}

export function findSeparatorLineForSpec(
  markdown: string,
  tableSpec: MarkdownTableSpec | null,
): number | null {
  if (!tableSpec || typeof markdown !== "string") {
    return null;
  }

  const specs = extractMarkdownTableSpecs(markdown);
  const matched = matchSpecForSection(tableSpec, specs);
  if (matched) {
    return matched.separatorLineIndex;
  }

  const lines = markdown.split(/\r?\n/);
  const { separatorLineIndex } = tableSpec;
  return Number.isInteger(separatorLineIndex) &&
    separatorLineIndex >= 0 &&
    separatorLineIndex < lines.length &&
    parseSeparatorLine(lines[separatorLineIndex])
    ? separatorLineIndex
    : null;
}

export function parseSeparatorLine(
  line: string,
): { columns: MarkdownTableColumn[] } | null {
  const cells = splitMarkdownRow(line);
  if (!cells.length) {
    return null;
  }

  const columns: MarkdownTableColumn[] = [];
  for (const cell of cells) {
    const match = cell.trim().match(/^(:)?(-{3,})(:)?$/);
    if (!match) {
      return null;
    }

    columns.push({
      alignLeft: Boolean(match[1]),
      alignRight: Boolean(match[3]),
      dashCount: match[2].length,
    });
  }

  return { columns };
}

export function getMarkdownLineIndexForTableRow(
  tableSpec: MarkdownTableSpec,
  rowIndex: number,
): number {
  return rowIndex === 0
    ? tableSpec.headerLineIndex
    : tableSpec.separatorLineIndex + rowIndex;
}

export function getCellSourceText(
  tableSpec: MarkdownTableSpec | null,
  rowIndex: number,
  colIndex: number,
): string | null {
  if (!tableSpec) {
    return null;
  }

  if (rowIndex === 0) {
    return (tableSpec.headerCells[colIndex] ?? "").trim();
  }

  const bodyIndex = rowIndex - 1;
  if (bodyIndex < 0 || bodyIndex >= tableSpec.bodyLines.length) {
    return null;
  }

  return (splitMarkdownRow(tableSpec.bodyLines[bodyIndex])[colIndex] ?? "").trim();
}

export function buildMarkdownTableRow(cells: unknown[]): string {
  return `| ${cells.map((cell) => String(cell).trim()).join(" | ")} |`;
}

export function replaceCellInMarkdownRow(
  line: string,
  colIndex: number,
  nextValue: string,
): string {
  const cells = splitMarkdownRow(line);
  if (colIndex < 0 || colIndex >= cells.length) {
    return line;
  }

  cells[colIndex] = nextValue;
  return buildMarkdownTableRow(cells);
}

export function splitMarkdownRow(line: string): string[] {
  if (!line.includes("|")) {
    return [];
  }

  let normalized = line.trim();
  normalized = normalized.startsWith("|") ? normalized.slice(1) : normalized;
  normalized = normalized.endsWith("|") ? normalized.slice(0, -1) : normalized;
  return normalized.split("|");
}

export function buildSeparatorLine(
  tableSpec: MarkdownTableSpec,
  dashCounts: number[],
): string {
  return `| ${dashCounts
    .map((dashCount, index) => {
      const column = tableSpec.columns[index] || {
        alignLeft: false,
        alignRight: false,
      };
      const dashes = "-".repeat(Math.max(3, dashCount));
      return `${column.alignLeft ? ":" : ""}${dashes}${column.alignRight ? ":" : ""}`;
    })
    .join(" | ")} |`;
}

export function buildSeparatorLineFromColumns(
  columns: Array<MarkdownTableColumn | null>,
): string {
  return `| ${columns
    .map((column) => {
      const current = column || { alignLeft: false, alignRight: false, dashCount: 3 };
      const dashes = "-".repeat(Math.max(3, current.dashCount || 3));
      return `${current.alignLeft ? ":" : ""}${dashes}${current.alignRight ? ":" : ""}`;
    })
    .join(" | ")} |`;
}

export function reorderColumnsByHeader(
  previousSpec: MarkdownTableSpec,
  currentSpec: MarkdownTableSpec,
): MarkdownTableColumn[] | null {
  const prevHeaders = previousSpec.headerCells || [];
  const currHeaders = currentSpec.headerCells || [];
  if (!prevHeaders.length || prevHeaders.length !== currHeaders.length) {
    return null;
  }

  if (
    previousSpec.columns.length !== prevHeaders.length ||
    currentSpec.columns.length !== currHeaders.length
  ) {
    return null;
  }

  const headerMap = new Map<string, number[]>();
  prevHeaders.forEach((header, index) => {
    const normalized = normalizeHeaderCell(header);
    const indices = headerMap.get(normalized) || [];
    indices.push(index);
    headerMap.set(normalized, indices);
  });

  const reorderedIndexes: number[] = [];
  for (const header of currHeaders) {
    const normalized = normalizeHeaderCell(header);
    const indices = headerMap.get(normalized);
    if (!indices || !indices.length) {
      return null;
    }

    reorderedIndexes.push(indices.shift() as number);
  }

  if (reorderedIndexes.every((index, currentIndex) => index === currentIndex)) {
    return null;
  }

  const reorderedColumns = reorderedIndexes.map(
    (index) => previousSpec.columns[index],
  );
  return reorderedColumns.some((column) => !column) ? null : reorderedColumns;
}

export function transferColumnsToCurrentLayout(
  previousSpec: MarkdownTableSpec,
  currentSpec: MarkdownTableSpec,
): { columns: MarkdownTableColumn[]; matchedCount: number } | null {
  const prevHeaders = previousSpec.headerCells || [];
  const currHeaders = currentSpec.headerCells || [];
  const currentColumns = currentSpec.columns || [];

  if (!prevHeaders.length || !currHeaders.length) {
    return null;
  }

  const headerMap = new Map<string, number[]>();
  prevHeaders.forEach((header, index) => {
    const normalized = normalizeHeaderCell(header);
    const indices = headerMap.get(normalized) || [];
    indices.push(index);
    headerMap.set(normalized, indices);
  });

  const usedIndexes = new Set<number>();
  const mappedIndexes = Array.from(
    { length: currHeaders.length },
    () => null as number | null,
  );

  currHeaders.forEach((header, index) => {
    const normalized = normalizeHeaderCell(header);
    const indices = headerMap.get(normalized);
    if (indices && indices.length) {
      const previousIndex = indices.shift() as number;
      usedIndexes.add(previousIndex);
      mappedIndexes[index] = previousIndex;
    }
  });

  if (prevHeaders.length === currHeaders.length) {
    currHeaders.forEach((_, index) => {
      if (mappedIndexes[index] !== null || usedIndexes.has(index) || index >= prevHeaders.length) {
        return;
      }

      mappedIndexes[index] = index;
      usedIndexes.add(index);
    });
  }

  return {
    columns: currentColumns.map((column, index) => {
      const previousIndex = mappedIndexes[index];
      return (previousIndex === null ? null : previousSpec.columns[previousIndex]) || column;
    }),
    matchedCount: mappedIndexes.filter((index) => index !== null).length,
  };
}

export function normalizeMatchText(value: unknown): string {
  return String(value || "")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function domTableHeaderSignature(table: HTMLTableElement): string | null {
  const headerRow = table.rows && table.rows[0];
  return headerRow && headerRow.cells.length
    ? Array.from(headerRow.cells)
        .map((cell) => normalizeMatchText(cell.textContent))
        .join(HEADER_SIGNATURE_SEPARATOR)
    : null;
}

export function specHeaderSignature(tableSpec: MarkdownTableSpec | null): string | null {
  return tableSpec && Array.isArray(tableSpec.headerCells) && tableSpec.headerCells.length
    ? tableSpec.headerCells
        .map((cell) => normalizeMatchText(cell))
        .join(HEADER_SIGNATURE_SEPARATOR)
    : null;
}

export function domTableBodySignature(table: HTMLTableElement): string | null {
  return !(table instanceof HTMLTableElement) || table.rows.length < 2
    ? null
    : Array.from(table.rows)
        .slice(1)
        .map((row) =>
          Array.from(row.cells)
            .map((cell) => normalizeMatchText(cell.textContent))
            .join(HEADER_SIGNATURE_SEPARATOR),
        )
        .join(ROW_SIGNATURE_SEPARATOR);
}

export function specBodySignature(tableSpec: MarkdownTableSpec | null): string | null {
  return tableSpec && Array.isArray(tableSpec.bodyLines) && tableSpec.bodyLines.length
    ? tableSpec.bodyLines
        .map((line) =>
          splitMarkdownRow(line)
            .map((cell) => normalizeMatchText(cell))
            .join(HEADER_SIGNATURE_SEPARATOR),
        )
        .join(ROW_SIGNATURE_SEPARATOR)
    : null;
}

export function domTableContentSignature(table: HTMLTableElement): string | null {
  if (!(table instanceof HTMLTableElement) || !table.rows?.length) {
    return null;
  }

  const rows = Array.from(table.rows).map((row) =>
    Array.from(row.cells).map((cell) => normalizeMatchText(cell.textContent)),
  );
  if (!rows.length || !rows[0].length) {
    return null;
  }

  const headerSignature = rows[0].join(HEADER_SIGNATURE_SEPARATOR);
  const previewBody = rows
    .slice(1, 3)
    .map((row) => row.join(HEADER_SIGNATURE_SEPARATOR))
    .join(ROW_SIGNATURE_SEPARATOR);
  return [rows.length, rows[0].length, headerSignature, previewBody].join(
    CONTENT_SIGNATURE_SEPARATOR,
  );
}

export function specContentSignature(tableSpec: MarkdownTableSpec | null): string | null {
  if (!tableSpec?.headerCells?.length) {
    return null;
  }

  const previewBody = Array.isArray(tableSpec.bodyLines)
    ? tableSpec.bodyLines
        .slice(0, 2)
        .map((line) =>
          splitMarkdownRow(line).map((cell) => normalizeMatchText(cell)),
        )
    : [];
  return [
    1 + (Array.isArray(tableSpec.bodyLines) ? tableSpec.bodyLines.length : 0),
    tableSpec.headerCells.length,
    tableSpec.headerCells.map((cell) => normalizeMatchText(cell)).join(HEADER_SIGNATURE_SEPARATOR),
    previewBody.map((row) => row.join(HEADER_SIGNATURE_SEPARATOR)).join(ROW_SIGNATURE_SEPARATOR),
  ].join(CONTENT_SIGNATURE_SEPARATOR);
}

export function matchSpecIndexesByBodySignature(
  bodySignature: string | null,
  specs: MarkdownTableSpec[],
  usedIndexes: Set<number>,
  indexes: number[] | null = null,
): number[] {
  if (!bodySignature) {
    return [];
  }
  return (Array.isArray(indexes) ? indexes : specs.map((_, index) => index)).filter(
    (index) => !usedIndexes.has(index) && specBodySignature(specs[index]) === bodySignature,
  );
}

export function getTableMatchIndex(
  table: Element | null | undefined,
  fallbackIndex: number | null = null,
): number | null {
  const datasetIndex = Number.parseInt((table as HTMLElement | null)?.dataset?.markplusTableOrdinal ?? "", 10);
  return Number.isInteger(datasetIndex) && datasetIndex >= 0
    ? datasetIndex
    : Number.isInteger(fallbackIndex) && (fallbackIndex as number) >= 0
      ? fallbackIndex
      : null;
}

export function getTableSourceLineForDomTable(
  view: MarkdownViewLike | null,
  table: HTMLTableElement,
): number | null {
  const editor = view?.editor;
  if (!editor || typeof editor.posAtDOM !== "function" || !(table instanceof HTMLTableElement)) {
    return null;
  }

  const candidates = [
    table.closest(".cm-table-widget"),
    table.querySelector("thead th"),
    table.querySelector("tr th"),
    table.querySelector("tr td"),
    table,
  ].filter(Boolean) as Node[];

  for (const candidate of candidates) {
    for (const side of [-1, 0, 1]) {
      try {
        const position = editor.posAtDOM(candidate, side);
        if (position && Number.isInteger(position.line) && position.line >= 0) {
          return position.line;
        }
      } catch (_error) {}
    }
  }

  return null;
}

export function matchSpecForSection(
  currentSpec: MarkdownTableSpec,
  specs: MarkdownTableSpec[],
): MarkdownTableSpec | null {
  const contentSignature = specContentSignature(currentSpec);
  if (contentSignature) {
    const exact = specs.filter((spec) => specContentSignature(spec) === contentSignature);
    if (exact.length === 1) {
      return exact[0];
    }
  }

  const bodySignature = specBodySignature(currentSpec);
  if (bodySignature) {
    const exact = specs.filter((spec) => specBodySignature(spec) === bodySignature);
    if (exact.length === 1) {
      return exact[0];
    }
  }

  const headerSignature = specHeaderSignature(currentSpec);
  if (headerSignature) {
    const exact = specs.filter((spec) => specHeaderSignature(spec) === headerSignature);
    if (exact.length === 1) {
      return exact[0];
    }
  }

  if (Number.isInteger(currentSpec.tableOrdinal) && specs[currentSpec.tableOrdinal]) {
    return specs[currentSpec.tableOrdinal];
  }

  return null;
}

export function buildMarkdownTableFromSpec(tableSpec: MarkdownTableSpec | null): string {
  return tableSpec?.rawHeaderLine && tableSpec?.rawSeparatorLine
    ? [tableSpec.rawHeaderLine, tableSpec.rawSeparatorLine, ...(tableSpec.bodyLines || [])].join(
        "\n",
      )
    : "";
}

export function buildMarkdownTableFromElement(table: HTMLTableElement): string {
  const rows = table instanceof HTMLTableElement ? Array.from(table.rows) : [];
  if (!rows.length) {
    return "";
  }

  const markdownRows = rows.map(
    (row) =>
      `| ${Array.from(row.cells)
        .map((cell) => (cell.textContent ?? "").trim().replace(/\|/g, "\\|"))
        .join(" | ")} |`,
  );
  if (markdownRows.length === 1) {
    markdownRows.push(`| ${Array.from(rows[0].cells, () => "---").join(" | ")} |`);
  }
  return markdownRows.join("\n");
}

export function getTableMarkdownForCopy(
  view: MarkdownViewLike | null,
  tableSpec: MarkdownTableSpec | null,
  table: HTMLTableElement,
): string {
  const editor = view?.editor;
  if (editor && tableSpec) {
    const start = tableSpec.headerLineIndex;
    const end = tableSpec.separatorLineIndex + (tableSpec.bodyLines?.length ?? 0);
    if (
      Number.isInteger(start) &&
      start >= 0 &&
      start <= end &&
      (!editor.lineCount || end < editor.lineCount())
    ) {
      const lines: string[] = [];
      for (let lineIndex = start; lineIndex <= end; lineIndex += 1) {
        lines.push(editor.getLine(lineIndex));
      }
      if (lines.length >= 2 && parseSeparatorLine(lines[1])) {
        return lines.join("\n");
      }
    }
  }

  return buildMarkdownTableFromSpec(tableSpec) || buildMarkdownTableFromElement(table);
}

export function alignmentToColumnFlags(alignment: TableAlignment): {
  alignLeft: boolean;
  alignRight: boolean;
} {
  return {
    alignLeft: alignment !== "right",
    alignRight: alignment !== "left",
  };
}

export function getColumnAlignmentKind(
  column: MarkdownTableColumn | null | undefined,
): TableAlignment | null {
  if (!column) {
    return null;
  }
  if (column.alignLeft && column.alignRight) {
    return "center";
  }
  if (column.alignRight) {
    return "right";
  }
  if (column.alignLeft) {
    return "left";
  }
  return null;
}

export function getTableAlignmentFromColumns(
  columns: Array<MarkdownTableColumn | null | undefined> | null | undefined,
): TableAlignment | null {
  if (!Array.isArray(columns) || !columns.length) {
    return null;
  }

  const first = getColumnAlignmentKind(columns[0]);
  if (!first) {
    return null;
  }
  return columns.every((column) => getColumnAlignmentKind(column) === first) ? first : null;
}

export function applyAlignmentToColumns(
  columns: MarkdownTableColumn[],
  alignment: TableAlignment,
): MarkdownTableColumn[] {
  const flags = alignmentToColumnFlags(alignment);
  return columns.map((column) => ({
    ...column,
    alignLeft: flags.alignLeft,
    alignRight: flags.alignRight,
  }));
}

export function isMarkdownTableRow(line: string): boolean {
  return splitMarkdownRow(line).length > 0;
}

export function areStringArraysEqual(a: string[], b: string[]): boolean {
  return (
    a === b ||
    (!(!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) &&
      a.every((value, index) => value === b[index]))
  );
}

export function getLineAt(markdown: string, lineIndex: number): string {
  return (typeof markdown === "string" && lineIndex >= 0
    ? markdown.split(/\r?\n/)[lineIndex]
    : "") || "";
}

export function isLikelyTaskSyntaxInsertion(
  previousLine: string,
  currentLine: string,
): boolean {
  return (
    typeof previousLine === "string" &&
    typeof currentLine === "string" &&
    currentLine.length === previousLine.length + 1 &&
    /^\s*-\s$/.test(previousLine) &&
    /^\s*-\s(?:\[)?$/.test(currentLine)
  );
}

function normalizeHeaderCell(value: unknown): string {
  return String(value || "").trim();
}
