export interface TableCellCoords {
  rowIndex: number;
  colIndex: number;
}

export function getTableHeaderRow(
  table: HTMLTableElement,
): HTMLTableRowElement | null {
  return (
    (table.querySelector("thead tr") as HTMLTableRowElement | null) ||
    table.rows[0] ||
    null
  );
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
  if (typeof document.elementsFromPoint !== "function") {
    return null;
  }

  for (const node of document.elementsFromPoint(clientX, clientY)) {
    if (node === table) {
      break;
    }

    if (
      node instanceof HTMLElement &&
      (node.classList.contains("markplus-cell-fill-handle") ||
        node.classList.contains("markplus-table-scale-handle") ||
        node.classList.contains("markplus-column-handle") ||
        node.classList.contains("markplus-table-menu-button"))
    ) {
      continue;
    }

    if (
      (node.tagName === "TD" || node.tagName === "TH") &&
      table.contains(node)
    ) {
      return node as HTMLTableCellElement;
    }
  }

  return null;
}
