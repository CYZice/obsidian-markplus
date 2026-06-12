import { FORMULA_PATTERN } from "./constants";
import { splitMarkdownRow } from "./markdown-table";
import type { MarkdownTableSpec } from "./types";

export function parseFormulaName(value: unknown): string | null {
  const match = String(value ?? "").trim().match(FORMULA_PATTERN);
  if (!match) {
    return null;
  }

  const name = match[1].toLowerCase();
  return name === "average" ? "avg" : name;
}

export function parseNumericValue(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  const normalized = String(value)
    .trim()
    .replace(/[,\s楼$鈧?*_`~]/g, "");

  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function computeFormulaResult(
  formula: string,
  values: number[],
): number | null {
  switch (formula) {
    case "sum":
      return values.reduce((total, item) => total + item, 0);
    case "avg":
      return values.length
        ? values.reduce((total, item) => total + item, 0) / values.length
        : null;
    case "count":
      return values.length;
    case "max":
      return values.length ? Math.max(...values) : null;
    case "min":
      return values.length ? Math.min(...values) : null;
    default:
      return null;
  }
}

export function formatFormulaResult(value: number | null): string {
  return value !== null && Number.isFinite(value)
    ? String(Math.round(value * 1e6) / 1e6)
    : "-";
}

export function isCellBeingEdited(cell: HTMLTableCellElement): boolean {
  const activeElement = document.activeElement;
  if (activeElement && activeElement !== document.body && cell.contains(activeElement)) {
    return true;
  }

  const selection =
    typeof window.getSelection === "function" ? window.getSelection() : null;
  if (selection && selection.rangeCount > 0) {
    const { anchorNode, focusNode } = selection;
    if ((anchorNode && cell.contains(anchorNode)) || (focusNode && cell.contains(focusNode))) {
      return true;
    }
  }

  return false;
}

export function applyTableFormulasToDom(
  table: HTMLTableElement,
  tableSpec: MarkdownTableSpec | null,
): void {
  const rows = Array.from(table.rows);
  if (rows.length < 2) {
    return;
  }

  const formulaRow = rows[rows.length - 1];
  const bodyRows = rows.slice(1, rows.length - 1);
  const cellCount = formulaRow.cells.length;

  let sourceFormulaCells: string[] | null = null;
  let sourceValueRows: string[][] | null = null;

  if (tableSpec?.bodyLines?.length) {
    const lastBodyLine = tableSpec.bodyLines[tableSpec.bodyLines.length - 1];
    const parsedCells = splitMarkdownRow(lastBodyLine).map((cell) => cell.trim());
    if (parsedCells.length === cellCount) {
      sourceFormulaCells = parsedCells;
      sourceValueRows = tableSpec.bodyLines
        .slice(0, -1)
        .map((line) => splitMarkdownRow(line).map((cell) => cell.trim()));
    }
  }

  Array.from(formulaRow.cells).forEach((cell, colIndex) => {
    if (isCellBeingEdited(cell)) {
      return;
    }

    const formulaName = sourceFormulaCells
      ? parseFormulaName(sourceFormulaCells[colIndex])
      : cell.dataset.markplusFormula || parseFormulaName(cell.textContent);

    if (!formulaName) {
      delete cell.dataset.markplusFormula;
      if (
        sourceFormulaCells &&
        cell.querySelector(":scope > .markplus-formula-result")
      ) {
        cell.textContent = sourceFormulaCells[colIndex] || "";
      }
      return;
    }

    cell.dataset.markplusFormula = formulaName;
    const values: number[] = [];

    if (sourceValueRows) {
      for (const row of sourceValueRows) {
        const numericValue = parseNumericValue(row[colIndex]);
        if (numericValue !== null) {
          values.push(numericValue);
        }
      }
    } else {
      for (const row of bodyRows) {
        const cellValue = row.cells[colIndex];
        if (!cellValue) {
          continue;
        }

        const numericValue = parseNumericValue(cellValue.textContent);
        if (numericValue !== null) {
          values.push(numericValue);
        }
      }
    }

    const result = formatFormulaResult(computeFormulaResult(formulaName, values));
    let resultEl = cell.querySelector(
      ":scope > .markplus-formula-result",
    ) as HTMLSpanElement | null;

    if (resultEl && resultEl.dataset.formula === formulaName && resultEl.textContent === result) {
      return;
    }

    if (!resultEl) {
      resultEl = document.createElement("span");
      resultEl.className = "markplus-formula-result";
      cell.replaceChildren(resultEl);
    }

    resultEl.dataset.formula = formulaName;
    resultEl.textContent = result;
    resultEl.title = `=${formulaName.toUpperCase()}`;
  });
}
