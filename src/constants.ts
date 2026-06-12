import type { MarkPlusSettings, TableAlignment } from "./types";

export const DEFAULT_SETTINGS: MarkPlusSettings = {
  minColumnWidth: 60,
  pixelsPerDash: 12,
  enableTaskSyntaxCompletion: true,
  enableTableFormulas: true,
  enableTableCellFill: true,
  tableStyleVariant: "default",
  tableStripeRowBackgroundLight: "",
  tableStripeRowBackgroundDark: "",
  tableHeaderBackgroundLight: "",
  tableHeaderBackgroundDark: "",
};

export const FORMULA_PATTERN =
  /^=\s*(sum|avg|average|count|max|min)\s*(?:\(\s*\))?$/i;

export const TABLE_SELECTOR =
  ".markdown-preview-view table, .markdown-reading-view table, .markdown-rendered table, .cm-preview-code-block table, .markdown-source-view.mod-cm6 .cm-table-widget table";

export const PREVIEW_TABLE_SELECTOR =
  ".markdown-preview-view table, .markdown-reading-view table, .markdown-rendered table";

export const MARKPLUS_TABLE_STRIPE_ROW_BACKGROUND_VAR =
  "--markplus-table-stripe-row-background";
export const MARKPLUS_TABLE_HEADER_BACKGROUND_VAR =
  "--markplus-table-header-background";
export const MARKPLUS_TABLE_COLOR_STYLE_ID = "markplus-table-color-style";

export const TABLE_STYLE_OPTIONS = [
  { value: "default", label: "默认样式" },
  { value: "horizontal-lines", label: "横线样式" },
  { value: "striped-rows", label: "隔行背景色" },
  { value: "horizontal-lines-striped", label: "横线 + 隔行背景色" },
] as const;

export const TABLE_ALIGNMENT_OPTIONS: Array<{
  value: TableAlignment;
  label: string;
  icon: string;
}> = [
  { value: "left", label: "左对齐", icon: "align-left" },
  { value: "center", label: "居中对齐", icon: "align-center" },
  { value: "right", label: "右对齐", icon: "align-right" },
];

export const MARKPLUS_TABLE_ALIGNMENT_CLASSES = [
  "markplus-table-align-left",
  "markplus-table-align-center",
  "markplus-table-align-right",
];

export const MARKPLUS_COLUMN_ALIGNMENT_CLASSES = [
  "markplus-col-align-left",
  "markplus-col-align-center",
  "markplus-col-align-right",
];

export const MARKPLUS_DEBUG = true;
export const HEADER_SIGNATURE_SEPARATOR = "\u0001";
export const ROW_SIGNATURE_SEPARATOR = "\u0002";
export const CONTENT_SIGNATURE_SEPARATOR = "\u0003";
