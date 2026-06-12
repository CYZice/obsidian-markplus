import type { MarkPlusSettings } from "./types";

export const DEFAULT_SETTINGS: MarkPlusSettings = {
  minColumnWidth: 60,
  pixelsPerDash: 12,
  enableTaskSyntaxCompletion: true,
  enableTableFormulas: true,
  enableTableCellFill: true,
  tableStyleVariant: "default",
};

export const FORMULA_PATTERN =
  /^=\s*(sum|avg|average|count|max|min)\s*(?:\(\s*\))?$/i;

export const TABLE_SELECTOR =
  ".markdown-rendered table, .cm-preview-code-block table, .markdown-source-view.mod-cm6 .cm-table-widget table";

export const MARKPLUS_DEBUG = true;
export const HEADER_SIGNATURE_SEPARATOR = "\u0001";
