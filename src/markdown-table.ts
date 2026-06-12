import { HEADER_SIGNATURE_SEPARATOR } from "./constants";
import type { MarkdownTableColumn, MarkdownTableSpec } from "./types";

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

  const signature = specHeaderSignature(tableSpec);
  if (signature) {
    for (const currentSpec of extractMarkdownTableSpecs(markdown)) {
      if (specHeaderSignature(currentSpec) === signature) {
        return currentSpec.separatorLineIndex;
      }
    }
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
