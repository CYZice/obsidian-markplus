var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MarkPlusPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/constants.ts
var DEFAULT_SETTINGS = {
  minColumnWidth: 60,
  pixelsPerDash: 12,
  enableTaskSyntaxCompletion: true,
  enableTableFormulas: true,
  enableTableCellFill: true,
  tableStyleVariant: "default",
  tableStripeRowBackgroundLight: "",
  tableStripeRowBackgroundDark: "",
  tableHeaderBackgroundLight: "",
  tableHeaderBackgroundDark: ""
};
var FORMULA_PATTERN = /^=\s*(sum|avg|average|count|max|min)\s*(?:\(\s*\))?$/i;
var TABLE_SELECTOR = ".markdown-preview-view table, .markdown-reading-view table, .markdown-rendered table, .cm-preview-code-block table, .markdown-source-view.mod-cm6 .cm-table-widget table";
var PREVIEW_TABLE_SELECTOR = ".markdown-preview-view table, .markdown-reading-view table, .markdown-rendered table";
var MARKPLUS_TABLE_STRIPE_ROW_BACKGROUND_VAR = "--markplus-table-stripe-row-background";
var MARKPLUS_TABLE_HEADER_BACKGROUND_VAR = "--markplus-table-header-background";
var MARKPLUS_TABLE_COLOR_STYLE_ID = "markplus-table-color-style";
var TABLE_STYLE_OPTIONS = [
  { value: "default", label: "\u9ED8\u8BA4\u6837\u5F0F" },
  { value: "horizontal-lines", label: "\u6A2A\u7EBF\u6837\u5F0F" },
  { value: "striped-rows", label: "\u9694\u884C\u80CC\u666F\u8272" },
  { value: "horizontal-lines-striped", label: "\u6A2A\u7EBF + \u9694\u884C\u80CC\u666F\u8272" }
];
var TABLE_ALIGNMENT_OPTIONS = [
  { value: "left", label: "\u5DE6\u5BF9\u9F50", icon: "align-left" },
  { value: "center", label: "\u5C45\u4E2D\u5BF9\u9F50", icon: "align-center" },
  { value: "right", label: "\u53F3\u5BF9\u9F50", icon: "align-right" }
];
var MARKPLUS_TABLE_ALIGNMENT_CLASSES = [
  "markplus-table-align-left",
  "markplus-table-align-center",
  "markplus-table-align-right"
];
var MARKPLUS_COLUMN_ALIGNMENT_CLASSES = [
  "markplus-col-align-left",
  "markplus-col-align-center",
  "markplus-col-align-right"
];
var MARKPLUS_DEBUG = true;
var HEADER_SIGNATURE_SEPARATOR = "";
var ROW_SIGNATURE_SEPARATOR = "";
var CONTENT_SIGNATURE_SEPARATOR = "";

// src/debug.ts
var markplusLogSeq = 0;
function mpLog(_event, _payload) {
  if (MARKPLUS_DEBUG) {
    markplusLogSeq += 1;
  }
}
function summarizeMutations(records) {
  let ownDecorationMutations = 0;
  let otherMutations = 0;
  const samples = [];
  for (const record of records) {
    const nodes = [
      ...Array.from(record.addedNodes),
      ...Array.from(record.removedNodes)
    ];
    const isOwnMutation = nodes.some(
      (node) => {
        var _a, _b, _c, _d, _e, _f;
        return node.nodeType === 1 && (((_a = node.classList) == null ? void 0 : _a.contains("markplus-colgroup")) || ((_b = node.classList) == null ? void 0 : _b.contains("markplus-column-handle")) || ((_c = node.classList) == null ? void 0 : _c.contains("markplus-table-scale-handle")) || ((_d = node.classList) == null ? void 0 : _d.contains("markplus-table-menu-button")) || ((_e = node.classList) == null ? void 0 : _e.contains("markplus-cell-fill-handle")) || ((_f = node.classList) == null ? void 0 : _f.contains("markplus-formula-result")) || node.tagName === "COL");
      }
    );
    if (isOwnMutation) {
      ownDecorationMutations += 1;
      continue;
    }
    otherMutations += 1;
    if (samples.length >= 3) {
      continue;
    }
    const target = record.target;
    samples.push({
      type: record.type,
      target: (target == null ? void 0 : target.nodeType) === 1 ? `${target.tagName}.${target.className || ""}`.trim() : target == null ? void 0 : target.nodeName,
      added: record.addedNodes.length,
      removed: record.removedNodes.length
    });
  }
  return {
    total: records.length,
    ownDecorationMutations,
    otherMutations,
    samples
  };
}

// src/settings.ts
var import_obsidian = require("obsidian");
var MarkPlusSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2").createEl("a", {
      text: "\u4F5C\u8005\uFF1ACYZice",
      href: "https://github.com/CYZice/obsidian-markplus"
    }).setAttr("target", "_blank");
    containerEl.createEl("h2", { text: "MarkPlus \u8BBE\u7F6E" });
    new import_obsidian.Setting(containerEl).setName("\u4EFB\u52A1\u8BED\u6CD5\u81EA\u52A8\u8865\u5168").setDesc("\u8F93\u5165 `- [` \u6216 `-` \u540E\u7EE7\u7EED\u8F93\u5165\u65F6\uFF0C\u81EA\u52A8\u8865\u5168\u4EFB\u52A1\u5217\u8868\u8BED\u6CD5\u3002").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.enableTaskSyntaxCompletion).onChange(async (value) => {
        this.plugin.settings.enableTaskSyntaxCompletion = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("\u8868\u683C\u516C\u5F0F").setDesc(
      "\u5728\u8868\u683C\u6700\u540E\u4E00\u884C\u5355\u5143\u683C\u8F93\u5165 `=sum`\u3001`=avg`\u3001`=count`\u3001`=max`\u3001`=min` \u65F6\u81EA\u52A8\u8BA1\u7B97\u8BE5\u5217\u6570\u636E\u3002"
    ).addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.enableTableFormulas).onChange(async (value) => {
        var _a;
        this.plugin.settings.enableTableFormulas = value;
        await this.plugin.saveSettings();
        (_a = this.plugin.tableEnhancer) == null ? void 0 : _a.scheduleRefresh("table-formula-toggle");
      });
    });
    new import_obsidian.Setting(containerEl).setName("\u5355\u5143\u683C\u586B\u5145").setDesc(
      "\u9009\u4E2D\u8868\u683C\u5355\u5143\u683C\u540E\uFF0C\u53EF\u62D6\u52A8\u53F3\u4E0B\u89D2\u586B\u5145\u624B\u67C4\u590D\u5236\u5185\u5BB9\uFF1B\u5E26\u6570\u5B57\u7684\u5185\u5BB9\u4F1A\u6309\u65B9\u5411\u9012\u589E\u3002"
    ).addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.enableTableCellFill).onChange(async (value) => {
        var _a, _b;
        this.plugin.settings.enableTableCellFill = value;
        await this.plugin.saveSettings();
        (_a = this.plugin.tableEnhancer) == null ? void 0 : _a.clearActiveFillCell();
        (_b = this.plugin.tableEnhancer) == null ? void 0 : _b.scheduleRefresh("table-cell-fill-toggle");
      });
    });
    new import_obsidian.Setting(containerEl).setName("\u8868\u683C\u6837\u5F0F").setDesc("\u4E3A Markdown \u8868\u683C\u9009\u62E9\u4E00\u79CD\u589E\u5F3A\u6837\u5F0F\u3002").addDropdown((dropdown) => {
      TABLE_STYLE_OPTIONS.forEach((option) => {
        dropdown.addOption(option.value, option.label);
      });
      dropdown.setValue(this.plugin.settings.tableStyleVariant || DEFAULT_SETTINGS.tableStyleVariant).onChange(async (value) => {
        var _a;
        this.plugin.settings.tableStyleVariant = value;
        await this.plugin.saveSettings();
        (_a = this.plugin.tableEnhancer) == null ? void 0 : _a.scheduleRefresh("table-style-change");
      });
    });
    new import_obsidian.Setting(containerEl).setName("\u9694\u884C\u80CC\u666F\u8272").setHeading();
    this.addTableColorSetting(containerEl, {
      name: "\u6D45\u8272\u6A21\u5F0F",
      desc: "\u6D45\u8272\u4E3B\u9898\u4E0B\u7684\u9694\u884C\u80CC\u666F\u8272\u3002",
      settingKey: "tableStripeRowBackgroundLight",
      theme: "light"
    });
    this.addTableColorSetting(containerEl, {
      name: "\u6DF1\u8272\u6A21\u5F0F",
      desc: "\u6DF1\u8272\u4E3B\u9898\u4E0B\u7684\u9694\u884C\u80CC\u666F\u8272\u3002",
      settingKey: "tableStripeRowBackgroundDark",
      theme: "dark"
    });
    new import_obsidian.Setting(containerEl).setName("\u8868\u5934\u80CC\u666F\u8272").setHeading();
    this.addTableColorSetting(containerEl, {
      name: "\u6D45\u8272\u6A21\u5F0F",
      desc: "\u6D45\u8272\u4E3B\u9898\u4E0B\u7684\u8868\u5934\u80CC\u666F\u8272\u3002",
      settingKey: "tableHeaderBackgroundLight",
      theme: "light"
    });
    this.addTableColorSetting(containerEl, {
      name: "\u6DF1\u8272\u6A21\u5F0F",
      desc: "\u6DF1\u8272\u4E3B\u9898\u4E0B\u7684\u8868\u5934\u80CC\u666F\u8272\u3002",
      settingKey: "tableHeaderBackgroundDark",
      theme: "dark"
    });
  }
  addTableColorSetting(containerEl, options) {
    const parsed = parseStoredTableColor(this.plugin.settings[options.settingKey]);
    const defaultColor = resolveDefaultTableColorHex(options.theme);
    let colorPicker = null;
    let slider = null;
    new import_obsidian.Setting(containerEl).setName(options.name).setDesc(options.desc).addColorPicker((component) => {
      colorPicker = component;
      component.setValue((parsed == null ? void 0 : parsed.hex) || defaultColor);
      component.onChange(async () => {
        await this.persistTableColorSetting(options.settingKey, colorPicker, slider);
      });
    }).addSlider((component) => {
      var _a;
      slider = component;
      component.setLimits(0, 100, 1);
      component.setDynamicTooltip();
      component.setValue(Math.round(((_a = parsed == null ? void 0 : parsed.alpha) != null ? _a : 1) * 100));
      component.onChange(async () => {
        await this.persistTableColorSetting(options.settingKey, colorPicker, slider);
      });
    }).addExtraButton((button) => {
      button.setIcon("rotate-ccw").setTooltip("\u6062\u590D\u9ED8\u8BA4").onClick(async () => {
        var _a;
        this.plugin.settings[options.settingKey] = "";
        await this.plugin.saveSettings();
        this.plugin.applyTableStyleVariables();
        colorPicker == null ? void 0 : colorPicker.setValue(defaultColor);
        slider == null ? void 0 : slider.setValue(100);
        (_a = this.plugin.tableEnhancer) == null ? void 0 : _a.scheduleRefresh("table-color-reset");
      });
    });
  }
  async persistTableColorSetting(settingKey, colorPicker, slider) {
    var _a, _b;
    if (!colorPicker) {
      return;
    }
    this.plugin.settings[settingKey] = formatTableColorValue(
      colorPicker.getValue(),
      ((_a = slider == null ? void 0 : slider.getValue()) != null ? _a : 100) / 100
    );
    await this.plugin.saveSettings();
    this.plugin.applyTableStyleVariables();
    (_b = this.plugin.tableEnhancer) == null ? void 0 : _b.scheduleRefresh("table-color-change");
  }
};
function parseStoredTableColor(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }
  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,/]\s*([01]?(?:\.\d+)?))?\s*\)$/i
  );
  if (rgbaMatch) {
    const [, r, g, b, alphaRaw] = rgbaMatch;
    return {
      hex: rgbToHex(Number(r), Number(g), Number(b)),
      alpha: alphaRaw === void 0 ? 1 : clampAlpha(Number(alphaRaw))
    };
  }
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    return { hex: normalizeHex(trimmed), alpha: 1 };
  }
  return null;
}
function resolveDefaultTableColorHex(_theme) {
  return "#dfe4ea";
}
function formatTableColorValue(hex, alpha) {
  const normalizedHex = normalizeHex(hex);
  const { r, g, b } = hexToRgb(normalizedHex);
  const normalizedAlpha = clampAlpha(alpha);
  return normalizedAlpha >= 0.999 ? normalizedHex : `rgba(${r}, ${g}, ${b}, ${normalizedAlpha.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")})`;
}
function normalizeHex(hex) {
  const trimmed = String(hex || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }
  return "#dfe4ea";
}
function hexToRgb(hex) {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}
function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, "0")).join("")}`;
}
function clampAlpha(alpha) {
  return Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1));
}

// src/table-controller.ts
var import_obsidian2 = require("obsidian");

// src/markdown-table.ts
function extractMarkdownTableSpecs(markdown) {
  const lines = markdown.split(/\r?\n/);
  const specs = [];
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
    const bodyLines = [];
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
      rawSeparatorLine: lines[lineIndex]
    });
    lineIndex = bodyIndex - 1;
  }
  return specs;
}
function findSeparatorLineForSpec(markdown, tableSpec) {
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
  return Number.isInteger(separatorLineIndex) && separatorLineIndex >= 0 && separatorLineIndex < lines.length && parseSeparatorLine(lines[separatorLineIndex]) ? separatorLineIndex : null;
}
function parseSeparatorLine(line) {
  const cells = splitMarkdownRow(line);
  if (!cells.length) {
    return null;
  }
  const columns = [];
  for (const cell of cells) {
    const match = cell.trim().match(/^(:)?(-{3,})(:)?$/);
    if (!match) {
      return null;
    }
    columns.push({
      alignLeft: Boolean(match[1]),
      alignRight: Boolean(match[3]),
      dashCount: match[2].length
    });
  }
  return { columns };
}
function getMarkdownLineIndexForTableRow(tableSpec, rowIndex) {
  return rowIndex === 0 ? tableSpec.headerLineIndex : tableSpec.separatorLineIndex + rowIndex;
}
function getCellSourceText(tableSpec, rowIndex, colIndex) {
  var _a, _b;
  if (!tableSpec) {
    return null;
  }
  if (rowIndex === 0) {
    return ((_a = tableSpec.headerCells[colIndex]) != null ? _a : "").trim();
  }
  const bodyIndex = rowIndex - 1;
  if (bodyIndex < 0 || bodyIndex >= tableSpec.bodyLines.length) {
    return null;
  }
  return ((_b = splitMarkdownRow(tableSpec.bodyLines[bodyIndex])[colIndex]) != null ? _b : "").trim();
}
function buildMarkdownTableRow(cells) {
  return `| ${cells.map((cell) => String(cell).trim()).join(" | ")} |`;
}
function replaceCellInMarkdownRow(line, colIndex, nextValue) {
  const cells = splitMarkdownRow(line);
  if (colIndex < 0 || colIndex >= cells.length) {
    return line;
  }
  cells[colIndex] = nextValue;
  return buildMarkdownTableRow(cells);
}
function splitMarkdownRow(line) {
  if (!line.includes("|")) {
    return [];
  }
  let normalized = line.trim();
  normalized = normalized.startsWith("|") ? normalized.slice(1) : normalized;
  normalized = normalized.endsWith("|") ? normalized.slice(0, -1) : normalized;
  return normalized.split("|");
}
function buildSeparatorLine(tableSpec, dashCounts) {
  return `| ${dashCounts.map((dashCount, index) => {
    const column = tableSpec.columns[index] || {
      alignLeft: false,
      alignRight: false
    };
    const dashes = "-".repeat(Math.max(3, dashCount));
    return `${column.alignLeft ? ":" : ""}${dashes}${column.alignRight ? ":" : ""}`;
  }).join(" | ")} |`;
}
function buildSeparatorLineFromColumns(columns) {
  return `| ${columns.map((column) => {
    const current = column || { alignLeft: false, alignRight: false, dashCount: 3 };
    const dashes = "-".repeat(Math.max(3, current.dashCount || 3));
    return `${current.alignLeft ? ":" : ""}${dashes}${current.alignRight ? ":" : ""}`;
  }).join(" | ")} |`;
}
function reorderColumnsByHeader(previousSpec, currentSpec) {
  const prevHeaders = previousSpec.headerCells || [];
  const currHeaders = currentSpec.headerCells || [];
  if (!prevHeaders.length || prevHeaders.length !== currHeaders.length) {
    return null;
  }
  if (previousSpec.columns.length !== prevHeaders.length || currentSpec.columns.length !== currHeaders.length) {
    return null;
  }
  const headerMap = /* @__PURE__ */ new Map();
  prevHeaders.forEach((header, index) => {
    const normalized = normalizeHeaderCell(header);
    const indices = headerMap.get(normalized) || [];
    indices.push(index);
    headerMap.set(normalized, indices);
  });
  const reorderedIndexes = [];
  for (const header of currHeaders) {
    const normalized = normalizeHeaderCell(header);
    const indices = headerMap.get(normalized);
    if (!indices || !indices.length) {
      return null;
    }
    reorderedIndexes.push(indices.shift());
  }
  if (reorderedIndexes.every((index, currentIndex) => index === currentIndex)) {
    return null;
  }
  const reorderedColumns = reorderedIndexes.map(
    (index) => previousSpec.columns[index]
  );
  return reorderedColumns.some((column) => !column) ? null : reorderedColumns;
}
function transferColumnsToCurrentLayout(previousSpec, currentSpec) {
  const prevHeaders = previousSpec.headerCells || [];
  const currHeaders = currentSpec.headerCells || [];
  const currentColumns = currentSpec.columns || [];
  if (!prevHeaders.length || !currHeaders.length) {
    return null;
  }
  const headerMap = /* @__PURE__ */ new Map();
  prevHeaders.forEach((header, index) => {
    const normalized = normalizeHeaderCell(header);
    const indices = headerMap.get(normalized) || [];
    indices.push(index);
    headerMap.set(normalized, indices);
  });
  const usedIndexes = /* @__PURE__ */ new Set();
  const mappedIndexes = Array.from(
    { length: currHeaders.length },
    () => null
  );
  currHeaders.forEach((header, index) => {
    const normalized = normalizeHeaderCell(header);
    const indices = headerMap.get(normalized);
    if (indices && indices.length) {
      const previousIndex = indices.shift();
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
    matchedCount: mappedIndexes.filter((index) => index !== null).length
  };
}
function normalizeMatchText(value) {
  return String(value || "").replace(/\[\[([^\]]*)\]\]/g, "$1").replace(/[*_`~]/g, "").replace(/\s+/g, " ").trim();
}
function domTableHeaderSignature(table) {
  const headerRow = table.rows && table.rows[0];
  return headerRow && headerRow.cells.length ? Array.from(headerRow.cells).map((cell) => normalizeMatchText(cell.textContent)).join(HEADER_SIGNATURE_SEPARATOR) : null;
}
function specHeaderSignature(tableSpec) {
  return tableSpec && Array.isArray(tableSpec.headerCells) && tableSpec.headerCells.length ? tableSpec.headerCells.map((cell) => normalizeMatchText(cell)).join(HEADER_SIGNATURE_SEPARATOR) : null;
}
function domTableBodySignature(table) {
  return !(table instanceof HTMLTableElement) || table.rows.length < 2 ? null : Array.from(table.rows).slice(1).map(
    (row) => Array.from(row.cells).map((cell) => normalizeMatchText(cell.textContent)).join(HEADER_SIGNATURE_SEPARATOR)
  ).join(ROW_SIGNATURE_SEPARATOR);
}
function specBodySignature(tableSpec) {
  return tableSpec && Array.isArray(tableSpec.bodyLines) && tableSpec.bodyLines.length ? tableSpec.bodyLines.map(
    (line) => splitMarkdownRow(line).map((cell) => normalizeMatchText(cell)).join(HEADER_SIGNATURE_SEPARATOR)
  ).join(ROW_SIGNATURE_SEPARATOR) : null;
}
function domTableContentSignature(table) {
  var _a;
  if (!(table instanceof HTMLTableElement) || !((_a = table.rows) == null ? void 0 : _a.length)) {
    return null;
  }
  const rows = Array.from(table.rows).map(
    (row) => Array.from(row.cells).map((cell) => normalizeMatchText(cell.textContent))
  );
  if (!rows.length || !rows[0].length) {
    return null;
  }
  const headerSignature = rows[0].join(HEADER_SIGNATURE_SEPARATOR);
  const previewBody = rows.slice(1, 3).map((row) => row.join(HEADER_SIGNATURE_SEPARATOR)).join(ROW_SIGNATURE_SEPARATOR);
  return [rows.length, rows[0].length, headerSignature, previewBody].join(
    CONTENT_SIGNATURE_SEPARATOR
  );
}
function specContentSignature(tableSpec) {
  var _a;
  if (!((_a = tableSpec == null ? void 0 : tableSpec.headerCells) == null ? void 0 : _a.length)) {
    return null;
  }
  const previewBody = Array.isArray(tableSpec.bodyLines) ? tableSpec.bodyLines.slice(0, 2).map(
    (line) => splitMarkdownRow(line).map((cell) => normalizeMatchText(cell))
  ) : [];
  return [
    1 + (Array.isArray(tableSpec.bodyLines) ? tableSpec.bodyLines.length : 0),
    tableSpec.headerCells.length,
    tableSpec.headerCells.map((cell) => normalizeMatchText(cell)).join(HEADER_SIGNATURE_SEPARATOR),
    previewBody.map((row) => row.join(HEADER_SIGNATURE_SEPARATOR)).join(ROW_SIGNATURE_SEPARATOR)
  ].join(CONTENT_SIGNATURE_SEPARATOR);
}
function matchSpecIndexesByBodySignature(bodySignature, specs, usedIndexes, indexes = null) {
  if (!bodySignature) {
    return [];
  }
  return (Array.isArray(indexes) ? indexes : specs.map((_, index) => index)).filter(
    (index) => !usedIndexes.has(index) && specBodySignature(specs[index]) === bodySignature
  );
}
function getTableMatchIndex(table, fallbackIndex = null) {
  var _a, _b;
  const datasetIndex = Number.parseInt((_b = (_a = table == null ? void 0 : table.dataset) == null ? void 0 : _a.markplusTableOrdinal) != null ? _b : "", 10);
  return Number.isInteger(datasetIndex) && datasetIndex >= 0 ? datasetIndex : Number.isInteger(fallbackIndex) && fallbackIndex >= 0 ? fallbackIndex : null;
}
function getTableSourceLineForDomTable(view, table) {
  const editor = view == null ? void 0 : view.editor;
  if (!editor || typeof editor.posAtDOM !== "function" || !(table instanceof HTMLTableElement)) {
    return null;
  }
  const candidates = [
    table.closest(".cm-table-widget"),
    table.querySelector("thead th"),
    table.querySelector("tr th"),
    table.querySelector("tr td"),
    table
  ].filter(Boolean);
  for (const candidate of candidates) {
    for (const side of [-1, 0, 1]) {
      try {
        const position = editor.posAtDOM(candidate, side);
        if (position && Number.isInteger(position.line) && position.line >= 0) {
          return position.line;
        }
      } catch (_error) {
      }
    }
  }
  return null;
}
function matchSpecForSection(currentSpec, specs) {
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
function buildMarkdownTableFromSpec(tableSpec) {
  return (tableSpec == null ? void 0 : tableSpec.rawHeaderLine) && (tableSpec == null ? void 0 : tableSpec.rawSeparatorLine) ? [tableSpec.rawHeaderLine, tableSpec.rawSeparatorLine, ...tableSpec.bodyLines || []].join(
    "\n"
  ) : "";
}
function buildMarkdownTableFromElement(table) {
  const rows = table instanceof HTMLTableElement ? Array.from(table.rows) : [];
  if (!rows.length) {
    return "";
  }
  const markdownRows = rows.map(
    (row) => `| ${Array.from(row.cells).map((cell) => {
      var _a;
      return ((_a = cell.textContent) != null ? _a : "").trim().replace(/\|/g, "\\|");
    }).join(" | ")} |`
  );
  if (markdownRows.length === 1) {
    markdownRows.push(`| ${Array.from(rows[0].cells, () => "---").join(" | ")} |`);
  }
  return markdownRows.join("\n");
}
function getTableMarkdownForCopy(view, tableSpec, table) {
  var _a, _b;
  const editor = view == null ? void 0 : view.editor;
  if (editor && tableSpec) {
    const start = tableSpec.headerLineIndex;
    const end = tableSpec.separatorLineIndex + ((_b = (_a = tableSpec.bodyLines) == null ? void 0 : _a.length) != null ? _b : 0);
    if (Number.isInteger(start) && start >= 0 && start <= end && (!editor.lineCount || end < editor.lineCount())) {
      const lines = [];
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
function alignmentToColumnFlags(alignment) {
  return {
    alignLeft: alignment !== "right",
    alignRight: alignment !== "left"
  };
}
function getColumnAlignmentKind(column) {
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
function getTableAlignmentFromColumns(columns) {
  if (!Array.isArray(columns) || !columns.length) {
    return null;
  }
  const first = getColumnAlignmentKind(columns[0]);
  if (!first) {
    return null;
  }
  return columns.every((column) => getColumnAlignmentKind(column) === first) ? first : null;
}
function applyAlignmentToColumns(columns, alignment) {
  const flags = alignmentToColumnFlags(alignment);
  return columns.map((column) => ({
    ...column,
    alignLeft: flags.alignLeft,
    alignRight: flags.alignRight
  }));
}
function isMarkdownTableRow(line) {
  return splitMarkdownRow(line).length > 0;
}
function areStringArraysEqual(a, b) {
  return a === b || !(!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) && a.every((value, index) => value === b[index]);
}
function getLineAt(markdown, lineIndex) {
  return (typeof markdown === "string" && lineIndex >= 0 ? markdown.split(/\r?\n/)[lineIndex] : "") || "";
}
function isLikelyTaskSyntaxInsertion(previousLine, currentLine) {
  return typeof previousLine === "string" && typeof currentLine === "string" && currentLine.length === previousLine.length + 1 && /^\s*-\s$/.test(previousLine) && /^\s*-\s(?:\[)?$/.test(currentLine);
}
function normalizeHeaderCell(value) {
  return String(value || "").trim();
}

// src/formulas.ts
function parseFormulaName(value) {
  const match = String(value != null ? value : "").trim().match(FORMULA_PATTERN);
  if (!match) {
    return null;
  }
  const name = match[1].toLowerCase();
  return name === "average" ? "avg" : name;
}
function parseNumericValue(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim().replace(/[,\s楼$鈧?*_`~]/g, "");
  if (!normalized) {
    return null;
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}
function computeFormulaResult(formula, values) {
  switch (formula) {
    case "sum":
      return values.reduce((total, item) => total + item, 0);
    case "avg":
      return values.length ? values.reduce((total, item) => total + item, 0) / values.length : null;
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
function formatFormulaResult(value) {
  return value !== null && Number.isFinite(value) ? String(Math.round(value * 1e6) / 1e6) : "-";
}
function isCellBeingEdited(cell) {
  const activeElement = document.activeElement;
  if (activeElement && activeElement !== document.body && cell.contains(activeElement)) {
    return true;
  }
  const selection = typeof window.getSelection === "function" ? window.getSelection() : null;
  if (selection && selection.rangeCount > 0) {
    const { anchorNode, focusNode } = selection;
    if (anchorNode && cell.contains(anchorNode) || focusNode && cell.contains(focusNode)) {
      return true;
    }
  }
  return false;
}
function applyTableFormulasToDom(table, tableSpec) {
  var _a;
  const rows = Array.from(table.rows);
  if (rows.length < 2) {
    return;
  }
  const formulaRow = rows[rows.length - 1];
  const bodyRows = rows.slice(1, rows.length - 1);
  const cellCount = formulaRow.cells.length;
  let sourceFormulaCells = null;
  let sourceValueRows = null;
  if ((_a = tableSpec == null ? void 0 : tableSpec.bodyLines) == null ? void 0 : _a.length) {
    const lastBodyLine = tableSpec.bodyLines[tableSpec.bodyLines.length - 1];
    const parsedCells = splitMarkdownRow(lastBodyLine).map((cell) => cell.trim());
    if (parsedCells.length === cellCount) {
      sourceFormulaCells = parsedCells;
      sourceValueRows = tableSpec.bodyLines.slice(0, -1).map((line) => splitMarkdownRow(line).map((cell) => cell.trim()));
    }
  }
  Array.from(formulaRow.cells).forEach((cell, colIndex) => {
    if (isCellBeingEdited(cell)) {
      return;
    }
    const formulaName = sourceFormulaCells ? parseFormulaName(sourceFormulaCells[colIndex]) : cell.dataset.markplusFormula || parseFormulaName(cell.textContent);
    if (!formulaName) {
      delete cell.dataset.markplusFormula;
      if (sourceFormulaCells && cell.querySelector(":scope > .markplus-formula-result")) {
        cell.textContent = sourceFormulaCells[colIndex] || "";
      }
      return;
    }
    cell.dataset.markplusFormula = formulaName;
    const values = [];
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
      ":scope > .markplus-formula-result"
    );
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

// src/cell-fill.ts
function computeFillTargets(source, target) {
  const rowOffset = target.rowIndex - source.rowIndex;
  const colOffset = target.colIndex - source.colIndex;
  const targets = [];
  if (Math.abs(rowOffset) >= Math.abs(colOffset)) {
    const start2 = Math.min(source.rowIndex, target.rowIndex);
    const end2 = Math.max(source.rowIndex, target.rowIndex);
    for (let rowIndex = start2; rowIndex <= end2; rowIndex += 1) {
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
function getFillCellValue(sourceText, sourceRow, sourceCol, targetRow, targetCol, options = {}) {
  if (options.disableIncrementFill) {
    return sourceText;
  }
  const delta = Math.abs(targetRow - sourceRow) >= Math.abs(targetCol - sourceCol) ? targetRow - sourceRow : targetCol - sourceCol;
  return incrementEmbeddedNumber(sourceText, delta);
}
function incrementEmbeddedNumber(sourceText, delta) {
  const token = findFirstNumericToken(sourceText);
  if (!token) {
    return sourceText;
  }
  const nextValue = formatFillNumber(token.value + delta, token.raw);
  return `${sourceText.slice(0, token.index)}${nextValue}${sourceText.slice(
    token.index + token.raw.length
  )}`;
}
function findFirstNumericToken(sourceText) {
  const match = String(sourceText != null ? sourceText : "").match(/-?\d+(?:\.\d+)?/);
  if (!match || typeof match.index !== "number") {
    return null;
  }
  const value = Number(match[0]);
  return Number.isFinite(value) ? { raw: match[0], value, index: match.index } : null;
}
function formatFillNumber(value, sourceText) {
  const normalizedSource = String(sourceText).trim();
  const decimalMatch = normalizedSource.replace(/[,\s\u00a5$\u20ac\u00a3%]/g, "").match(/^-?\d+\.(\d+)$/);
  if (decimalMatch) {
    const decimalLength = decimalMatch[1].length;
    const precision = 10 ** decimalLength;
    const roundedValue2 = Math.round(value * precision) / precision;
    const integerWidth2 = getIntegerDigitWidth(normalizedSource);
    const [integerPart2, decimalPart = ""] = Math.abs(roundedValue2).toFixed(decimalLength).split(".");
    const paddedInteger2 = integerWidth2 > 1 ? integerPart2.padStart(integerWidth2, "0") : integerPart2;
    return `${roundedValue2 < 0 ? "-" : ""}${paddedInteger2}.${decimalPart}`;
  }
  const roundedValue = Math.round(value);
  const integerWidth = getIntegerDigitWidth(normalizedSource);
  const integerPart = String(Math.abs(roundedValue));
  const paddedInteger = integerWidth > 1 ? integerPart.padStart(integerWidth, "0") : integerPart;
  return `${roundedValue < 0 ? "-" : ""}${paddedInteger}`;
}
function getIntegerDigitWidth(sourceText) {
  const match = String(sourceText).trim().replace(/[,\s\u00a5$\u20ac\u00a3%]/g, "").match(/^-?(\d+)(?:\.\d+)?$/);
  return match ? match[1].length : 0;
}

// src/table-dom.ts
function getTableHeaderRow(table) {
  return table.querySelector("thead tr") || table.rows[0] || null;
}
function getCellCoords(table, cell) {
  const row = cell.parentElement;
  return {
    rowIndex: Array.from(table.rows).indexOf(row),
    colIndex: Array.from(row.cells).indexOf(cell)
  };
}
function getTableCellFromPoint(table, clientX, clientY) {
  if (typeof document.elementsFromPoint !== "function") {
    return null;
  }
  for (const node of document.elementsFromPoint(clientX, clientY)) {
    if (node === table) {
      break;
    }
    if (node instanceof HTMLElement && (node.classList.contains("markplus-cell-fill-handle") || node.classList.contains("markplus-table-scale-handle") || node.classList.contains("markplus-column-handle") || node.classList.contains("markplus-table-menu-button"))) {
      continue;
    }
    if ((node.tagName === "TD" || node.tagName === "TH") && table.contains(node)) {
      return node;
    }
  }
  return null;
}

// src/table-controller.ts
var TableColumnResizeController = class {
  constructor(plugin) {
    this.handleMap = /* @__PURE__ */ new WeakMap();
    this.scaleHandleMap = /* @__PURE__ */ new WeakMap();
    this.menuButtonMap = /* @__PURE__ */ new WeakMap();
    this.cellFillHandleMap = /* @__PURE__ */ new WeakMap();
    this.observerMap = /* @__PURE__ */ new WeakMap();
    this.fileTableSnapshots = /* @__PURE__ */ new Map();
    this.fileMarkdownSnapshots = /* @__PURE__ */ new Map();
    this.internalChangeBudget = /* @__PURE__ */ new Map();
    this.isComposing = false;
    this.dragState = null;
    this.fillState = null;
    this.fillDragState = null;
    this.pendingRefreshReason = null;
    this.refreshTimer = null;
    this.plugin = plugin;
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
    this.boundPointerCancel = this.onPointerCancel.bind(this);
    this.boundFillPointerMove = this.onFillPointerMove.bind(this);
    this.boundFillPointerUp = this.onFillPointerUp.bind(this);
    this.boundFillPointerCancel = this.onFillPointerCancel.bind(this);
    this.boundDocumentPointerDown = this.onDocumentPointerDown.bind(this);
    this.plugin.registerDomEvent(
      document,
      "pointerdown",
      this.boundDocumentPointerDown,
      {
        capture: true
      }
    );
  }
  destroy() {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }
    this.disconnectObservers();
    this.stopDragging();
    this.stopFillDragging();
    this.clearActiveFillCell();
  }
  scheduleRefresh(reason) {
    if (this.fillDragState) {
      this.pendingRefreshReason = reason || "(unknown)";
      return;
    }
    mpLog("scheduleRefresh", reason || "(unknown)");
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = window.setTimeout(() => {
      this.refreshAllTables().catch((error) => {
        console.error("MarkPlus refresh failed", error);
      });
    }, 80);
  }
  reapplyWidthsActiveView() {
    const view = this.plugin.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
    if (view == null ? void 0 : view.contentEl) {
      this.reapplyWidthsFromCache(view.contentEl);
    }
  }
  restoreSeparatorsAfterComposition() {
    const view = this.plugin.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
    if ((view == null ? void 0 : view.editor) && view.file) {
      this.handleEditorChange(view.editor, { file: view.file }).catch(
        (error) => {
          console.error("MarkPlus composition restore failed", error);
        }
      );
    }
  }
  async refreshAllTables() {
    if (this.isComposing || this.fillDragState) {
      return;
    }
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof import_obsidian2.MarkdownView)) {
        continue;
      }
      const file = view.file;
      if (!file || !view.contentEl) {
        continue;
      }
      this.ensureObserver(view.contentEl);
      if (typeof view.getMode === "function" && view.getMode() === "preview") {
        continue;
      }
      const markdown = await this.getMarkdownSource(view);
      const specs = extractMarkdownTableSpecs(markdown);
      this.fileTableSnapshots.set(file.path, specs);
      this.fileMarkdownSnapshots.set(file.path, markdown);
      const tables = this.queryTablesForView(view);
      const usedIndexes = /* @__PURE__ */ new Set();
      const canUseFallbackIndex = tables.length === specs.length;
      tables.forEach((table, index) => {
        const tableSpec = this.matchSpecForTable(
          table,
          specs,
          usedIndexes,
          canUseFallbackIndex ? index : null,
          view
        );
        this.decorateTable(table, tableSpec, view, index);
      });
      this.applyReadingPresentationForPreview(view.previewMode, "refresh");
    }
  }
  queryTablesForView(view) {
    var _a;
    if (typeof view.getMode === "function" && view.getMode() === "preview") {
      const containerEl = (_a = view.previewMode) == null ? void 0 : _a.containerEl;
      return containerEl ? Array.from(
        containerEl.querySelectorAll(PREVIEW_TABLE_SELECTOR)
      ).filter(
        (node) => node instanceof HTMLTableElement
      ) : [];
    }
    return Array.from(view.contentEl.querySelectorAll(TABLE_SELECTOR)).filter(
      (node) => node instanceof HTMLTableElement && !isReadingModeTable(node)
    );
  }
  reapplyWidthsFromCache(containerEl) {
    if (this.dragState || this.isComposing) {
      return;
    }
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof import_obsidian2.MarkdownView) || view.contentEl !== containerEl) {
        continue;
      }
      const file = view.file;
      if (!file) {
        return;
      }
      const specs = this.fileTableSnapshots.get(file.path) || [];
      const tables = containerEl.querySelectorAll(TABLE_SELECTOR);
      const usedIndexes = /* @__PURE__ */ new Set();
      tables.forEach((table, index) => {
        if (!(table instanceof HTMLTableElement)) {
          return;
        }
        const rowCount = Math.max(
          ...Array.from(table.rows).map((row) => row.cells.length),
          0
        );
        if (rowCount < 1) {
          return;
        }
        const tableSpec = this.matchSpecForTable(
          table,
          specs,
          usedIndexes,
          index,
          view
        );
        const widths = this.getWidthsForTable(table, tableSpec, rowCount);
        this.applyColumnWidthStyles(table, widths);
        this.positionHandles(table);
      });
      return;
    }
  }
  async handleEditorChange(editor, context) {
    var _a, _b;
    if (!editor || typeof editor.getValue !== "function") {
      return;
    }
    if (this.isComposing) {
      return;
    }
    const file = (context == null ? void 0 : context.file) || ((_a = context == null ? void 0 : context.view) == null ? void 0 : _a.file);
    if (!(file == null ? void 0 : file.path)) {
      return;
    }
    const filePath = file.path;
    const previousMarkdown = this.fileMarkdownSnapshots.get(filePath) || "";
    if (this.tryCompleteTaskSyntax(editor, filePath, previousMarkdown)) {
      this.fileMarkdownSnapshots.set(filePath, editor.getValue());
      return;
    }
    const markdown = editor.getValue();
    const currentSpecs = extractMarkdownTableSpecs(markdown);
    this.fileMarkdownSnapshots.set(filePath, markdown);
    if (this.consumeInternalChangeBudget(filePath)) {
      this.fileTableSnapshots.set(filePath, currentSpecs);
      this.scheduleRefresh("editor-change-internal");
      return;
    }
    const previousSpecs = this.fileTableSnapshots.get(filePath) || [];
    const restorations = [];
    for (const currentSpec of currentSpecs) {
      const previousSpec = previousSpecs.find(
        (item) => item.separatorLineIndex === currentSpec.separatorLineIndex
      ) || previousSpecs.find(
        (item) => item.tableOrdinal === currentSpec.tableOrdinal
      );
      if (!previousSpec) {
        continue;
      }
      const headerChanged = previousSpec.rawHeaderLine !== currentSpec.rawHeaderLine;
      const separatorChanged = previousSpec.rawSeparatorLine !== currentSpec.rawSeparatorLine;
      const sameColumnCount = previousSpec.columns.length === currentSpec.columns.length;
      const columnCountChanged = previousSpec.columns.length !== currentSpec.columns.length;
      const bodyChanged = !areStringArraysEqual(
        previousSpec.bodyLines,
        currentSpec.bodyLines
      );
      const reorderedColumns = sameColumnCount ? reorderColumnsByHeader(previousSpec, currentSpec) : null;
      const transferredColumns = headerChanged ? transferColumnsToCurrentLayout(previousSpec, currentSpec) : null;
      if (headerChanged && reorderedColumns) {
        restorations.push({
          lineIndex: currentSpec.separatorLineIndex,
          line: buildSeparatorLineFromColumns(reorderedColumns)
        });
        continue;
      }
      if (headerChanged && columnCountChanged && ((transferredColumns == null ? void 0 : transferredColumns.matchedCount) || 0) > 0) {
        restorations.push({
          lineIndex: currentSpec.separatorLineIndex,
          line: buildSeparatorLineFromColumns(
            (transferredColumns == null ? void 0 : transferredColumns.columns) || []
          )
        });
        continue;
      }
      if (separatorChanged && sameColumnCount && (headerChanged || bodyChanged)) {
        restorations.push({
          lineIndex: (_b = findSeparatorLineForSpec(markdown, currentSpec)) != null ? _b : currentSpec.separatorLineIndex,
          line: previousSpec.rawSeparatorLine
        });
      }
    }
    if (!restorations.length) {
      this.fileTableSnapshots.set(filePath, currentSpecs);
      this.scheduleRefresh("editor-change");
      return;
    }
    this.markInternalChange(filePath);
    restorations.sort((a, b) => b.lineIndex - a.lineIndex).forEach((restoration) => {
      const currentLine = editor.getLine(restoration.lineIndex);
      editor.replaceRange(
        restoration.line,
        { line: restoration.lineIndex, ch: 0 },
        { line: restoration.lineIndex, ch: currentLine.length }
      );
    });
    const nextMarkdown = editor.getValue();
    this.fileMarkdownSnapshots.set(filePath, nextMarkdown);
    this.fileTableSnapshots.set(
      filePath,
      extractMarkdownTableSpecs(nextMarkdown)
    );
    this.scheduleRefresh("editor-change-restoration");
    if ((context == null ? void 0 : context.view) instanceof import_obsidian2.MarkdownView) {
      await this.syncPreviewAfterMarkdownChange(context.view);
    }
  }
  tryCompleteTaskSyntax(editor, filePath, previousMarkdown) {
    if (!this.plugin.settings.enableTaskSyntaxCompletion || typeof editor.getCursor !== "function" || typeof editor.getLine !== "function" || typeof editor.replaceRange !== "function") {
      return false;
    }
    const cursor = editor.getCursor();
    if (!cursor || typeof cursor.line !== "number" || typeof cursor.ch !== "number") {
      return false;
    }
    const currentLine = editor.getLine(cursor.line);
    if (typeof currentLine !== "string") {
      return false;
    }
    const beforeCursor = currentLine.slice(0, cursor.ch);
    const afterCursor = currentLine.slice(cursor.ch);
    const previousLine = getLineAt(previousMarkdown, cursor.line);
    if (!/^\s*-\s(?:\[)?$/.test(beforeCursor) || afterCursor.length > 0 || !isLikelyTaskSyntaxInsertion(previousLine, currentLine)) {
      return false;
    }
    this.markInternalChange(filePath);
    if (beforeCursor.endsWith("[")) {
      editor.replaceRange(
        "[ ] ",
        { line: cursor.line, ch: cursor.ch - 1 },
        cursor
      );
    } else {
      editor.replaceRange(" ] ", cursor);
    }
    if (typeof editor.setCursor === "function") {
      editor.setCursor({ line: cursor.line, ch: cursor.ch + 3 });
    }
    return true;
  }
  async getMarkdownSource(view) {
    return view.editor && typeof view.editor.getValue === "function" ? view.editor.getValue() : this.plugin.app.vault.cachedRead(view.file);
  }
  matchSpecForTable(table, specs, usedIndexes, fallbackIndex, view = null) {
    var _a;
    if (!Array.isArray(specs) || !specs.length || !(table instanceof HTMLTableElement)) {
      return null;
    }
    const ordinalIndex = getTableMatchIndex(table, fallbackIndex);
    if (ordinalIndex !== null && ordinalIndex >= 0 && ordinalIndex < specs.length && !usedIndexes.has(ordinalIndex)) {
      usedIndexes.add(ordinalIndex);
      return specs[ordinalIndex];
    }
    const sourceLine = getTableSourceLineForDomTable(view, table);
    if (sourceLine !== null) {
      const rangedMatches = specs.map((spec, index) => ({ spec, index })).filter(
        ({ spec, index }) => !usedIndexes.has(index) && sourceLine >= spec.headerLineIndex && sourceLine <= spec.separatorLineIndex + spec.bodyLines.length
      );
      if (rangedMatches.length === 1) {
        usedIndexes.add(rangedMatches[0].index);
        return rangedMatches[0].spec;
      }
      if (rangedMatches.length > 1) {
        const columnCount2 = getDomTableColumnCount(table);
        let candidates = rangedMatches;
        if (columnCount2 > 0) {
          const exact = rangedMatches.filter(
            ({ spec }) => spec.headerCells.length === columnCount2
          );
          if (exact.length === 1) {
            usedIndexes.add(exact[0].index);
            return exact[0].spec;
          }
          if (exact.length) {
            candidates = exact;
          }
        }
        const bodySignature2 = domTableBodySignature(table);
        if (bodySignature2) {
          const bodyMatches2 = candidates.filter(
            ({ spec }) => specBodySignature(spec) === bodySignature2
          );
          if (bodyMatches2.length === 1) {
            usedIndexes.add(bodyMatches2[0].index);
            return bodyMatches2[0].spec;
          }
        }
        candidates.sort(
          (a, b) => Math.abs(sourceLine - a.spec.headerLineIndex) - Math.abs(sourceLine - b.spec.headerLineIndex)
        );
        usedIndexes.add(candidates[0].index);
        return candidates[0].spec;
      }
    }
    const bodySignature = domTableBodySignature(table);
    const bodyMatches = matchSpecIndexesByBodySignature(
      bodySignature,
      specs,
      usedIndexes
    );
    if (bodyMatches.length === 1) {
      usedIndexes.add(bodyMatches[0]);
      return specs[bodyMatches[0]];
    }
    const separatorLine = Number.parseInt(
      (_a = table.dataset.markplusSeparatorLine) != null ? _a : "",
      10
    );
    if (Number.isInteger(separatorLine) && separatorLine >= 0) {
      const matchedIndex = specs.findIndex(
        (spec, index) => !usedIndexes.has(index) && spec.separatorLineIndex === separatorLine
      );
      if (matchedIndex >= 0) {
        usedIndexes.add(matchedIndex);
        return specs[matchedIndex];
      }
    }
    const columnCount = getDomTableColumnCount(table);
    const contentSignature = domTableContentSignature(table);
    if (contentSignature) {
      let contentMatches = specs.map((spec, index) => ({ spec, index })).filter(
        ({ spec, index }) => !usedIndexes.has(index) && specContentSignature(spec) === contentSignature
      );
      if (columnCount > 0 && contentMatches.length > 1) {
        const exact = contentMatches.filter(
          ({ spec }) => spec.headerCells.length === columnCount
        );
        if (exact.length === 1) {
          usedIndexes.add(exact[0].index);
          return exact[0].spec;
        }
        if (exact.length) {
          contentMatches = exact;
        }
      }
      if (contentMatches.length === 1) {
        usedIndexes.add(contentMatches[0].index);
        return contentMatches[0].spec;
      }
    }
    const headerSignature = domTableHeaderSignature(table);
    if (headerSignature) {
      let headerMatches = specs.map((spec, index) => ({ spec, index })).filter(
        ({ spec, index }) => !usedIndexes.has(index) && specHeaderSignature(spec) === headerSignature
      );
      if (columnCount > 0 && headerMatches.length > 1) {
        const exact = headerMatches.filter(
          ({ spec }) => spec.headerCells.length === columnCount
        );
        if (exact.length === 1) {
          usedIndexes.add(exact[0].index);
          return exact[0].spec;
        }
        if (exact.length) {
          headerMatches = exact;
        }
      }
      if (contentSignature && headerMatches.length > 1) {
        const exact = headerMatches.filter(
          ({ spec }) => specContentSignature(spec) === contentSignature
        );
        if (exact.length === 1) {
          usedIndexes.add(exact[0].index);
          return exact[0].spec;
        }
      }
      if (headerMatches.length === 1) {
        usedIndexes.add(headerMatches[0].index);
        return headerMatches[0].spec;
      }
    }
    if (fallbackIndex !== null && fallbackIndex >= 0 && fallbackIndex < specs.length && !usedIndexes.has(fallbackIndex)) {
      usedIndexes.add(fallbackIndex);
      return specs[fallbackIndex];
    }
    return null;
  }
  decorateTable(table, tableSpec, view, tableIndex) {
    if (!(table instanceof HTMLTableElement)) {
      return;
    }
    const columnCount = Math.max(
      ...Array.from(table.rows).map((row) => row.cells.length),
      0
    );
    if (columnCount < 1) {
      return;
    }
    this.applyTableStyleClasses(table);
    table.dataset.markplusTableIndex = String(tableIndex);
    if (!tableSpec) {
      if (isReadingModeTable(table)) {
        this.alignPreviewTableWrapper(table);
      }
      this.removeResizeHandles(table);
      return;
    }
    if (Number.isInteger(tableSpec.tableOrdinal)) {
      table.dataset.markplusTableOrdinal = String(tableSpec.tableOrdinal);
    } else {
      delete table.dataset.markplusTableOrdinal;
    }
    if (Number.isInteger(tableSpec.separatorLineIndex)) {
      table.dataset.markplusSeparatorLine = String(tableSpec.separatorLineIndex);
    } else {
      delete table.dataset.markplusSeparatorLine;
    }
    const colgroup = this.ensureColgroup(table, columnCount);
    colgroup.dataset.markplusInitialized = "true";
    const widths = this.getWidthsForTable(table, tableSpec, columnCount);
    this.applyWidthsToColgroup(table, colgroup, widths);
    this.applyTableColumnAlignment(table, tableSpec.columns);
    if (this.plugin.settings.enableTableFormulas) {
      applyTableFormulasToDom(table, tableSpec);
    }
    if (isReadingModeTable(table)) {
      this.removeResizeHandles(table);
      return;
    }
    this.bindTableHoverTracking(table);
    this.syncHandleCount(table, columnCount, tableSpec, view);
    this.syncScaleHandle(table, tableSpec, view);
    this.syncMenuButton(table, tableSpec, view);
    this.bindTableCellFill(table);
    this.syncActiveFillCell(table, tableSpec, view);
  }
  applyTableStyleClasses(table) {
    const styleVariant = this.plugin.settings.tableStyleVariant || DEFAULT_SETTINGS.tableStyleVariant;
    table.dataset.markplusStyle = styleVariant;
    table.className = table.className.split(/\s+/).filter(
      (className) => className && !className.startsWith("markplus-table-style-")
    ).join(" ");
    table.classList.add(`markplus-table-style-${styleVariant}`);
  }
  getWidthsForTable(table, tableSpec, columnCount) {
    if (tableSpec && tableSpec.columns.length) {
      return Array.from({ length: columnCount }, (_, index) => {
        var _a, _b;
        const dashCount = (_b = (_a = tableSpec.columns[index]) == null ? void 0 : _a.dashCount) != null ? _b : 3;
        return Math.max(
          this.plugin.settings.minColumnWidth,
          dashCount * this.plugin.settings.pixelsPerDash
        );
      });
    }
    return this.readCurrentWidths(table, columnCount);
  }
  ensureColgroup(table, columnCount) {
    var _a;
    let colgroup = table.querySelector(
      ":scope > colgroup.markplus-colgroup"
    );
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      colgroup.className = "markplus-colgroup";
      table.insertBefore(colgroup, table.firstChild);
    }
    while (colgroup.children.length < columnCount) {
      colgroup.appendChild(document.createElement("col"));
    }
    while (colgroup.children.length > columnCount) {
      (_a = colgroup.lastElementChild) == null ? void 0 : _a.remove();
    }
    return colgroup;
  }
  ensureObserver(containerEl) {
    if (this.observerMap.has(containerEl)) {
      return;
    }
    const observer = new MutationObserver((records) => {
      const summary = summarizeMutations(records);
      if (summary.otherMutations !== 0) {
        this.reapplyWidthsFromCache(containerEl);
        this.scheduleRefresh("mutation-observer");
      }
    });
    observer.observe(containerEl, { childList: true, subtree: true });
    this.observerMap.set(containerEl, observer);
  }
  disconnectObservers() {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      const contentEl = view == null ? void 0 : view.contentEl;
      const observer = contentEl ? this.observerMap.get(contentEl) : null;
      observer == null ? void 0 : observer.disconnect();
    }
  }
  syncHandleCount(table, count, tableSpec, view) {
    var _a;
    const handles = this.handleMap.get(table) || [];
    while (handles.length < count) {
      const handle = document.createElement("div");
      handle.className = "markplus-column-handle";
      handle.addEventListener("pointerdown", (event) => {
        this.startDragging(
          event,
          handle,
          table,
          handles.indexOf(handle),
          tableSpec,
          view
        );
      });
      table.appendChild(handle);
      handles.push(handle);
    }
    while (handles.length > count) {
      (_a = handles.pop()) == null ? void 0 : _a.remove();
    }
    this.handleMap.set(table, handles);
    this.positionHandles(table);
  }
  bindTableHoverTracking(table) {
    const headerRow = getTableHeaderRow(table);
    if (!headerRow || table.dataset.markplusHoverBound === "true") {
      return;
    }
    table.dataset.markplusHoverBound = "true";
    headerRow.addEventListener("mousemove", (event) => {
      var _a;
      if (((_a = this.dragState) == null ? void 0 : _a.table) !== table) {
        this.updateActiveHandleForPointer(table, event.clientX);
      }
    });
    headerRow.addEventListener("mouseleave", () => {
      var _a;
      if (((_a = this.dragState) == null ? void 0 : _a.table) !== table) {
        this.clearActiveHandles(table);
      }
    });
  }
  syncScaleHandle(table, tableSpec, view) {
    let handle = this.scaleHandleMap.get(table);
    if (!handle) {
      handle = document.createElement("div");
      handle.className = "markplus-table-scale-handle";
      handle.addEventListener("pointerdown", (event) => {
        this.startScaleDragging(event, table, tableSpec, view);
      });
      table.appendChild(handle);
      this.scaleHandleMap.set(table, handle);
    }
  }
  syncMenuButton(table, tableSpec, view) {
    let button = this.menuButtonMap.get(table);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "markplus-table-menu-button clickable-icon";
      button.setAttribute("aria-label", "\u8868\u683C\u83DC\u5355");
      (0, import_obsidian2.setIcon)(button, "settings-2");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.showTableMenu(event, table, tableSpec, view);
      });
      table.appendChild(button);
      this.menuButtonMap.set(table, button);
    }
    this.positionMenuButton(table, button);
  }
  positionMenuButton(table, button = null) {
    var _a, _b;
    const current = button || this.menuButtonMap.get(table);
    if (!current) {
      return;
    }
    const top = (_b = (_a = getTableHeaderRow(table)) == null ? void 0 : _a.offsetTop) != null ? _b : 0;
    current.style.left = "0px";
    current.style.top = `${top}px`;
  }
  showTableMenu(event, table, tableSpec, view) {
    const resolvedView = view || this.getViewForTable(table);
    const resolvedSpec = this.resolveTableSpec(table, tableSpec, resolvedView);
    const styleVariant = this.plugin.settings.tableStyleVariant || DEFAULT_SETTINGS.tableStyleVariant;
    const alignment = this.getTableAlignment(resolvedView, resolvedSpec);
    const menu = new import_obsidian2.Menu();
    menu.addItem((item) => {
      item.setTitle("\u590D\u5236\u8868\u683C").setIcon("copy").onClick(() => {
        this.copyTableToClipboard(resolvedView, resolvedSpec, table);
      });
    });
    menu.addItem((item) => {
      item.setTitle("\u5220\u9664\u8868\u683C").setIcon("trash").onClick(() => {
        this.deleteTableFromMarkdown(resolvedView, resolvedSpec, table).catch(
          () => {
          }
        );
      });
    });
    menu.addSeparator();
    TABLE_ALIGNMENT_OPTIONS.forEach((option) => {
      menu.addItem((item) => {
        item.setTitle(option.label).setIcon(option.icon).setChecked(alignment === option.value).onClick(() => {
          this.setTableAlignment(
            resolvedView,
            resolvedSpec,
            table,
            option.value
          ).catch(() => {
          });
        });
      });
    });
    menu.addSeparator();
    TABLE_STYLE_OPTIONS.forEach((option) => {
      menu.addItem((item) => {
        item.setTitle(option.label).setChecked(styleVariant === option.value).onClick(() => {
          this.setGlobalTableStyleVariant(option.value).catch(() => {
          });
        });
      });
    });
    menu.showAtPosition({ x: event.clientX, y: event.clientY });
  }
  getTableAlignment(view, tableSpec) {
    var _a;
    const editor = view == null ? void 0 : view.editor;
    if (editor && tableSpec && typeof editor.getValue === "function") {
      const separatorLine = findSeparatorLineForSpec(
        editor.getValue(),
        tableSpec
      );
      if (separatorLine !== null && typeof editor.getLine === "function") {
        const separator = parseSeparatorLine(editor.getLine(separatorLine));
        if ((_a = separator == null ? void 0 : separator.columns) == null ? void 0 : _a.length) {
          return getTableAlignmentFromColumns(separator.columns);
        }
      }
    }
    return getTableAlignmentFromColumns(tableSpec == null ? void 0 : tableSpec.columns);
  }
  async setTableAlignment(view, tableSpec, table, alignment) {
    var _a;
    const editor = view == null ? void 0 : view.editor;
    if (!editor || !(view == null ? void 0 : view.file) || !tableSpec || !TABLE_ALIGNMENT_OPTIONS.some((option) => option.value === alignment)) {
      return;
    }
    const markdown = editor.getValue();
    const currentSpecs = extractMarkdownTableSpecs(markdown);
    let resolvedSpec = tableSpec;
    if (Number.isInteger(tableSpec.tableOrdinal) && tableSpec.tableOrdinal >= 0 && tableSpec.tableOrdinal < currentSpecs.length) {
      resolvedSpec = currentSpecs[tableSpec.tableOrdinal];
    }
    const separatorLine = findSeparatorLineForSpec(markdown, resolvedSpec);
    if (separatorLine === null) {
      return;
    }
    const separator = parseSeparatorLine(editor.getLine(separatorLine));
    if (!((_a = separator == null ? void 0 : separator.columns) == null ? void 0 : _a.length)) {
      return;
    }
    const nextColumns = applyAlignmentToColumns(separator.columns, alignment);
    const nextLine = buildSeparatorLineFromColumns(nextColumns);
    this.markInternalChange(view.file.path);
    this.preserveEditorScroll(view, () => {
      const currentLine = editor.getLine(separatorLine);
      editor.replaceRange(
        nextLine,
        { line: separatorLine, ch: 0 },
        { line: separatorLine, ch: currentLine.length }
      );
    });
    const nextMarkdown = editor.getValue();
    this.fileMarkdownSnapshots.set(view.file.path, nextMarkdown);
    this.fileTableSnapshots.set(
      view.file.path,
      extractMarkdownTableSpecs(nextMarkdown)
    );
    const targetTable = table instanceof HTMLTableElement ? table : this.findTableForSpec(view, resolvedSpec);
    if (targetTable) {
      this.applyTableColumnAlignment(targetTable, nextColumns);
      this.positionHandles(targetTable);
    }
    await this.refreshAllTables();
    await this.syncPreviewAfterMarkdownChange(view);
    this.syncReadingPresentation("table-alignment");
  }
  findTableForSpec(view, tableSpec) {
    if (!tableSpec) {
      return null;
    }
    const tables = this.queryTablesForView(view);
    if (Number.isInteger(tableSpec.tableOrdinal)) {
      const matched = tables.find(
        (table) => getTableMatchIndex(table) === tableSpec.tableOrdinal
      );
      if (matched) {
        return matched;
      }
    }
    return tables[tableSpec.tableOrdinal] || tables[0] || null;
  }
  applyTableColumnAlignment(table, columns) {
    if (!(table instanceof HTMLTableElement) || !Array.isArray(columns) || !columns.length) {
      return;
    }
    table.classList.remove(...MARKPLUS_TABLE_ALIGNMENT_CLASSES);
    const tableAlignment = getTableAlignmentFromColumns(columns);
    if (tableAlignment) {
      table.classList.add(`markplus-table-align-${tableAlignment}`);
      this.clearPerColumnAlignmentClasses(table);
      return;
    }
    for (const row of Array.from(table.rows)) {
      Array.from(row.cells).forEach((cell, index) => {
        this.setCellAlignmentClass(
          cell,
          getColumnAlignmentKind(columns[index])
        );
      });
    }
  }
  clearPerColumnAlignmentClasses(table) {
    table.querySelectorAll("td, th").forEach((cell) => {
      cell.classList.remove(...MARKPLUS_COLUMN_ALIGNMENT_CLASSES);
      cell.style.removeProperty("text-align");
    });
  }
  setCellAlignmentClass(cell, alignment) {
    if (!(cell instanceof HTMLElement)) {
      return;
    }
    cell.classList.remove(...MARKPLUS_COLUMN_ALIGNMENT_CLASSES);
    if (alignment) {
      cell.classList.add(`markplus-col-align-${alignment}`);
    }
    cell.style.removeProperty("text-align");
  }
  async copyTableToClipboard(view, tableSpec, table) {
    const markdown = getTableMarkdownForCopy(
      view || this.getViewForTable(table),
      this.resolveTableSpec(
        table,
        tableSpec,
        view || this.getViewForTable(table)
      ),
      table
    );
    if (!markdown) {
      new import_obsidian2.Notice("\u65E0\u6CD5\u590D\u5236\u8868\u683C");
      return;
    }
    try {
      await navigator.clipboard.writeText(markdown);
      new import_obsidian2.Notice("\u8868\u683C\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F");
    } catch (_error) {
      new import_obsidian2.Notice("\u590D\u5236\u8868\u683C\u5931\u8D25");
    }
  }
  async setGlobalTableStyleVariant(value) {
    this.plugin.settings.tableStyleVariant = value;
    await this.plugin.saveSettings();
    this.syncReadingPresentation("table-style-change");
    this.scheduleRefresh("table-style-change");
  }
  async deleteTableFromMarkdown(view, tableSpec, table) {
    const editor = view == null ? void 0 : view.editor;
    if (!editor || !(view == null ? void 0 : view.file) || !tableSpec) {
      return;
    }
    const start = tableSpec.headerLineIndex;
    const end = tableSpec.separatorLineIndex + tableSpec.bodyLines.length;
    const lineCount = typeof editor.lineCount === "function" ? editor.lineCount() : editor.getValue().split(/\r?\n/).length;
    if (!Number.isInteger(start) || start < 0 || end < start || end >= lineCount) {
      return;
    }
    await this.withPreservedViewScroll(view, async () => {
      this.markInternalChange(view.file.path);
      const endLineLength = editor.getLine(end).length;
      if (end < lineCount - 1) {
        editor.replaceRange(
          "",
          { line: start, ch: 0 },
          { line: end + 1, ch: 0 }
        );
      } else if (start > 0) {
        const previousLength = editor.getLine(start - 1).length;
        editor.replaceRange(
          "",
          { line: start - 1, ch: previousLength },
          { line: end, ch: endLineLength }
        );
      } else {
        editor.replaceRange(
          "",
          { line: 0, ch: 0 },
          { line: end, ch: endLineLength }
        );
      }
      const nextMarkdown = editor.getValue();
      this.fileMarkdownSnapshots.set(view.file.path, nextMarkdown);
      this.fileTableSnapshots.set(
        view.file.path,
        extractMarkdownTableSpecs(nextMarkdown)
      );
    });
    this.removeResizeHandles(table);
    await this.syncPreviewAfterMarkdownChange(view);
    this.scheduleRefresh("delete-table");
  }
  getViewForTable(table) {
    var _a;
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof import_obsidian2.MarkdownView && ((_a = view.contentEl) == null ? void 0 : _a.contains(table))) {
        return view;
      }
    }
    return null;
  }
  bindTableCellFill(table) {
    if (!this.plugin.settings.enableTableCellFill || table.dataset.markplusFillBound === "true") {
      return;
    }
    table.dataset.markplusFillBound = "true";
    table.addEventListener(
      "pointerdown",
      (event) => {
        var _a, _b;
        if (!this.plugin.settings.enableTableCellFill || this.fillDragState || ((_a = event.target) == null ? void 0 : _a.closest(
          ".markplus-cell-fill-handle, .markplus-column-handle, .markplus-table-menu-button"
        ))) {
          return;
        }
        const cell = (_b = event.target) == null ? void 0 : _b.closest(
          "td, th"
        );
        if (!cell || !table.contains(cell)) {
          return;
        }
        const view = this.getViewForTable(table);
        const tableSpec = this.resolveTableSpec(table, null, view);
        this.activateCellFill(table, cell, tableSpec, view);
      },
      true
    );
  }
  onDocumentPointerDown(event) {
    var _a, _b;
    if (this.fillDragState || ((_a = event.target) == null ? void 0 : _a.closest(".markplus-cell-fill-handle")) || ((_b = event.target) == null ? void 0 : _b.closest(
      ".markplus-resizable-table td, .markplus-resizable-table th"
    ))) {
      return;
    }
    this.clearActiveFillCell();
  }
  resolveTableSpec(table, fallbackSpec, view) {
    var _a;
    if (!(view == null ? void 0 : view.editor) || typeof view.editor.getValue !== "function") {
      return fallbackSpec || null;
    }
    const currentSpecs = extractMarkdownTableSpecs(view.editor.getValue());
    if (currentSpecs.length === 1) {
      return currentSpecs[0];
    }
    for (const index of [
      getTableMatchIndex(table),
      fallbackSpec == null ? void 0 : fallbackSpec.tableOrdinal
    ].filter(
      (value) => Number.isInteger(value) && value >= 0
    )) {
      if (index < currentSpecs.length) {
        return currentSpecs[index];
      }
    }
    for (const separatorLine of [
      Number.parseInt((_a = table.dataset.markplusSeparatorLine) != null ? _a : "", 10),
      fallbackSpec == null ? void 0 : fallbackSpec.separatorLineIndex
    ].filter(
      (value) => Number.isInteger(value) && value >= 0
    )) {
      const matched = currentSpecs.find(
        (spec) => spec.separatorLineIndex === separatorLine
      );
      if (matched) {
        return matched;
      }
    }
    return this.matchSpecForTable(
      table,
      currentSpecs,
      /* @__PURE__ */ new Set(),
      getTableMatchIndex(table),
      view
    ) || fallbackSpec || null;
  }
  activateCellFill(table, cell, tableSpec, view) {
    if (!this.plugin.settings.enableTableCellFill) {
      return;
    }
    const resolvedView = view || this.getViewForTable(table);
    const resolvedSpec = this.resolveTableSpec(table, tableSpec, resolvedView);
    const { rowIndex, colIndex } = getCellCoords(table, cell);
    this.clearActiveFillCell();
    let handle = this.cellFillHandleMap.get(table);
    if (!handle) {
      handle = document.createElement("div");
      handle.className = "markplus-cell-fill-handle";
      handle.addEventListener(
        "pointerdown",
        (event) => {
          this.startFillDrag(event, table);
        }
      );
      this.cellFillHandleMap.set(table, handle);
    }
    cell.appendChild(handle);
    this.fillState = {
      table,
      cell,
      tableSpec: resolvedSpec,
      view: resolvedView,
      handle,
      sourceRow: rowIndex,
      sourceCol: colIndex
    };
  }
  syncActiveFillCell(table, tableSpec, view) {
    var _a;
    if (!this.fillState || this.fillState.table !== table || this.fillDragState) {
      return;
    }
    const { sourceRow, sourceCol, handle } = this.fillState;
    const sourceCell = (_a = table.rows[sourceRow]) == null ? void 0 : _a.cells[sourceCol];
    if (!sourceCell) {
      this.clearActiveFillCell();
      return;
    }
    const resolvedView = view || this.getViewForTable(table);
    this.fillState.cell = sourceCell;
    this.fillState.view = resolvedView;
    this.fillState.tableSpec = this.resolveTableSpec(
      table,
      tableSpec,
      resolvedView
    );
    if (!sourceCell.contains(handle)) {
      sourceCell.appendChild(handle);
    }
  }
  clearActiveFillCell() {
    var _a, _b;
    (_b = (_a = this.fillState) == null ? void 0 : _a.handle) == null ? void 0 : _b.remove();
    this.fillState = null;
  }
  startFillDrag(event, table) {
    var _a;
    event.preventDefault();
    event.stopPropagation();
    const fillState = this.fillState;
    if (!fillState || fillState.table !== table) {
      return;
    }
    const view = fillState.view || this.getViewForTable(table);
    const tableSpec = this.resolveTableSpec(table, fillState.tableSpec, view);
    if (!tableSpec || !(view == null ? void 0 : view.file)) {
      return;
    }
    const { sourceRow, sourceCol } = fillState;
    const cell = (_a = table.rows[sourceRow]) == null ? void 0 : _a.cells[sourceCol];
    if (!cell) {
      return;
    }
    fillState.cell = cell;
    fillState.tableSpec = tableSpec;
    fillState.view = view;
    const sourceText = getCellSourceText(tableSpec, sourceRow, sourceCol);
    if (sourceText === null) {
      return;
    }
    const handle = event.currentTarget;
    this.fillDragState = {
      table,
      tableSpec,
      view,
      sourceRow,
      sourceCol,
      sourceText,
      disableIncrementFill: event.ctrlKey || event.metaKey,
      pointerId: event.pointerId,
      fillHandle: handle,
      targets: []
    };
    table.classList.add("markplus-is-filling");
    document.body.classList.add("markplus-fill-cursor");
    if (handle && "setPointerCapture" in handle) {
      try {
        handle.setPointerCapture(event.pointerId);
      } catch (_error) {
      }
    }
    window.addEventListener("pointermove", this.boundFillPointerMove);
    window.addEventListener("pointerup", this.boundFillPointerUp);
    window.addEventListener("pointercancel", this.boundFillPointerCancel);
  }
  onFillPointerMove(event) {
    if (!this.fillDragState) {
      return;
    }
    const { table, sourceRow, sourceCol } = this.fillDragState;
    const targetCell = getTableCellFromPoint(
      table,
      event.clientX,
      event.clientY
    );
    this.clearFillHighlights(table);
    if (!targetCell) {
      this.fillDragState.targets = [];
      return;
    }
    const targets = computeFillTargets(
      { rowIndex: sourceRow, colIndex: sourceCol },
      getCellCoords(table, targetCell)
    );
    this.highlightFillTargets(table, targets);
    this.fillDragState.targets = targets;
  }
  async onFillPointerUp(event) {
    if (!this.fillDragState) {
      return;
    }
    const {
      table,
      view,
      sourceRow,
      sourceCol,
      targets,
      disableIncrementFill,
      tableSpec: dragTableSpec
    } = this.fillDragState;
    const tableSpec = this.resolveTableSpec(table, dragTableSpec, view);
    const sourceText = tableSpec ? getCellSourceText(tableSpec, sourceRow, sourceCol) : null;
    const targetCell = getTableCellFromPoint(
      table,
      event.clientX,
      event.clientY
    );
    let resolvedTargets = targets;
    if (targetCell) {
      const targetCoords = getCellCoords(table, targetCell);
      resolvedTargets = computeFillTargets(
        { rowIndex: sourceRow, colIndex: sourceCol },
        targetCoords
      );
    }
    if (tableSpec && sourceText !== null) {
      await this.applyCellFill(
        view,
        tableSpec,
        sourceRow,
        sourceCol,
        sourceText,
        resolvedTargets,
        { disableIncrementFill }
      );
      this.stopFillDragging();
      this.reapplyTableFormulasAfterFill(view, tableSpec);
      this.scheduleRefresh("fill-complete");
      return;
    }
    this.stopFillDragging();
  }
  onFillPointerCancel() {
    this.stopFillDragging();
  }
  stopFillDragging() {
    var _a;
    if (this.fillDragState) {
      const { table, fillHandle, pointerId } = this.fillDragState;
      this.clearFillHighlights(table);
      table.classList.remove("markplus-is-filling");
      if (fillHandle && "releasePointerCapture" in fillHandle) {
        try {
          const el = fillHandle;
          if ((_a = el.hasPointerCapture) == null ? void 0 : _a.call(el, pointerId)) {
            el.releasePointerCapture(pointerId);
          }
        } catch (_error) {
        }
      }
    }
    this.fillDragState = null;
    document.body.classList.remove("markplus-fill-cursor");
    window.removeEventListener("pointermove", this.boundFillPointerMove);
    window.removeEventListener("pointerup", this.boundFillPointerUp);
    window.removeEventListener("pointercancel", this.boundFillPointerCancel);
    if (this.pendingRefreshReason) {
      const reason = this.pendingRefreshReason;
      this.pendingRefreshReason = null;
      this.scheduleRefresh(reason);
    }
  }
  highlightFillTargets(table, targets) {
    var _a;
    for (const { rowIndex, colIndex } of targets) {
      const cell = (_a = table.rows[rowIndex]) == null ? void 0 : _a.cells[colIndex];
      cell == null ? void 0 : cell.classList.add("markplus-cell-fill-target");
    }
  }
  clearFillHighlights(table) {
    table.querySelectorAll(".markplus-cell-fill-target").forEach((cell) => {
      cell.classList.remove("markplus-cell-fill-target");
    });
  }
  async applyCellFill(view, tableSpec, sourceRow, sourceCol, sourceText, targets, options = {}) {
    const editor = view == null ? void 0 : view.editor;
    if (!editor || !(view == null ? void 0 : view.file) || !tableSpec || !Array.isArray(targets) || !targets.length) {
      return;
    }
    const updates = /* @__PURE__ */ new Map();
    for (const { rowIndex, colIndex } of targets) {
      if (rowIndex === sourceRow && colIndex === sourceCol) {
        continue;
      }
      const markdownLineIndex = getMarkdownLineIndexForTableRow(
        tableSpec,
        rowIndex
      );
      const currentLine = updates.has(markdownLineIndex) ? updates.get(markdownLineIndex) : editor.getLine(markdownLineIndex);
      const nextValue = getFillCellValue(
        sourceText,
        sourceRow,
        sourceCol,
        rowIndex,
        colIndex,
        options
      );
      updates.set(
        markdownLineIndex,
        replaceCellInMarkdownRow(currentLine, colIndex, nextValue)
      );
    }
    if (!updates.size) {
      return;
    }
    this.markInternalChange(view.file.path, updates.size);
    this.preserveEditorScroll(view, () => {
      [...updates.entries()].sort((a, b) => b[0] - a[0]).forEach(([lineIndex, value]) => {
        const line = editor.getLine(lineIndex);
        editor.replaceRange(
          value,
          { line: lineIndex, ch: 0 },
          { line: lineIndex, ch: line.length }
        );
      });
    });
    const markdown = editor.getValue();
    this.fileMarkdownSnapshots.set(view.file.path, markdown);
    this.fileTableSnapshots.set(
      view.file.path,
      extractMarkdownTableSpecs(markdown)
    );
    await this.syncPreviewAfterMarkdownChange(view);
  }
  positionHandles(table) {
    var _a, _b;
    const handles = this.handleMap.get(table) || [];
    const widths = this.readCurrentWidths(table, handles.length);
    const headerRow = getTableHeaderRow(table);
    const top = (_a = headerRow == null ? void 0 : headerRow.offsetTop) != null ? _a : 0;
    const height = (_b = headerRow == null ? void 0 : headerRow.offsetHeight) != null ? _b : 0;
    let offset = 0;
    table.classList.toggle(
      "markplus-has-active-handle",
      handles.some((handle) => handle.classList.contains("is-active"))
    );
    handles.forEach((handle, index) => {
      const width = widths[index];
      if (width && headerRow) {
        offset += width;
        handle.style.display = "block";
        handle.style.left = `${offset - 4}px`;
        handle.style.top = `${top}px`;
        handle.style.height = `${height}px`;
        handle.dataset.edge = index === handles.length - 1 ? "right" : "middle";
      } else {
        handle.style.display = "none";
      }
    });
    const scaleHandle = this.scaleHandleMap.get(table);
    if (scaleHandle) {
      scaleHandle.style.left = "";
      scaleHandle.style.top = "";
      scaleHandle.style.right = "";
      scaleHandle.style.bottom = "";
    }
    this.positionMenuButton(table);
  }
  updateActiveHandleForPointer(table, clientX) {
    const handles = this.handleMap.get(table) || [];
    if (!handles.length) {
      return;
    }
    const offsetX = clientX - table.getBoundingClientRect().left;
    const widths = this.readCurrentWidths(table, handles.length);
    let total = 0;
    let activeIndex = handles.length - 1;
    for (let index = 0; index < widths.length; index += 1) {
      total += widths[index];
      if (offsetX <= total) {
        activeIndex = Math.min(index, handles.length - 1);
        break;
      }
    }
    handles.forEach((handle, index) => {
      handle.classList.toggle("is-active", index === activeIndex);
    });
    table.classList.add("markplus-has-active-handle");
  }
  clearActiveHandles(table) {
    (this.handleMap.get(table) || []).forEach((handle) => {
      handle.classList.remove("is-active");
    });
    table.classList.remove("markplus-has-active-handle");
  }
  startDragging(event, handle, table, handleIndex, tableSpec, view) {
    event.preventDefault();
    event.stopPropagation();
    this.clearActiveFillCell();
    const widths = this.readCurrentWidths(table);
    if (!widths.length || handleIndex < 0 || handleIndex >= widths.length) {
      return;
    }
    this.dragState = {
      mode: "column",
      table,
      handle,
      handleIndex,
      pointerId: event.pointerId,
      startX: event.clientX,
      widths,
      tableSpec,
      view,
      minWidth: this.plugin.settings.minColumnWidth || DEFAULT_SETTINGS.minColumnWidth
    };
    table.classList.add("markplus-is-resizing");
    (this.handleMap.get(table) || []).forEach((item, index) => {
      item.classList.toggle("is-active", index === handleIndex);
    });
    table.classList.add("markplus-has-active-handle");
    if (typeof handle.setPointerCapture === "function") {
      try {
        handle.setPointerCapture(event.pointerId);
      } catch (_error) {
      }
    }
    document.body.classList.add("markplus-resize-cursor");
    window.addEventListener("pointermove", this.boundPointerMove);
    window.addEventListener("pointerup", this.boundPointerUp);
    window.addEventListener("pointercancel", this.boundPointerCancel);
  }
  startScaleDragging(event, table, tableSpec, view) {
    event.preventDefault();
    event.stopPropagation();
    this.clearActiveFillCell();
    const widths = this.readCurrentWidths(table);
    if (!widths.length) {
      return;
    }
    this.dragState = {
      mode: "scale",
      table,
      startX: event.clientX,
      startWidth: widths.reduce((total, width) => total + width, 0),
      widths,
      tableSpec,
      view,
      minWidth: this.plugin.settings.minColumnWidth || DEFAULT_SETTINGS.minColumnWidth
    };
    table.classList.add("markplus-is-resizing");
    document.body.classList.add("markplus-resize-cursor-diagonal");
    window.addEventListener("pointermove", this.boundPointerMove);
    window.addEventListener("pointerup", this.boundPointerUp);
  }
  onPointerMove(event) {
    if (!this.dragState) {
      return;
    }
    const widths = this.computeDragWidths(event);
    if (!widths) {
      return;
    }
    const { table } = this.dragState;
    const colgroup = this.ensureColgroup(table, widths.length);
    this.applyWidthsToColgroup(table, colgroup, widths);
    this.positionHandles(table);
  }
  computeDragWidths(event) {
    if (!this.dragState) {
      return null;
    }
    const { mode, handleIndex, startX, widths, minWidth, startWidth } = this.dragState;
    const deltaX = event.clientX - startX;
    const nextWidths = widths.slice();
    if (mode === "scale") {
      const scale = Math.max(
        minWidth * widths.length,
        Math.round((startWidth || 0) + deltaX)
      ) / (startWidth || 1);
      for (let index = 0; index < widths.length; index += 1) {
        nextWidths[index] = Math.max(
          minWidth,
          Math.round(widths[index] * scale)
        );
      }
      return nextWidths;
    }
    if (typeof handleIndex !== "number") {
      return nextWidths;
    }
    if (handleIndex === widths.length - 1) {
      nextWidths[handleIndex] = Math.max(
        minWidth,
        Math.round(widths[handleIndex] + deltaX)
      );
      return nextWidths;
    }
    const pairWidth = widths[handleIndex] + widths[handleIndex + 1];
    const clamped = Math.min(
      pairWidth - minWidth,
      Math.max(minWidth, widths[handleIndex] + deltaX)
    );
    nextWidths[handleIndex] = Math.round(clamped);
    nextWidths[handleIndex + 1] = Math.round(pairWidth - clamped);
    return nextWidths;
  }
  async onPointerUp(event) {
    if (!this.dragState) {
      return;
    }
    const widths = this.computeDragWidths(event) || this.readCurrentWidths(this.dragState.table);
    const { table, tableSpec, view } = this.dragState;
    const colgroup = this.ensureColgroup(table, widths.length);
    this.applyWidthsToColgroup(table, colgroup, widths);
    this.positionHandles(table);
    let resolvedSpec = tableSpec;
    if ((view == null ? void 0 : view.editor) && typeof view.editor.getValue === "function") {
      const matchedSpec = this.matchSpecForTable(
        table,
        extractMarkdownTableSpecs(view.editor.getValue()),
        /* @__PURE__ */ new Set(),
        getTableMatchIndex(table),
        view
      );
      if (matchedSpec) {
        resolvedSpec = matchedSpec;
      }
    }
    await this.writeWidthsBackToMarkdown(
      this.readCurrentWidths(table),
      resolvedSpec,
      view
    );
    this.stopDragging();
    if (view) {
      await this.syncPreviewAfterMarkdownChange(view);
    }
    this.scheduleRefresh("pointer-up");
  }
  onPointerCancel() {
    if (this.dragState) {
      this.stopDragging();
      this.scheduleRefresh("pointer-cancel");
    }
  }
  stopDragging() {
    var _a, _b;
    if ((_a = this.dragState) == null ? void 0 : _a.table) {
      this.dragState.table.classList.remove("markplus-is-resizing");
      this.clearActiveHandles(this.dragState.table);
      const handle = this.dragState.handle;
      if (handle && typeof handle.releasePointerCapture === "function") {
        try {
          if ((_b = handle.hasPointerCapture) == null ? void 0 : _b.call(handle, this.dragState.pointerId)) {
            handle.releasePointerCapture(this.dragState.pointerId);
          }
        } catch (_error) {
        }
      }
    }
    this.dragState = null;
    document.body.classList.remove("markplus-resize-cursor");
    document.body.classList.remove("markplus-resize-cursor-diagonal");
    window.removeEventListener("pointermove", this.boundPointerMove);
    window.removeEventListener("pointerup", this.boundPointerUp);
    window.removeEventListener("pointercancel", this.boundPointerCancel);
  }
  markInternalChange(filePath, count = 1) {
    const budget = (this.internalChangeBudget.get(filePath) || 0) + Math.max(1, count);
    this.internalChangeBudget.set(filePath, budget);
  }
  consumeInternalChangeBudget(filePath) {
    const budget = this.internalChangeBudget.get(filePath) || 0;
    if (budget <= 0) {
      return false;
    }
    if (budget === 1) {
      this.internalChangeBudget.delete(filePath);
    } else {
      this.internalChangeBudget.set(filePath, budget - 1);
    }
    return true;
  }
  readCurrentWidths(table, fallbackCount = null) {
    const headerRow = getTableHeaderRow(table);
    if (headerRow == null ? void 0 : headerRow.cells.length) {
      return Array.from(headerRow.cells).map(
        (cell) => Math.round(cell.getBoundingClientRect().width)
      );
    }
    const colgroup = table.querySelector(":scope > colgroup.markplus-colgroup");
    if (colgroup && colgroup.children.length) {
      const widths = Array.from(colgroup.children).map(
        (col) => Math.round(col.getBoundingClientRect().width)
      );
      if (widths.length) {
        return widths;
      }
    }
    return fallbackCount ? Array.from(
      { length: fallbackCount },
      () => this.plugin.settings.minColumnWidth
    ) : [];
  }
  applyWidthsToColgroup(table, colgroup, widths) {
    const resolvedWidths = widths && widths.length ? widths : this.readCurrentWidths(table);
    Array.from(colgroup.children).forEach((col, index) => {
      const width = resolvedWidths[index];
      col.style.width = width ? `${width}px` : "";
    });
    this.applyColumnWidthStyles(table, resolvedWidths);
  }
  applyColumnWidthStyles(table, widths) {
    if (!(widths == null ? void 0 : widths.length)) {
      return;
    }
    table.style.tableLayout = "fixed";
    table.style.width = `${widths.reduce((total, width) => total + width, 0)}px`;
    table.style.maxWidth = "none";
    for (const row of Array.from(table.rows)) {
      Array.from(row.cells).forEach((cell, index) => {
        const width = widths[index];
        if (!width) {
          return;
        }
        cell.style.width = `${width}px`;
        cell.style.minWidth = `${width}px`;
        cell.style.maxWidth = `${width}px`;
      });
    }
  }
  preserveEditorScroll(view, action) {
    var _a, _b, _c;
    const scroller = (_a = view == null ? void 0 : view.contentEl) == null ? void 0 : _a.querySelector(
      ".cm-scroller"
    );
    const scrollTop = (_b = scroller == null ? void 0 : scroller.scrollTop) != null ? _b : null;
    const scrollLeft = (_c = scroller == null ? void 0 : scroller.scrollLeft) != null ? _c : null;
    action();
    if (!scroller || scrollTop === null || scrollLeft === null) {
      return;
    }
    const restoreScroll = () => {
      scroller.scrollTop = scrollTop;
      scroller.scrollLeft = scrollLeft;
    };
    restoreScroll();
    window.requestAnimationFrame(() => {
      restoreScroll();
      window.requestAnimationFrame(restoreScroll);
    });
  }
  async withPreservedViewScroll(view, action) {
    var _a, _b, _c;
    const scroller = (_a = view == null ? void 0 : view.contentEl) == null ? void 0 : _a.querySelector(
      ".cm-scroller"
    );
    const scrollTop = (_b = scroller == null ? void 0 : scroller.scrollTop) != null ? _b : null;
    const scrollLeft = (_c = scroller == null ? void 0 : scroller.scrollLeft) != null ? _c : null;
    await action();
    if (!scroller || scrollTop === null || scrollLeft === null) {
      return;
    }
    const restoreScroll = () => {
      scroller.scrollTop = scrollTop;
      scroller.scrollLeft = scrollLeft;
    };
    restoreScroll();
    window.requestAnimationFrame(() => {
      restoreScroll();
      window.requestAnimationFrame(restoreScroll);
    });
  }
  async writeWidthsBackToMarkdown(widths, tableSpec, view) {
    if (!tableSpec || !(view == null ? void 0 : view.file)) {
      return;
    }
    const separatorLine = buildSeparatorLine(
      tableSpec,
      widths.map(
        (width) => Math.max(3, Math.round(width / this.plugin.settings.pixelsPerDash))
      )
    );
    const markdown = view.editor && typeof view.editor.getValue === "function" ? view.editor.getValue() : await this.plugin.app.vault.cachedRead(view.file);
    const separatorLineIndex = findSeparatorLineForSpec(markdown, tableSpec);
    if (separatorLineIndex == null) {
      return;
    }
    const lines = markdown.split(/\r?\n/);
    if (!parseSeparatorLine(lines[separatorLineIndex])) {
      return;
    }
    if (view.editor && typeof view.editor.replaceRange === "function" && typeof view.editor.getLine === "function") {
      const currentLine = view.editor.getLine(separatorLineIndex);
      if (!parseSeparatorLine(currentLine)) {
        return;
      }
      this.markInternalChange(view.file.path);
      this.preserveEditorScroll(view, () => {
        var _a;
        (_a = view.editor) == null ? void 0 : _a.replaceRange(
          separatorLine,
          { line: separatorLineIndex, ch: 0 },
          { line: separatorLineIndex, ch: currentLine.length }
        );
      });
      const nextMarkdown2 = view.editor.getValue();
      this.fileMarkdownSnapshots.set(view.file.path, nextMarkdown2);
      this.fileTableSnapshots.set(
        view.file.path,
        extractMarkdownTableSpecs(nextMarkdown2)
      );
      return;
    }
    lines[separatorLineIndex] = separatorLine;
    const nextMarkdown = lines.join("\n");
    await this.plugin.app.vault.modify(view.file, nextMarkdown);
    this.fileMarkdownSnapshots.set(view.file.path, nextMarkdown);
    this.fileTableSnapshots.set(
      view.file.path,
      extractMarkdownTableSpecs(nextMarkdown)
    );
  }
  applyReadingPresentationForPreview(previewMode, _reason = "(unknown)") {
    const containerEl = previewMode == null ? void 0 : previewMode.containerEl;
    if (!containerEl) {
      return;
    }
    containerEl.querySelectorAll(PREVIEW_TABLE_SELECTOR).forEach((node) => {
      if (!(node instanceof HTMLTableElement)) {
        return;
      }
      this.applyTableStyleClasses(node);
      this.alignPreviewTableWrapper(node);
    });
  }
  alignPreviewTableWrapper(table) {
    var _a;
    if (!(table instanceof HTMLTableElement) || table.closest(".markdown-source-view, .cm-table-widget")) {
      return;
    }
    table.style.marginLeft = "0";
    table.style.marginRight = "0";
    table.style.marginInlineStart = "0";
    table.style.marginInlineEnd = "0";
    const wrapper = table.closest(
      ".el-table, .table-wrapper"
    );
    if (!wrapper) {
      return;
    }
    wrapper.classList.add("markplus-table-wrapper");
    wrapper.style.width = "var(--file-line-width)";
    wrapper.style.maxWidth = "var(--file-line-width)";
    wrapper.style.marginLeft = "0";
    wrapper.style.marginRight = "auto";
    wrapper.style.marginInlineStart = "0";
    wrapper.style.marginInlineEnd = "auto";
    const block = wrapper.parentElement;
    if (!((_a = block == null ? void 0 : block.classList) == null ? void 0 : _a.contains("el-div"))) {
      return;
    }
    block.classList.add("markplus-table-block");
    block.style.textAlign = "start";
    const display = window.getComputedStyle(block).display;
    if (display.includes("flex") || display.includes("grid")) {
      block.style.justifyContent = "flex-start";
      block.style.alignItems = "flex-start";
      block.style.justifyItems = "start";
    }
  }
  syncReadingPresentation(reason = "(unknown)") {
    window.requestAnimationFrame(() => {
      var _a, _b;
      for (const leaf of this.plugin.app.workspace.getLeavesOfType(
        "markdown"
      )) {
        const view = leaf.view;
        if (view instanceof import_obsidian2.MarkdownView && ((_a = view.getMode) == null ? void 0 : _a.call(view)) === "preview" && ((_b = view.previewMode) == null ? void 0 : _b.containerEl)) {
          this.applyReadingPresentationForPreview(view.previewMode, reason);
        }
      }
    });
  }
  async syncPreviewAfterMarkdownChange(view) {
    var _a, _b, _c;
    if (!(view instanceof import_obsidian2.MarkdownView) || !((_a = view.file) == null ? void 0 : _a.path)) {
      return;
    }
    const markdown = (_c = (_b = view.editor) == null ? void 0 : _b.getValue) == null ? void 0 : _c.call(_b);
    if (typeof markdown === "string") {
      this.fileMarkdownSnapshots.set(view.file.path, markdown);
      this.fileTableSnapshots.set(
        view.file.path,
        extractMarkdownTableSpecs(markdown)
      );
    }
    const previewMode = view.previewMode;
    if (!previewMode) {
      return;
    }
    if (typeof previewMode.rerender === "function" && !this.dragState) {
      previewMode.rerender(true);
      return;
    }
    this.applyReadingPresentationForPreview(
      previewMode,
      "sync-markdown-change"
    );
  }
  reapplyTableFormulasAfterFill(view, tableSpec) {
    if (!this.plugin.settings.enableTableFormulas || !(view == null ? void 0 : view.contentEl) || !tableSpec) {
      return;
    }
    const apply = () => {
      const editor = view.editor;
      if (!editor || typeof editor.getValue !== "function") {
        return false;
      }
      const specs = extractMarkdownTableSpecs(editor.getValue());
      const latestSpec = specs.find(
        (spec) => spec.separatorLineIndex === tableSpec.separatorLineIndex
      ) || (Number.isInteger(tableSpec.tableOrdinal) ? specs[tableSpec.tableOrdinal] : null);
      if (!latestSpec) {
        return false;
      }
      for (const node of view.contentEl.querySelectorAll(TABLE_SELECTOR)) {
        if (!(node instanceof HTMLTableElement)) {
          continue;
        }
        const resolvedSpec = this.resolveTableSpec(node, latestSpec, view);
        if ((resolvedSpec == null ? void 0 : resolvedSpec.separatorLineIndex) === latestSpec.separatorLineIndex) {
          applyTableFormulasToDom(node, latestSpec);
          return true;
        }
      }
      return false;
    };
    window.requestAnimationFrame(() => {
      if (!apply()) {
        window.requestAnimationFrame(apply);
      }
    });
  }
  removeResizeHandles(table) {
    var _a, _b, _c;
    (this.handleMap.get(table) || []).forEach((handle) => handle.remove());
    this.handleMap.delete(table);
    (_a = this.scaleHandleMap.get(table)) == null ? void 0 : _a.remove();
    this.scaleHandleMap.delete(table);
    (_b = this.menuButtonMap.get(table)) == null ? void 0 : _b.remove();
    this.menuButtonMap.delete(table);
    (_c = this.cellFillHandleMap.get(table)) == null ? void 0 : _c.remove();
    this.cellFillHandleMap.delete(table);
  }
};
function getDomTableColumnCount(table) {
  return Math.max(...Array.from(table.rows).map((row) => row.cells.length), 0);
}
function isReadingModeTable(table) {
  return table instanceof HTMLTableElement && !table.closest(".cm-table-widget, .markdown-source-view") && Boolean(
    table.closest(".markdown-preview-view, .markdown-reading-view, .el-table")
  );
}

// src/main.ts
var MarkPlusPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.tableEnhancer = null;
    this._pluginInitialized = false;
  }
  async onload() {
    this._pluginInitialized = false;
    await this.initializePluginFeatures();
  }
  async initializePluginFeatures() {
    if (this._pluginInitialized) {
      return;
    }
    this._pluginInitialized = true;
    const loaded = await this.loadData() || {};
    const migrated = migrateLegacyTableColorSettings(loaded);
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    delete this.settings.tableStyles;
    delete this.settings.tableStripeRowBackground;
    delete this.settings.tableHeaderBackground;
    this.tableEnhancer = new TableColumnResizeController(this);
    if (migrated) {
      await this.saveSettings();
    }
    this.applyTableStyleVariables();
    this.addSettingTab(new MarkPlusSettingTab(this.app, this));
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        var _a;
        (_a = this.tableEnhancer) == null ? void 0 : _a.scheduleRefresh("layout-change");
      })
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        var _a;
        (_a = this.tableEnhancer) == null ? void 0 : _a.scheduleRefresh("active-leaf-change");
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        var _a;
        (_a = this.tableEnhancer) == null ? void 0 : _a.scheduleRefresh("file-open");
      })
    );
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, context) => {
        var _a;
        (_a = this.tableEnhancer) == null ? void 0 : _a.handleEditorChange(editor, context).catch(() => {
        });
      })
    );
    this.registerDomEvent(window, "resize", () => {
      var _a;
      (_a = this.tableEnhancer) == null ? void 0 : _a.scheduleRefresh("window-resize");
    });
    this.registerDomEvent(
      document,
      "compositionstart",
      () => {
        if (!this.tableEnhancer) {
          return;
        }
        this.tableEnhancer.isComposing = true;
        mpLog("compositionstart");
      },
      { capture: true }
    );
    this.registerDomEvent(
      document,
      "compositionend",
      () => {
        if (!this.tableEnhancer) {
          return;
        }
        this.tableEnhancer.isComposing = false;
        mpLog("compositionend");
        this.tableEnhancer.restoreSeparatorsAfterComposition();
        this.tableEnhancer.reapplyWidthsActiveView();
        this.tableEnhancer.scheduleRefresh("composition-end");
      },
      { capture: true }
    );
    this.register(() => {
      var _a, _b;
      (_a = document.getElementById(MARKPLUS_TABLE_COLOR_STYLE_ID)) == null ? void 0 : _a.remove();
      (_b = this.tableEnhancer) == null ? void 0 : _b.destroy();
    });
    this.tableEnhancer.scheduleRefresh("onload");
  }
  onunload() {
    var _a, _b;
    this._pluginInitialized = false;
    (_a = document.getElementById(MARKPLUS_TABLE_COLOR_STYLE_ID)) == null ? void 0 : _a.remove();
    (_b = this.tableEnhancer) == null ? void 0 : _b.destroy();
    this.tableEnhancer = null;
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  applyTableStyleVariables() {
    let styleEl = document.getElementById(MARKPLUS_TABLE_COLOR_STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = MARKPLUS_TABLE_COLOR_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    const rules = [];
    appendTableColorThemeRule(
      rules,
      "theme-light",
      MARKPLUS_TABLE_STRIPE_ROW_BACKGROUND_VAR,
      this.settings.tableStripeRowBackgroundLight
    );
    appendTableColorThemeRule(
      rules,
      "theme-dark",
      MARKPLUS_TABLE_STRIPE_ROW_BACKGROUND_VAR,
      this.settings.tableStripeRowBackgroundDark
    );
    appendTableColorThemeRule(
      rules,
      "theme-light",
      MARKPLUS_TABLE_HEADER_BACKGROUND_VAR,
      this.settings.tableHeaderBackgroundLight
    );
    appendTableColorThemeRule(
      rules,
      "theme-dark",
      MARKPLUS_TABLE_HEADER_BACKGROUND_VAR,
      this.settings.tableHeaderBackgroundDark
    );
    styleEl.textContent = rules.join("\n");
  }
};
function migrateLegacyTableColorSettings(data) {
  let changed = false;
  const stripe = typeof data.tableStripeRowBackground === "string" ? data.tableStripeRowBackground : "";
  const header = typeof data.tableHeaderBackground === "string" ? data.tableHeaderBackground : "";
  if (stripe) {
    if (!data.tableStripeRowBackgroundLight) {
      data.tableStripeRowBackgroundLight = stripe;
      changed = true;
    }
    if (!data.tableStripeRowBackgroundDark) {
      data.tableStripeRowBackgroundDark = stripe;
      changed = true;
    }
  }
  if (header) {
    if (!data.tableHeaderBackgroundLight) {
      data.tableHeaderBackgroundLight = header;
      changed = true;
    }
    if (!data.tableHeaderBackgroundDark) {
      data.tableHeaderBackgroundDark = header;
      changed = true;
    }
  }
  return changed;
}
function appendTableColorThemeRule(rules, themeClass, variableName, value) {
  const trimmed = String(value || "").trim();
  if (trimmed) {
    rules.push(`body.${themeClass} { ${variableName}: ${trimmed}; }`);
  }
}
