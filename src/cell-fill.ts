import type { TableCellCoords } from "./table-dom";

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
  options: { disableIncrementFill?: boolean } = {},
): string {
  if (options.disableIncrementFill) {
    return sourceText;
  }

  const delta =
    Math.abs(targetRow - sourceRow) >= Math.abs(targetCol - sourceCol)
      ? targetRow - sourceRow
      : targetCol - sourceCol;
  return incrementEmbeddedNumber(sourceText, delta);
}

export function incrementEmbeddedNumber(
  sourceText: string,
  delta: number,
): string {
  const token = findFirstNumericToken(sourceText);
  if (!token) {
    return sourceText;
  }

  const nextValue = formatFillNumber(token.value + delta, token.raw);
  return `${sourceText.slice(0, token.index)}${nextValue}${sourceText.slice(
    token.index + token.raw.length,
  )}`;
}

export function findFirstNumericToken(
  sourceText: string,
): { raw: string; value: number; index: number } | null {
  const match = String(sourceText ?? "").match(/-?\d+(?:\.\d+)?/);
  if (!match || typeof match.index !== "number") {
    return null;
  }

  const value = Number(match[0]);
  return Number.isFinite(value)
    ? { raw: match[0], value, index: match.index }
    : null;
}

export function formatFillNumber(value: number, sourceText: string): string {
  const normalizedSource = String(sourceText).trim();
  const decimalMatch = normalizedSource
    .replace(/[,\s\u00a5$\u20ac\u00a3%]/g, "")
    .match(/^-?\d+\.(\d+)$/);

  if (decimalMatch) {
    const decimalLength = decimalMatch[1].length;
    const precision = 10 ** decimalLength;
    const roundedValue = Math.round(value * precision) / precision;
    const integerWidth = getIntegerDigitWidth(normalizedSource);
    const [integerPart, decimalPart = ""] = Math.abs(roundedValue)
      .toFixed(decimalLength)
      .split(".");
    const paddedInteger =
      integerWidth > 1 ? integerPart.padStart(integerWidth, "0") : integerPart;
    return `${roundedValue < 0 ? "-" : ""}${paddedInteger}.${decimalPart}`;
  }

  const roundedValue = Math.round(value);
  const integerWidth = getIntegerDigitWidth(normalizedSource);
  const integerPart = String(Math.abs(roundedValue));
  const paddedInteger =
    integerWidth > 1 ? integerPart.padStart(integerWidth, "0") : integerPart;
  return `${roundedValue < 0 ? "-" : ""}${paddedInteger}`;
}

export function getIntegerDigitWidth(sourceText: string): number {
  const match = String(sourceText)
    .trim()
    .replace(/[,\s\u00a5$\u20ac\u00a3%]/g, "")
    .match(/^-?(\d+)(?:\.\d+)?$/);
  return match ? match[1].length : 0;
}
