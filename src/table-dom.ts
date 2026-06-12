import { parseNumericValue } from "./formulas";

export interface TableCellCoords {
  rowIndex: number;
  colIndex: number;
}

export function getTableHeaderRow(table: HTMLTableElement): HTMLTableRowElement | null {
  return (table.querySelector("thead tr") as HTMLTableRowElement | null) || table.rows[0] || null;
}

export function getCellCoords(
  table: HTMLTableElement,
  cell: HTMLTableCellElement,
): TableCellCoords {
  const row = cell.parentElement as HTMLTableRowElement;
  return {
    rowIndex: Array.from(table.rows).indexOf(row),
    colIndex: Array.from(row.cells).indexOf(cell),
  };
}

export function getTableCellFromPoint(
  table: HTMLTableElement,
  clientX: number,
  clientY: number,
): HTMLTableCellElement | null {
  if (typeof document.elementsFromPoint === "function") {
    for (const node of document.elementsFromPoint(clientX, clientY)) {
      if (node === table) {
        break;
      }

      if ((node.tagName === "TD" || node.tagName === "TH") && table.contains(node)) {
        return node as HTMLTableCellElement;
      }
    }
  }

  return null;
}

export function computeFillTargets(
  source: TableCellCoords,
  target: TableCellCoords,
): TableCellCoords[] {
  const rowOffset = target.rowIndex - source.rowIndex;
  const colOffset = target.colIndex - source.colIndex;
  const targets: TableCellCoords[] = [];

  if (Math.abs(rowOffset) >= Math.abs(colOffset)) {
    const start = Math.min(source.rowIndex, target.rowIndex);
    const end = Math.max(source.rowIndex, target.rowIndex);
    for (let rowIndex = start; rowIndex <= end; rowIndex += 1) {
      targets.push({ rowIndex, colIndex: source.colIndex });
    }
    return targets;
  }

  const start = Math.min(source.colIndex, target.colIndex);
  const end = Math.max(source.colIndex, target.colIndex);
  for (let colIndex = start; colIndex <= end; colIndex += 1) {
    targets.push({ rowIndex: source.rowIndex, colIndex });
  }
  return targets;
}

export function getFillCellValue(
  sourceText: string,
  sourceRow: number,
  sourceCol: number,
  targetRow: number,
  targetCol: number,
): string {
  const numericValue = parseNumericValue(sourceText);
  if (numericValue === null) {
    return sourceText;
  }

  const rowDelta = targetRow - sourceRow;
  const colDelta = targetCol - sourceCol;
  return formatFillNumber(
    numericValue + (Math.abs(rowDelta) >= Math.abs(colDelta) ? rowDelta : colDelta),
    sourceText,
  );
}

export function formatFillNumber(value: number, sourceText: string): string {
  const decimalMatch = String(sourceText)
    .trim()
    .replace(/[,\s楼$鈧?]/g, "")
    .match(/^-?\d+\.(\d+)$/);

  if (!decimalMatch) {
    return String(Math.round(value));
  }

  const precision = 10 ** decimalMatch[1].length;
  return String(Math.round(value * precision) / precision);
}
