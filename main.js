var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === "object") || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toCommonJS = (mod) =>
  __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MarkPlusPlugin,
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
};
var FORMULA_PATTERN = /^=\s*(sum|avg|average|count|max|min)\s*(?:\(\s*\))?$/i;
var TABLE_SELECTOR =
  ".markdown-rendered table, .cm-preview-code-block table, .markdown-source-view.mod-cm6 .cm-table-widget table";
var MARKPLUS_DEBUG = true;
var HEADER_SIGNATURE_SEPARATOR = "";

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
      ...Array.from(record.removedNodes),
    ];
    const isOwnMutation = nodes.some((node) => {
      var _a, _b, _c, _d, _e;
      return (
        node.nodeType === 1 &&
        (((_a = node.classList) == null
          ? void 0
          : _a.contains("markplus-colgroup")) ||
          ((_b = node.classList) == null
            ? void 0
            : _b.contains("markplus-column-handle")) ||
          ((_c = node.classList) == null
            ? void 0
            : _c.contains("markplus-table-scale-handle")) ||
          ((_d = node.classList) == null
            ? void 0
            : _d.contains("markplus-cell-fill-handle")) ||
          ((_e = node.classList) == null
            ? void 0
            : _e.contains("markplus-formula-result")) ||
          node.tagName === "COL")
      );
    });
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
      target:
        (target == null ? void 0 : target.nodeType) === 1
          ? `${target.tagName}.${target.className || ""}`.trim()
          : target == null
            ? void 0
            : target.nodeName,
      added: record.addedNodes.length,
      removed: record.removedNodes.length,
    });
  }
  return {
    total: records.length,
    ownDecorationMutations,
    otherMutations,
    samples,
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
    containerEl
      .createEl("h2")
      .createEl("a", {
        text: "\u4F5C\u8005\uFF1ACYZice",
        href: "https://github.com/CYZice/obsidian-markplus",
      })
      .setAttr("target", "_blank");
    containerEl.createEl("h2", { text: "MarkPlus \u8BBE\u7F6E" });
    new import_obsidian.Setting(containerEl)
      .setName("\u4EFB\u52A1\u8BED\u6CD5\u81EA\u52A8\u8865\u5168")
      .setDesc(
        "\u8F93\u5165 `- [` \u6216 `-` \u540E\u7EE7\u7EED\u8F93\u5165\u65F6\uFF0C\u81EA\u52A8\u8865\u5168\u4EFB\u52A1\u5217\u8868\u8BED\u6CD5\u3002",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableTaskSyntaxCompletion)
          .onChange(async (value) => {
            this.plugin.settings.enableTaskSyntaxCompletion = value;
            await this.plugin.saveSettings();
          });
      });
    new import_obsidian.Setting(containerEl)
      .setName("\u8868\u683C\u516C\u5F0F")
      .setDesc(
        "\u5728\u8868\u683C\u6700\u540E\u4E00\u884C\u5355\u5143\u683C\u8F93\u5165 `=sum`\u3001`=avg`\u3001`=count`\u3001`=max`\u3001`=min` \u65F6\u81EA\u52A8\u8BA1\u7B97\u8BE5\u5217\u6570\u636E\u3002",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableTableFormulas)
          .onChange(async (value) => {
            var _a;
            this.plugin.settings.enableTableFormulas = value;
            await this.plugin.saveSettings();
            (_a = this.plugin.tableEnhancer) == null
              ? void 0
              : _a.scheduleRefresh("table-formula-toggle");
          });
      });
    new import_obsidian.Setting(containerEl)
      .setName("\u5355\u5143\u683C\u586B\u5145")
      .setDesc(
        "\u9009\u4E2D\u8868\u683C\u5355\u5143\u683C\u540E\uFF0C\u53EF\u62D6\u52A8\u53F3\u4E0B\u89D2\u586B\u5145\u624B\u67C4\u5411\u4E0A\u4E0B\u5DE6\u53F3\u590D\u5236\u5185\u5BB9\uFF1B\u6570\u5B57\u5355\u5143\u683C\u4F1A\u6309 +1 \u9012\u589E\u3002",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableTableCellFill)
          .onChange(async (value) => {
            var _a, _b;
            this.plugin.settings.enableTableCellFill = value;
            await this.plugin.saveSettings();
            (_a = this.plugin.tableEnhancer) == null
              ? void 0
              : _a.clearActiveFillCell();
            (_b = this.plugin.tableEnhancer) == null
              ? void 0
              : _b.scheduleRefresh("table-cell-fill-toggle");
          });
      });
    new import_obsidian.Setting(containerEl)
      .setName("\u8868\u683C\u6837\u5F0F")
      .setDesc(
        "\u4E3A Markdown \u8868\u683C\u9009\u62E9\u4E00\u79CD\u589E\u5F3A\u6837\u5F0F\u3002",
      )
      .addDropdown((dropdown) => {
        dropdown
          .addOption("default", "\u9ED8\u8BA4\u6837\u5F0F")
          .addOption("horizontal-lines", "\u6A2A\u7EBF\u6837\u5F0F")
          .addOption("striped-rows", "\u9694\u884C\u80CC\u666F")
          .addOption(
            "horizontal-lines-striped",
            "\u6A2A\u7EBF + \u9694\u884C\u80CC\u666F",
          )
          .setValue(
            this.plugin.settings.tableStyleVariant ||
              DEFAULT_SETTINGS.tableStyleVariant,
          )
          .onChange(async (value) => {
            var _a;
            this.plugin.settings.tableStyleVariant = value;
            await this.plugin.saveSettings();
            (_a = this.plugin.tableEnhancer) == null
              ? void 0
              : _a.scheduleRefresh("table-style-change");
          });
      });
  }
};

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
function findSeparatorLineForSpec(markdown, tableSpec) {
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
      dashCount: match[2].length,
    });
  }
  return { columns };
}
function getMarkdownLineIndexForTableRow(tableSpec, rowIndex) {
  return rowIndex === 0
    ? tableSpec.headerLineIndex
    : tableSpec.separatorLineIndex + rowIndex;
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
  return (
    (_b = splitMarkdownRow(tableSpec.bodyLines[bodyIndex])[colIndex]) != null
      ? _b
      : ""
  ).trim();
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
function buildSeparatorLineFromColumns(columns) {
  return `| ${columns
    .map((column) => {
      const current = column || {
        alignLeft: false,
        alignRight: false,
        dashCount: 3,
      };
      const dashes = "-".repeat(Math.max(3, current.dashCount || 3));
      return `${current.alignLeft ? ":" : ""}${dashes}${current.alignRight ? ":" : ""}`;
    })
    .join(" | ")} |`;
}
function reorderColumnsByHeader(previousSpec, currentSpec) {
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
    (index) => previousSpec.columns[index],
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
  const mappedIndexes = Array.from({ length: currHeaders.length }, () => null);
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
      if (
        mappedIndexes[index] !== null ||
        usedIndexes.has(index) ||
        index >= prevHeaders.length
      ) {
        return;
      }
      mappedIndexes[index] = index;
      usedIndexes.add(index);
    });
  }
  return {
    columns: currentColumns.map((column, index) => {
      const previousIndex = mappedIndexes[index];
      return (
        (previousIndex === null ? null : previousSpec.columns[previousIndex]) ||
        column
      );
    }),
    matchedCount: mappedIndexes.filter((index) => index !== null).length,
  };
}
function normalizeMatchText(value) {
  return String(value || "")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function domTableHeaderSignature(table) {
  const headerRow = table.rows && table.rows[0];
  return headerRow && headerRow.cells.length
    ? Array.from(headerRow.cells)
        .map((cell) => normalizeMatchText(cell.textContent))
        .join(HEADER_SIGNATURE_SEPARATOR)
    : null;
}
function specHeaderSignature(tableSpec) {
  return tableSpec &&
    Array.isArray(tableSpec.headerCells) &&
    tableSpec.headerCells.length
    ? tableSpec.headerCells
        .map((cell) => normalizeMatchText(cell))
        .join(HEADER_SIGNATURE_SEPARATOR)
    : null;
}
function isMarkdownTableRow(line) {
  return splitMarkdownRow(line).length > 0;
}
function areStringArraysEqual(a, b) {
  return (
    a === b ||
    (!(!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) &&
      a.every((value, index) => value === b[index]))
  );
}
function getLineAt(markdown, lineIndex) {
  return (
    (typeof markdown === "string" && lineIndex >= 0
      ? markdown.split(/\r?\n/)[lineIndex]
      : "") || ""
  );
}
function isLikelyTaskSyntaxInsertion(previousLine, currentLine) {
  return (
    typeof previousLine === "string" &&
    typeof currentLine === "string" &&
    currentLine.length === previousLine.length + 1 &&
    /^\s*-\s$/.test(previousLine) &&
    /^\s*-\s(?:\[)?$/.test(currentLine)
  );
}
function normalizeHeaderCell(value) {
  return String(value || "").trim();
}

// src/formulas.ts
function parseFormulaName(value) {
  const match = String(value != null ? value : "")
    .trim()
    .match(FORMULA_PATTERN);
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
  const normalized = String(value)
    .trim()
    .replace(/[,\s楼$鈧?*_`~]/g, "");
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
function formatFormulaResult(value) {
  return value !== null && Number.isFinite(value)
    ? String(Math.round(value * 1e6) / 1e6)
    : "-";
}
function isCellBeingEdited(cell) {
  const activeElement = document.activeElement;
  if (
    activeElement &&
    activeElement !== document.body &&
    cell.contains(activeElement)
  ) {
    return true;
  }
  const selection =
    typeof window.getSelection === "function" ? window.getSelection() : null;
  if (selection && selection.rangeCount > 0) {
    const { anchorNode, focusNode } = selection;
    if (
      (anchorNode && cell.contains(anchorNode)) ||
      (focusNode && cell.contains(focusNode))
    ) {
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
  if (
    (_a = tableSpec == null ? void 0 : tableSpec.bodyLines) == null
      ? void 0
      : _a.length
  ) {
    const lastBodyLine = tableSpec.bodyLines[tableSpec.bodyLines.length - 1];
    const parsedCells = splitMarkdownRow(lastBodyLine).map((cell) =>
      cell.trim(),
    );
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
    const result = formatFormulaResult(
      computeFormulaResult(formulaName, values),
    );
    let resultEl = cell.querySelector(":scope > .markplus-formula-result");
    if (
      resultEl &&
      resultEl.dataset.formula === formulaName &&
      resultEl.textContent === result
    ) {
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

// src/table-dom.ts
function getTableHeaderRow(table) {
  return table.querySelector("thead tr") || table.rows[0] || null;
}
function getCellCoords(table, cell) {
  const row = cell.parentElement;
  return {
    rowIndex: Array.from(table.rows).indexOf(row),
    colIndex: Array.from(row.cells).indexOf(cell),
  };
}
function getTableCellFromPoint(table, clientX, clientY) {
  if (typeof document.elementsFromPoint === "function") {
    for (const node of document.elementsFromPoint(clientX, clientY)) {
      if (node === table) {
        break;
      }
      if (
        (node.tagName === "TD" || node.tagName === "TH") &&
        table.contains(node)
      ) {
        return node;
      }
    }
  }
  return null;
}
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
function getFillCellValue(
  sourceText,
  sourceRow,
  sourceCol,
  targetRow,
  targetCol,
) {
  const numericValue = parseNumericValue(sourceText);
  if (numericValue === null) {
    return sourceText;
  }
  const rowDelta = targetRow - sourceRow;
  const colDelta = targetCol - sourceCol;
  return formatFillNumber(
    numericValue +
      (Math.abs(rowDelta) >= Math.abs(colDelta) ? rowDelta : colDelta),
    sourceText,
  );
}
function formatFillNumber(value, sourceText) {
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

// src/table-controller.ts
var TableColumnResizeController = class {
  constructor(plugin) {
    this.handleMap = /* @__PURE__ */ new WeakMap();
    this.scaleHandleMap = /* @__PURE__ */ new WeakMap();
    this.cellFillHandleMap = /* @__PURE__ */ new WeakMap();
    this.observerMap = /* @__PURE__ */ new WeakMap();
    this.fileTableSnapshots = /* @__PURE__ */ new Map();
    this.fileMarkdownSnapshots = /* @__PURE__ */ new Map();
    this.internalChangeBudget = /* @__PURE__ */ new Map();
    this.isComposing = false;
    this.dragState = null;
    this.fillState = null;
    this.fillDragState = null;
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
        capture: true,
      },
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
    const view = this.plugin.app.workspace.getActiveViewOfType(
      import_obsidian2.MarkdownView,
    );
    if (view == null ? void 0 : view.contentEl) {
      this.reapplyWidthsFromCache(view.contentEl);
    }
  }
  restoreSeparatorsAfterComposition() {
    const view = this.plugin.app.workspace.getActiveViewOfType(
      import_obsidian2.MarkdownView,
    );
    if ((view == null ? void 0 : view.editor) && view.file) {
      mpLog("restoreSeparatorsAfterComposition");
      this.handleEditorChange(view.editor, { file: view.file }).catch(
        (error) => {
          console.error("MarkPlus composition restore failed", error);
        },
      );
    }
  }
  async refreshAllTables() {
    if (this.isComposing) {
      mpLog("refreshAllTables:skip-composing");
      return;
    }
    mpLog("refreshAllTables:start");
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
      const markdown = await this.getMarkdownSource(view);
      const specs = extractMarkdownTableSpecs(markdown);
      this.fileTableSnapshots.set(file.path, specs);
      this.fileMarkdownSnapshots.set(file.path, markdown);
      const tables = view.contentEl.querySelectorAll(TABLE_SELECTOR);
      mpLog("refreshAllTables:tables", {
        file: file.path,
        tableCount: tables.length,
        specCount: specs.length,
      });
      const usedIndexes = /* @__PURE__ */ new Set();
      tables.forEach((table, index) => {
        const tableSpec = this.matchSpecForTable(
          table,
          specs,
          usedIndexes,
          index,
        );
        this.decorateTable(table, tableSpec, view, index);
      });
    }
  }
  reapplyWidthsFromCache(containerEl) {
    if (this.dragState || this.isComposing) {
      return;
    }
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (
        !(view instanceof import_obsidian2.MarkdownView) ||
        view.contentEl !== containerEl
      ) {
        continue;
      }
      const file = view.file;
      if (!file) {
        return;
      }
      const specs = this.fileTableSnapshots.get(file.path) || [];
      const tables = containerEl.querySelectorAll(TABLE_SELECTOR);
      mpLog("reapplyWidthsFromCache", {
        file: file.path,
        tableCount: tables.length,
        specCount: specs.length,
      });
      const usedIndexes = /* @__PURE__ */ new Set();
      tables.forEach((table, index) => {
        if (!(table instanceof HTMLTableElement)) {
          return;
        }
        const rowCount = Math.max(
          ...Array.from(table.rows).map((row) => row.cells.length),
          0,
        );
        if (rowCount < 1) {
          return;
        }
        const tableSpec = this.matchSpecForTable(
          table,
          specs,
          usedIndexes,
          index,
        );
        const widths = this.getWidthsForTable(table, tableSpec, rowCount);
        this.applyColumnWidthStyles(table, widths);
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
      mpLog("handleEditorChange:skip-composing");
      return;
    }
    const file =
      (context == null ? void 0 : context.file) ||
      ((_a = context == null ? void 0 : context.view) == null
        ? void 0
        : _a.file);
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
      mpLog("handleEditorChange:internal-change-consumed", { filePath });
      this.fileTableSnapshots.set(filePath, currentSpecs);
      this.scheduleRefresh("editor-change-internal");
      return;
    }
    const previousSpecs = this.fileTableSnapshots.get(filePath) || [];
    const restorations = [];
    for (const currentSpec of currentSpecs) {
      const previousSpec = previousSpecs.find(
        (item) => item.separatorLineIndex === currentSpec.separatorLineIndex,
      );
      if (!previousSpec) {
        continue;
      }
      const headerChanged =
        previousSpec.rawHeaderLine !== currentSpec.rawHeaderLine;
      const separatorChanged =
        previousSpec.rawSeparatorLine !== currentSpec.rawSeparatorLine;
      const sameColumnCount =
        previousSpec.columns.length === currentSpec.columns.length;
      const columnCountChanged =
        previousSpec.columns.length !== currentSpec.columns.length;
      const bodyChanged = !areStringArraysEqual(
        previousSpec.bodyLines,
        currentSpec.bodyLines,
      );
      const reorderedColumns = sameColumnCount
        ? reorderColumnsByHeader(previousSpec, currentSpec)
        : null;
      const transferredColumns = headerChanged
        ? transferColumnsToCurrentLayout(previousSpec, currentSpec)
        : null;
      if (headerChanged && reorderedColumns) {
        restorations.push({
          lineIndex: currentSpec.separatorLineIndex,
          line: buildSeparatorLineFromColumns(reorderedColumns),
        });
        continue;
      }
      if (
        headerChanged &&
        columnCountChanged &&
        ((transferredColumns == null
          ? void 0
          : transferredColumns.matchedCount) || 0) > 0
      ) {
        restorations.push({
          lineIndex: currentSpec.separatorLineIndex,
          line: buildSeparatorLineFromColumns(
            (transferredColumns == null
              ? void 0
              : transferredColumns.columns) || [],
          ),
        });
        continue;
      }
      if (
        separatorChanged &&
        sameColumnCount &&
        (headerChanged || bodyChanged)
      ) {
        restorations.push({
          lineIndex:
            (_b = findSeparatorLineForSpec(markdown, currentSpec)) != null
              ? _b
              : currentSpec.separatorLineIndex,
          line: previousSpec.rawSeparatorLine,
        });
      }
    }
    if (!restorations.length) {
      mpLog("handleEditorChange:no-restoration", { filePath });
      this.fileTableSnapshots.set(filePath, currentSpecs);
      this.scheduleRefresh("editor-change");
      return;
    }
    mpLog("handleEditorChange:restoring-separator", {
      filePath,
      restorations: restorations.map((item) => ({
        lineIndex: item.lineIndex,
        line: item.line,
      })),
    });
    this.markInternalChange(filePath);
    restorations
      .sort((a, b) => b.lineIndex - a.lineIndex)
      .forEach((restoration) => {
        const currentLine = editor.getLine(restoration.lineIndex);
        editor.replaceRange(
          restoration.line,
          { line: restoration.lineIndex, ch: 0 },
          { line: restoration.lineIndex, ch: currentLine.length },
        );
      });
    const nextMarkdown = editor.getValue();
    this.fileMarkdownSnapshots.set(filePath, nextMarkdown);
    this.fileTableSnapshots.set(
      filePath,
      extractMarkdownTableSpecs(nextMarkdown),
    );
    this.scheduleRefresh("editor-change-restoration");
  }
  tryCompleteTaskSyntax(editor, filePath, previousMarkdown) {
    if (
      !this.plugin.settings.enableTaskSyntaxCompletion ||
      typeof editor.getCursor !== "function" ||
      typeof editor.getLine !== "function" ||
      typeof editor.replaceRange !== "function"
    ) {
      return false;
    }
    const cursor = editor.getCursor();
    if (
      !cursor ||
      typeof cursor.line !== "number" ||
      typeof cursor.ch !== "number"
    ) {
      return false;
    }
    const currentLine = editor.getLine(cursor.line);
    if (typeof currentLine !== "string") {
      return false;
    }
    const beforeCursor = currentLine.slice(0, cursor.ch);
    const afterCursor = currentLine.slice(cursor.ch);
    const previousLine = getLineAt(previousMarkdown, cursor.line);
    if (
      !/^\s*-\s(?:\[)?$/.test(beforeCursor) ||
      afterCursor.length > 0 ||
      !isLikelyTaskSyntaxInsertion(previousLine, currentLine)
    ) {
      return false;
    }
    this.markInternalChange(filePath);
    if (beforeCursor.endsWith("[")) {
      editor.replaceRange(
        "[ ] ",
        { line: cursor.line, ch: cursor.ch - 1 },
        cursor,
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
    return view.editor && typeof view.editor.getValue === "function"
      ? view.editor.getValue()
      : this.plugin.app.vault.cachedRead(view.file);
  }
  matchSpecForTable(table, specs, usedIndexes, fallbackIndex) {
    if (
      !Array.isArray(specs) ||
      !specs.length ||
      !(table instanceof HTMLTableElement)
    ) {
      return null;
    }
    const domSignature = domTableHeaderSignature(table);
    if (domSignature) {
      for (let index = 0; index < specs.length; index += 1) {
        if (
          !usedIndexes.has(index) &&
          specHeaderSignature(specs[index]) === domSignature
        ) {
          usedIndexes.add(index);
          return specs[index];
        }
      }
    }
    if (
      fallbackIndex !== null &&
      fallbackIndex >= 0 &&
      fallbackIndex < specs.length &&
      !usedIndexes.has(fallbackIndex)
    ) {
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
      0,
    );
    if (columnCount < 1) {
      return;
    }
    table.className = table.className
      .split(/\s+/)
      .filter(
        (className) =>
          className && !className.startsWith("markplus-table-style-"),
      )
      .join(" ");
    table.classList.add("markplus-resizable-table");
    table.dataset.markplusTableIndex = String(tableIndex);
    const styleVariant =
      this.plugin.settings.tableStyleVariant ||
      DEFAULT_SETTINGS.tableStyleVariant;
    table.dataset.markplusStyle = styleVariant;
    table.classList.add(`markplus-table-style-${styleVariant}`);
    const colgroup = this.ensureColgroup(table, columnCount);
    const hadColgroup = colgroup.dataset.markplusInitialized === "true";
    colgroup.dataset.markplusInitialized = "true";
    const widths = this.getWidthsForTable(table, tableSpec, columnCount);
    mpLog("decorateTable", {
      tableIndex,
      columnCount,
      widths,
      hadColgroup,
      dashCounts: tableSpec
        ? tableSpec.columns.map((column) => column.dashCount)
        : null,
    });
    this.applyWidthsToColgroup(table, colgroup, widths);
    this.bindTableHoverTracking(table);
    this.syncHandleCount(table, columnCount, tableSpec, view);
    this.syncScaleHandle(table, tableSpec, view);
    this.bindTableCellFill(table);
    this.syncActiveFillCell(table, tableSpec, view);
    if (this.plugin.settings.enableTableFormulas) {
      applyTableFormulasToDom(table, tableSpec);
    }
  }
  getWidthsForTable(table, tableSpec, columnCount) {
    if (tableSpec && tableSpec.columns.length) {
      return Array.from({ length: columnCount }, (_, index) => {
        var _a, _b;
        const dashCount =
          (_b =
            (_a = tableSpec.columns[index]) == null ? void 0 : _a.dashCount) !=
          null
            ? _b
            : 3;
        return Math.max(
          this.plugin.settings.minColumnWidth,
          dashCount * this.plugin.settings.pixelsPerDash,
        );
      });
    }
    return this.readCurrentWidths(table, columnCount);
  }
  ensureColgroup(table, columnCount) {
    var _a;
    let colgroup = table.querySelector(":scope > colgroup.markplus-colgroup");
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
        mpLog("mutation-observer", summary);
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
          view,
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
    handle.style.left = "";
    handle.style.top = "";
    handle.style.right = "";
    handle.style.bottom = "";
  }
  getViewForTable(table) {
    var _a;
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (
        view instanceof import_obsidian2.MarkdownView &&
        ((_a = view.contentEl) == null ? void 0 : _a.contains(table))
      ) {
        return view;
      }
    }
    return null;
  }
  bindTableCellFill(table) {
    if (
      !this.plugin.settings.enableTableCellFill ||
      table.dataset.markplusFillBound === "true"
    ) {
      return;
    }
    table.dataset.markplusFillBound = "true";
    table.addEventListener(
      "pointerdown",
      (event) => {
        var _a, _b;
        if (
          !this.plugin.settings.enableTableCellFill ||
          this.fillDragState ||
          ((_a = event.target) == null
            ? void 0
            : _a.closest(
                ".markplus-cell-fill-handle, .markplus-column-handle, .markplus-table-scale-handle",
              ))
        ) {
          return;
        }
        const cell =
          (_b = event.target) == null ? void 0 : _b.closest("td, th");
        if (!cell || !table.contains(cell)) {
          return;
        }
        const view = this.getViewForTable(table);
        const tableSpec = this.resolveTableSpec(table, null, view);
        this.activateCellFill(table, cell, tableSpec, view);
      },
      true,
    );
  }
  onDocumentPointerDown(event) {
    var _a, _b;
    if (
      this.fillDragState ||
      ((_a = event.target) == null
        ? void 0
        : _a.closest(".markplus-cell-fill-handle")) ||
      ((_b = event.target) == null
        ? void 0
        : _b.closest(
            ".markplus-resizable-table td, .markplus-resizable-table th",
          ))
    ) {
      return;
    }
    this.clearActiveFillCell();
  }
  resolveTableSpec(table, fallbackSpec, view) {
    var _a;
    const filePath =
      (_a = view == null ? void 0 : view.file) == null ? void 0 : _a.path;
    if (
      (view == null ? void 0 : view.editor) &&
      typeof view.editor.getValue === "function"
    ) {
      return (
        this.matchSpecForTable(
          table,
          extractMarkdownTableSpecs(view.editor.getValue()),
          /* @__PURE__ */ new Set(),
          null,
        ) ||
        fallbackSpec ||
        null
      );
    }
    if (filePath) {
      const cachedSpecs = this.fileTableSnapshots.get(filePath);
      if (cachedSpecs == null ? void 0 : cachedSpecs.length) {
        return (
          this.matchSpecForTable(
            table,
            cachedSpecs,
            /* @__PURE__ */ new Set(),
            null,
          ) ||
          fallbackSpec ||
          null
        );
      }
    }
    return fallbackSpec || null;
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
      handle.addEventListener("pointerdown", (event) => {
        this.startFillDrag(event, table);
      });
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
      sourceCol: colIndex,
    };
  }
  syncActiveFillCell(table, tableSpec, view) {
    var _a;
    if (
      !this.fillState ||
      this.fillState.table !== table ||
      this.fillDragState
    ) {
      return;
    }
    const { sourceRow, sourceCol, handle } = this.fillState;
    const sourceCell =
      (_a = table.rows[sourceRow]) == null ? void 0 : _a.cells[sourceCol];
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
      resolvedView,
    );
    this.fillState.sourceRow = sourceRow;
    this.fillState.sourceCol = sourceCol;
    if (!sourceCell.contains(handle)) {
      sourceCell.appendChild(handle);
    }
  }
  clearActiveFillCell() {
    var _a, _b;
    (_b = (_a = this.fillState) == null ? void 0 : _a.handle) == null
      ? void 0
      : _b.remove();
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
    const cell =
      (_a = table.rows[sourceRow]) == null ? void 0 : _a.cells[sourceCol];
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
      pointerId: event.pointerId,
      fillHandle: handle,
      targets: [],
    };
    table.classList.add("markplus-is-filling");
    document.body.classList.add("markplus-fill-cursor");
    if (handle && "setPointerCapture" in handle) {
      try {
        handle.setPointerCapture(event.pointerId);
      } catch (_error) {}
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
      event.clientY,
    );
    this.clearFillHighlights(table);
    if (!targetCell) {
      this.fillDragState.targets = [];
      return;
    }
    const targets = computeFillTargets(
      { rowIndex: sourceRow, colIndex: sourceCol },
      getCellCoords(table, targetCell),
    );
    this.highlightFillTargets(table, targets);
    this.fillDragState.targets = targets;
  }
  async onFillPointerUp(event) {
    if (!this.fillDragState) {
      return;
    }
    const { table, view, sourceRow, sourceCol, targets } = this.fillDragState;
    const tableSpec = this.resolveTableSpec(
      table,
      this.fillDragState.tableSpec,
      view,
    );
    const sourceText = tableSpec
      ? getCellSourceText(tableSpec, sourceRow, sourceCol)
      : null;
    const targetCell = getTableCellFromPoint(
      table,
      event.clientX,
      event.clientY,
    );
    let resolvedTargets = targets;
    if (targetCell) {
      const targetCoords = getCellCoords(table, targetCell);
      resolvedTargets = computeFillTargets(
        { rowIndex: sourceRow, colIndex: sourceCol },
        targetCoords,
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
      );
      this.stopFillDragging();
      this.scheduleRefresh("cell-fill");
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
          if (
            (_a = el.hasPointerCapture) == null
              ? void 0
              : _a.call(el, pointerId)
          ) {
            el.releasePointerCapture(pointerId);
          }
        } catch (_error) {}
      }
    }
    this.fillDragState = null;
    document.body.classList.remove("markplus-fill-cursor");
    window.removeEventListener("pointermove", this.boundFillPointerMove);
    window.removeEventListener("pointerup", this.boundFillPointerUp);
    window.removeEventListener("pointercancel", this.boundFillPointerCancel);
  }
  highlightFillTargets(table, targets) {
    var _a;
    for (const { rowIndex, colIndex } of targets) {
      const cell =
        (_a = table.rows[rowIndex]) == null ? void 0 : _a.cells[colIndex];
      cell == null ? void 0 : cell.classList.add("markplus-cell-fill-target");
    }
  }
  clearFillHighlights(table) {
    table.querySelectorAll(".markplus-cell-fill-target").forEach((cell) => {
      cell.classList.remove("markplus-cell-fill-target");
    });
  }
  async applyCellFill(
    view,
    tableSpec,
    sourceRow,
    sourceCol,
    sourceText,
    targets,
  ) {
    const editor = view == null ? void 0 : view.editor;
    if (
      !(view == null ? void 0 : view.file) ||
      !tableSpec ||
      !Array.isArray(targets) ||
      !targets.length
    ) {
      return;
    }
    if (editor) {
      const updates = /* @__PURE__ */ new Map();
      for (const { rowIndex, colIndex } of targets) {
        if (rowIndex === sourceRow && colIndex === sourceCol) {
          continue;
        }
        const markdownLineIndex = getMarkdownLineIndexForTableRow(
          tableSpec,
          rowIndex,
        );
        const currentLine = updates.has(markdownLineIndex)
          ? updates.get(markdownLineIndex)
          : editor.getLine(markdownLineIndex);
        const nextValue = getFillCellValue(
          sourceText,
          sourceRow,
          sourceCol,
          rowIndex,
          colIndex,
        );
        updates.set(
          markdownLineIndex,
          replaceCellInMarkdownRow(currentLine, colIndex, nextValue),
        );
      }
      if (!updates.size) {
        return;
      }
      this.markInternalChange(view.file.path);
      this.preserveEditorScroll(view, () => {
        [...updates.entries()]
          .sort((a, b) => b[0] - a[0])
          .forEach(([lineIndex, value]) => {
            const line = editor.getLine(lineIndex);
            editor.replaceRange(
              value,
              { line: lineIndex, ch: 0 },
              { line: lineIndex, ch: line.length },
            );
          });
      });
      const markdown2 = editor.getValue();
      this.fileMarkdownSnapshots.set(view.file.path, markdown2);
      this.fileTableSnapshots.set(
        view.file.path,
        extractMarkdownTableSpecs(markdown2),
      );
      return;
    }
    const markdown =
      this.fileMarkdownSnapshots.get(view.file.path) ||
      (await this.plugin.app.vault.cachedRead(view.file));
    const lines = markdown.split(/\r?\n/);
    let hasChanges = false;
    for (const { rowIndex, colIndex } of targets) {
      if (rowIndex === sourceRow && colIndex === sourceCol) {
        continue;
      }
      const markdownLineIndex = getMarkdownLineIndexForTableRow(
        tableSpec,
        rowIndex,
      );
      const currentLine = lines[markdownLineIndex];
      if (typeof currentLine !== "string") {
        continue;
      }
      const nextValue = getFillCellValue(
        sourceText,
        sourceRow,
        sourceCol,
        rowIndex,
        colIndex,
      );
      const nextLine = replaceCellInMarkdownRow(
        currentLine,
        colIndex,
        nextValue,
      );
      if (nextLine !== currentLine) {
        lines[markdownLineIndex] = nextLine;
        hasChanges = true;
      }
    }
    if (!hasChanges) {
      return;
    }
    const nextMarkdown = lines.join("\n");
    await this.plugin.app.vault.modify(view.file, nextMarkdown);
    this.fileMarkdownSnapshots.set(view.file.path, nextMarkdown);
    this.fileTableSnapshots.set(
      view.file.path,
      extractMarkdownTableSpecs(nextMarkdown),
    );
  }
  positionHandles(table) {
    var _a, _b;
    const handles = this.handleMap.get(table) || [];
    const widths = this.readCurrentWidths(table, handles.length);
    const headerRow = getTableHeaderRow(table);
    const top =
      (_a = headerRow == null ? void 0 : headerRow.offsetTop) != null ? _a : 0;
    const height =
      (_b = headerRow == null ? void 0 : headerRow.offsetHeight) != null
        ? _b
        : 0;
    let offset = 0;
    table.classList.toggle(
      "markplus-has-active-handle",
      handles.some((handle) => handle.classList.contains("is-active")),
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
        return;
      }
      handle.style.display = "none";
    });
    const scaleHandle = this.scaleHandleMap.get(table);
    if (scaleHandle) {
      scaleHandle.style.left = "";
      scaleHandle.style.top = "";
      scaleHandle.style.right = "";
      scaleHandle.style.bottom = "";
    }
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
      minWidth:
        this.plugin.settings.minColumnWidth || DEFAULT_SETTINGS.minColumnWidth,
    };
    table.classList.add("markplus-is-resizing");
    (this.handleMap.get(table) || []).forEach((item, index) => {
      item.classList.toggle("is-active", index === handleIndex);
    });
    table.classList.add("markplus-has-active-handle");
    if (typeof handle.setPointerCapture === "function") {
      try {
        handle.setPointerCapture(event.pointerId);
      } catch (_error) {}
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
      minWidth:
        this.plugin.settings.minColumnWidth || DEFAULT_SETTINGS.minColumnWidth,
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
    const { mode, handleIndex, startX, widths, minWidth, startWidth } =
      this.dragState;
    const deltaX = event.clientX - startX;
    const nextWidths = widths.slice();
    if (mode === "scale") {
      const scale =
        Math.max(
          minWidth * widths.length,
          Math.round((startWidth || 0) + deltaX),
        ) / (startWidth || 1);
      for (let index = 0; index < widths.length; index += 1) {
        nextWidths[index] = Math.max(
          minWidth,
          Math.round(widths[index] * scale),
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
        Math.round(widths[handleIndex] + deltaX),
      );
      return nextWidths;
    }
    const pairWidth = widths[handleIndex] + widths[handleIndex + 1];
    const clamped = Math.min(
      pairWidth - minWidth,
      Math.max(minWidth, widths[handleIndex] + deltaX),
    );
    nextWidths[handleIndex] = Math.round(clamped);
    nextWidths[handleIndex + 1] = Math.round(pairWidth - clamped);
    return nextWidths;
  }
  async onPointerUp(event) {
    if (!this.dragState) {
      return;
    }
    const widths =
      this.computeDragWidths(event) ||
      this.readCurrentWidths(this.dragState.table);
    const { table, tableSpec, view } = this.dragState;
    const colgroup = this.ensureColgroup(table, widths.length);
    this.applyWidthsToColgroup(table, colgroup, widths);
    this.positionHandles(table);
    const resolvedWidths = this.readCurrentWidths(table);
    let resolvedSpec = tableSpec;
    if (
      (view == null ? void 0 : view.editor) &&
      typeof view.editor.getValue === "function"
    ) {
      const matchedSpec = this.matchSpecForTable(
        table,
        extractMarkdownTableSpecs(view.editor.getValue()),
        /* @__PURE__ */ new Set(),
        null,
      );
      if (matchedSpec) {
        resolvedSpec = matchedSpec;
      }
    }
    await this.writeWidthsBackToMarkdown(resolvedWidths, resolvedSpec, view);
    this.stopDragging();
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
          if (
            (_b = handle.hasPointerCapture) == null
              ? void 0
              : _b.call(handle, this.dragState.pointerId)
          ) {
            handle.releasePointerCapture(this.dragState.pointerId);
          }
        } catch (_error) {}
      }
    }
    this.dragState = null;
    document.body.classList.remove("markplus-resize-cursor");
    document.body.classList.remove("markplus-resize-cursor-diagonal");
    window.removeEventListener("pointermove", this.boundPointerMove);
    window.removeEventListener("pointerup", this.boundPointerUp);
    window.removeEventListener("pointercancel", this.boundPointerCancel);
  }
  markInternalChange(filePath) {
    const budget = (this.internalChangeBudget.get(filePath) || 0) + 1;
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
    const colgroup = table.querySelector(":scope > colgroup.markplus-colgroup");
    if (colgroup && colgroup.children.length) {
      const widths = Array.from(colgroup.children).map((col) => {
        const width = parseFloat(col.style.width);
        return Number.isFinite(width) && width > 0
          ? Math.round(width)
          : Math.round(col.getBoundingClientRect().width);
      });
      if (widths.length) {
        return widths;
      }
    }
    const firstRow = table.rows[0];
    if (firstRow) {
      return Array.from(firstRow.cells).map((cell) =>
        Math.round(cell.getBoundingClientRect().width),
      );
    }
    return fallbackCount
      ? Array.from(
          { length: fallbackCount },
          () => this.plugin.settings.minColumnWidth,
        )
      : [];
  }
  applyWidthsToColgroup(table, colgroup, widths) {
    const resolvedWidths =
      widths && widths.length ? widths : this.readCurrentWidths(table);
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
    const scroller =
      (_a = view == null ? void 0 : view.contentEl) == null
        ? void 0
        : _a.querySelector(".cm-scroller");
    const scrollTop =
      (_b = scroller == null ? void 0 : scroller.scrollTop) != null ? _b : null;
    const scrollLeft =
      (_c = scroller == null ? void 0 : scroller.scrollLeft) != null
        ? _c
        : null;
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
  async writeWidthsBackToMarkdown(widths, tableSpec, view) {
    if (!tableSpec || !(view == null ? void 0 : view.file)) {
      return;
    }
    const separatorLine = buildSeparatorLine(
      tableSpec,
      widths.map((width) =>
        Math.max(3, Math.round(width / this.plugin.settings.pixelsPerDash)),
      ),
    );
    const markdown =
      view.editor && typeof view.editor.getValue === "function"
        ? view.editor.getValue()
        : await this.plugin.app.vault.cachedRead(view.file);
    const separatorLineIndex = findSeparatorLineForSpec(markdown, tableSpec);
    if (separatorLineIndex == null) {
      mpLog("writeWidthsBackToMarkdown:separator-not-found");
      return;
    }
    const lines = markdown.split(/\r?\n/);
    if (!parseSeparatorLine(lines[separatorLineIndex])) {
      mpLog("writeWidthsBackToMarkdown:line-not-separator", {
        lineIndex: separatorLineIndex,
        line: lines[separatorLineIndex],
      });
      return;
    }
    if (
      view.editor &&
      typeof view.editor.replaceRange === "function" &&
      typeof view.editor.getLine === "function"
    ) {
      const currentLine = view.editor.getLine(separatorLineIndex);
      if (!parseSeparatorLine(currentLine)) {
        return;
      }
      this.markInternalChange(view.file.path);
      this.preserveEditorScroll(view, () => {
        var _a;
        (_a = view.editor) == null
          ? void 0
          : _a.replaceRange(
              separatorLine,
              { line: separatorLineIndex, ch: 0 },
              { line: separatorLineIndex, ch: currentLine.length },
            );
      });
      const nextMarkdown2 = view.editor.getValue();
      this.fileMarkdownSnapshots.set(view.file.path, nextMarkdown2);
      this.fileTableSnapshots.set(
        view.file.path,
        extractMarkdownTableSpecs(nextMarkdown2),
      );
      return;
    }
    lines[separatorLineIndex] = separatorLine;
    const nextMarkdown = lines.join("\n");
    await this.plugin.app.vault.modify(view.file, nextMarkdown);
    this.fileMarkdownSnapshots.set(view.file.path, nextMarkdown);
    this.fileTableSnapshots.set(
      view.file.path,
      extractMarkdownTableSpecs(nextMarkdown),
    );
  }
};

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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.tableEnhancer = new TableColumnResizeController(this);
    this.addSettingTab(new MarkPlusSettingTab(this.app, this));
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        var _a;
        (_a = this.tableEnhancer) == null
          ? void 0
          : _a.scheduleRefresh("layout-change");
      }),
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        var _a;
        (_a = this.tableEnhancer) == null
          ? void 0
          : _a.scheduleRefresh("active-leaf-change");
      }),
    );
    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        var _a;
        (_a = this.tableEnhancer) == null
          ? void 0
          : _a.scheduleRefresh("file-open");
      }),
    );
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, context) => {
        var _a;
        (_a = this.tableEnhancer) == null
          ? void 0
          : _a.handleEditorChange(editor, context).catch(() => {});
      }),
    );
    this.registerDomEvent(window, "resize", () => {
      var _a;
      (_a = this.tableEnhancer) == null
        ? void 0
        : _a.scheduleRefresh("window-resize");
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
      { capture: true },
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
      { capture: true },
    );
    this.register(() => {
      var _a;
      (_a = this.tableEnhancer) == null ? void 0 : _a.destroy();
    });
    this.tableEnhancer.scheduleRefresh("onload");
  }
  onunload() {
    var _a;
    this._pluginInitialized = false;
    (_a = this.tableEnhancer) == null ? void 0 : _a.destroy();
    this.tableEnhancer = null;
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
