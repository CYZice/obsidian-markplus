import { MarkdownView, Menu, Notice, setIcon, type TFile } from "obsidian";
import {
  DEFAULT_SETTINGS,
  MARKPLUS_COLUMN_ALIGNMENT_CLASSES,
  MARKPLUS_TABLE_ALIGNMENT_CLASSES,
  PREVIEW_TABLE_SELECTOR,
  TABLE_ALIGNMENT_OPTIONS,
  TABLE_SELECTOR,
  TABLE_STYLE_OPTIONS,
} from "./constants";
import { mpLog, summarizeMutations } from "./debug";
import { applyTableFormulasToDom } from "./formulas";
import {
  applyAlignmentToColumns,
  areStringArraysEqual,
  buildSeparatorLine,
  buildSeparatorLineFromColumns,
  domTableBodySignature,
  domTableContentSignature,
  domTableHeaderSignature,
  extractMarkdownTableSpecs,
  findSeparatorLineForSpec,
  getCellSourceText,
  getLineAt,
  getMarkdownLineIndexForTableRow,
  getTableAlignmentFromColumns,
  getTableMarkdownForCopy,
  getTableMatchIndex,
  getTableSourceLineForDomTable,
  getColumnAlignmentKind,
  isLikelyTaskSyntaxInsertion,
  matchSpecIndexesByBodySignature,
  parseSeparatorLine,
  reorderColumnsByHeader,
  replaceCellInMarkdownRow,
  specBodySignature,
  specContentSignature,
  specHeaderSignature,
  transferColumnsToCurrentLayout,
} from "./markdown-table";
import { computeFillTargets, getFillCellValue } from "./cell-fill";
import {
  getCellCoords,
  getTableCellFromPoint,
  getTableHeaderRow,
  type TableCellCoords,
} from "./table-dom";
import type {
  EditorChangeContext,
  EditorLike,
  MarkPlusSettings,
  MarkdownTableColumn,
  MarkdownTableSpec,
  MarkdownViewLike,
  TableAlignment,
  TableStyleVariant,
} from "./types";

interface ResizeDragState {
  mode: "column" | "scale";
  table: HTMLTableElement;
  tableSpec: MarkdownTableSpec | null;
  view: MarkdownViewLike | null;
  minWidth: number;
  startX: number;
  widths: number[];
  startWidth?: number;
  handle?: HTMLDivElement;
  handleIndex?: number;
  pointerId?: number;
}

interface FillState {
  table: HTMLTableElement;
  cell: HTMLTableCellElement;
  tableSpec: MarkdownTableSpec | null;
  view: MarkdownViewLike | null;
  handle: HTMLDivElement;
  sourceRow: number;
  sourceCol: number;
}

interface FillDragState {
  table: HTMLTableElement;
  tableSpec: MarkdownTableSpec;
  view: MarkdownViewLike;
  sourceRow: number;
  sourceCol: number;
  sourceText: string;
  disableIncrementFill: boolean;
  pointerId: number;
  fillHandle: EventTarget | null;
  targets: TableCellCoords[];
}

type MarkPlusPluginLike = {
  app: {
    workspace: {
      getLeavesOfType(type: string): Array<{ view: unknown }>;
      getActiveViewOfType(type: typeof MarkdownView): MarkdownViewLike | null;
    };
    vault: {
      cachedRead(file: TFile): Promise<string>;
      modify(file: TFile, content: string): Promise<void>;
    };
  };
  settings: MarkPlusSettings;
  saveSettings(): Promise<void>;
  registerDomEvent(
    el: Document | HTMLElement | Window,
    type: string,
    callback: (evt: Event) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
};

export class TableColumnResizeController {
  plugin: MarkPlusPluginLike;
  handleMap = new WeakMap<HTMLTableElement, HTMLDivElement[]>();
  scaleHandleMap = new WeakMap<HTMLTableElement, HTMLDivElement>();
  menuButtonMap = new WeakMap<HTMLTableElement, HTMLButtonElement>();
  cellFillHandleMap = new WeakMap<HTMLTableElement, HTMLDivElement>();
  observerMap = new WeakMap<HTMLElement, MutationObserver>();
  fileTableSnapshots = new Map<string, MarkdownTableSpec[]>();
  fileMarkdownSnapshots = new Map<string, string>();
  internalChangeBudget = new Map<string, number>();
  isComposing = false;
  dragState: ResizeDragState | null = null;
  fillState: FillState | null = null;
  fillDragState: FillDragState | null = null;
  pendingRefreshReason: string | null = null;
  refreshTimer: number | null = null;
  boundPointerMove: (evt: PointerEvent) => void;
  boundPointerUp: (evt: PointerEvent) => Promise<void>;
  boundPointerCancel: () => void;
  boundFillPointerMove: (evt: PointerEvent) => void;
  boundFillPointerUp: (evt: PointerEvent) => Promise<void>;
  boundFillPointerCancel: () => void;
  boundDocumentPointerDown: (evt: PointerEvent) => void;

  constructor(plugin: MarkPlusPluginLike) {
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

  destroy(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }
    this.disconnectObservers();
    this.stopDragging();
    this.stopFillDragging();
    this.clearActiveFillCell();
  }

  scheduleRefresh(reason?: string): void {
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

  reapplyWidthsActiveView(): void {
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.contentEl) {
      this.reapplyWidthsFromCache(view.contentEl);
    }
  }

  restoreSeparatorsAfterComposition(): void {
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.editor && view.file) {
      this.handleEditorChange(view.editor, { file: view.file }).catch(
        (error) => {
          console.error("MarkPlus composition restore failed", error);
        },
      );
    }
  }

  async refreshAllTables(): Promise<void> {
    if (this.isComposing || this.fillDragState) {
      return;
    }

    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) {
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
      const usedIndexes = new Set<number>();
      const canUseFallbackIndex = tables.length === specs.length;
      tables.forEach((table, index) => {
        const tableSpec = this.matchSpecForTable(
          table,
          specs,
          usedIndexes,
          canUseFallbackIndex ? index : null,
          view,
        );
        this.decorateTable(table, tableSpec, view, index);
      });

      this.applyReadingPresentationForPreview(view.previewMode, "refresh");
    }
  }

  queryTablesForView(view: MarkdownViewLike): HTMLTableElement[] {
    if (typeof view.getMode === "function" && view.getMode() === "preview") {
      const containerEl = view.previewMode?.containerEl;
      return containerEl
        ? Array.from(
            containerEl.querySelectorAll(PREVIEW_TABLE_SELECTOR),
          ).filter(
            (node): node is HTMLTableElement =>
              node instanceof HTMLTableElement,
          )
        : [];
    }

    return Array.from(view.contentEl.querySelectorAll(TABLE_SELECTOR)).filter(
      (node): node is HTMLTableElement =>
        node instanceof HTMLTableElement && !isReadingModeTable(node),
    );
  }

  reapplyWidthsFromCache(containerEl: HTMLElement): void {
    if (this.dragState || this.isComposing) {
      return;
    }

    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || view.contentEl !== containerEl) {
        continue;
      }

      const file = view.file;
      if (!file) {
        return;
      }

      const specs = this.fileTableSnapshots.get(file.path) || [];
      const tables = containerEl.querySelectorAll(TABLE_SELECTOR);
      const usedIndexes = new Set<number>();
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
          view,
        );
        const widths = this.getWidthsForTable(table, tableSpec, rowCount);
        this.applyColumnWidthStyles(table, widths);
        this.positionHandles(table);
      });
      return;
    }
  }

  async handleEditorChange(
    editor: EditorLike | null | undefined,
    context?: EditorChangeContext,
  ): Promise<void> {
    if (!editor || typeof editor.getValue !== "function") {
      return;
    }

    if (this.isComposing) {
      return;
    }

    const file = context?.file || context?.view?.file;
    if (!file?.path) {
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
    const restorations: Array<{ lineIndex: number; line: string }> = [];

    for (const currentSpec of currentSpecs) {
      const previousSpec =
        previousSpecs.find(
          (item) => item.separatorLineIndex === currentSpec.separatorLineIndex,
        ) ||
        previousSpecs.find(
          (item) => item.tableOrdinal === currentSpec.tableOrdinal,
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
        (transferredColumns?.matchedCount || 0) > 0
      ) {
        restorations.push({
          lineIndex: currentSpec.separatorLineIndex,
          line: buildSeparatorLineFromColumns(
            transferredColumns?.columns || [],
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
            findSeparatorLineForSpec(markdown, currentSpec) ??
            currentSpec.separatorLineIndex,
          line: previousSpec.rawSeparatorLine,
        });
      }
    }

    if (!restorations.length) {
      this.fileTableSnapshots.set(filePath, currentSpecs);
      this.scheduleRefresh("editor-change");
      return;
    }

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
    if (context?.view instanceof MarkdownView) {
      await this.syncPreviewAfterMarkdownChange(context.view);
    }
  }

  tryCompleteTaskSyntax(
    editor: EditorLike,
    filePath: string,
    previousMarkdown: string,
  ): boolean {
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

  async getMarkdownSource(view: MarkdownViewLike): Promise<string> {
    return view.editor && typeof view.editor.getValue === "function"
      ? view.editor.getValue()
      : this.plugin.app.vault.cachedRead(view.file as TFile);
  }

  matchSpecForTable(
    table: Element,
    specs: MarkdownTableSpec[],
    usedIndexes: Set<number>,
    fallbackIndex: number | null,
    view: MarkdownViewLike | null = null,
  ): MarkdownTableSpec | null {
    if (
      !Array.isArray(specs) ||
      !specs.length ||
      !(table instanceof HTMLTableElement)
    ) {
      return null;
    }

    const ordinalIndex = getTableMatchIndex(table, fallbackIndex);
    if (
      ordinalIndex !== null &&
      ordinalIndex >= 0 &&
      ordinalIndex < specs.length &&
      !usedIndexes.has(ordinalIndex)
    ) {
      usedIndexes.add(ordinalIndex);
      return specs[ordinalIndex];
    }

    const sourceLine = getTableSourceLineForDomTable(view, table);
    if (sourceLine !== null) {
      const rangedMatches = specs
        .map((spec, index) => ({ spec, index }))
        .filter(
          ({ spec, index }) =>
            !usedIndexes.has(index) &&
            sourceLine >= spec.headerLineIndex &&
            sourceLine <= spec.separatorLineIndex + spec.bodyLines.length,
        );
      if (rangedMatches.length === 1) {
        usedIndexes.add(rangedMatches[0].index);
        return rangedMatches[0].spec;
      }
      if (rangedMatches.length > 1) {
        const columnCount = getDomTableColumnCount(table);
        let candidates = rangedMatches;
        if (columnCount > 0) {
          const exact = rangedMatches.filter(
            ({ spec }) => spec.headerCells.length === columnCount,
          );
          if (exact.length === 1) {
            usedIndexes.add(exact[0].index);
            return exact[0].spec;
          }
          if (exact.length) {
            candidates = exact;
          }
        }
        const bodySignature = domTableBodySignature(table);
        if (bodySignature) {
          const bodyMatches = candidates.filter(
            ({ spec }) => specBodySignature(spec) === bodySignature,
          );
          if (bodyMatches.length === 1) {
            usedIndexes.add(bodyMatches[0].index);
            return bodyMatches[0].spec;
          }
        }
        candidates.sort(
          (a, b) =>
            Math.abs(sourceLine - a.spec.headerLineIndex) -
            Math.abs(sourceLine - b.spec.headerLineIndex),
        );
        usedIndexes.add(candidates[0].index);
        return candidates[0].spec;
      }
    }

    const bodySignature = domTableBodySignature(table);
    const bodyMatches = matchSpecIndexesByBodySignature(
      bodySignature,
      specs,
      usedIndexes,
    );
    if (bodyMatches.length === 1) {
      usedIndexes.add(bodyMatches[0]);
      return specs[bodyMatches[0]];
    }

    const separatorLine = Number.parseInt(
      table.dataset.markplusSeparatorLine ?? "",
      10,
    );
    if (Number.isInteger(separatorLine) && separatorLine >= 0) {
      const matchedIndex = specs.findIndex(
        (spec, index) =>
          !usedIndexes.has(index) && spec.separatorLineIndex === separatorLine,
      );
      if (matchedIndex >= 0) {
        usedIndexes.add(matchedIndex);
        return specs[matchedIndex];
      }
    }

    const columnCount = getDomTableColumnCount(table);
    const contentSignature = domTableContentSignature(table);
    if (contentSignature) {
      let contentMatches = specs
        .map((spec, index) => ({ spec, index }))
        .filter(
          ({ spec, index }) =>
            !usedIndexes.has(index) &&
            specContentSignature(spec) === contentSignature,
        );
      if (columnCount > 0 && contentMatches.length > 1) {
        const exact = contentMatches.filter(
          ({ spec }) => spec.headerCells.length === columnCount,
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
      let headerMatches = specs
        .map((spec, index) => ({ spec, index }))
        .filter(
          ({ spec, index }) =>
            !usedIndexes.has(index) &&
            specHeaderSignature(spec) === headerSignature,
        );
      if (columnCount > 0 && headerMatches.length > 1) {
        const exact = headerMatches.filter(
          ({ spec }) => spec.headerCells.length === columnCount,
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
          ({ spec }) => specContentSignature(spec) === contentSignature,
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

  decorateTable(
    table: Element,
    tableSpec: MarkdownTableSpec | null,
    view: MarkdownViewLike,
    tableIndex: number,
  ): void {
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

  applyTableStyleClasses(table: HTMLTableElement): void {
    const styleVariant =
      this.plugin.settings.tableStyleVariant ||
      DEFAULT_SETTINGS.tableStyleVariant;
    table.dataset.markplusStyle = styleVariant;
    table.className = table.className
      .split(/\s+/)
      .filter(
        (className) =>
          className && !className.startsWith("markplus-table-style-"),
      )
      .join(" ");
    table.classList.add(`markplus-table-style-${styleVariant}`);
  }

  getWidthsForTable(
    table: HTMLTableElement,
    tableSpec: MarkdownTableSpec | null,
    columnCount: number,
  ): number[] {
    if (tableSpec && tableSpec.columns.length) {
      return Array.from({ length: columnCount }, (_, index) => {
        const dashCount = tableSpec.columns[index]?.dashCount ?? 3;
        return Math.max(
          this.plugin.settings.minColumnWidth,
          dashCount * this.plugin.settings.pixelsPerDash,
        );
      });
    }

    return this.readCurrentWidths(table, columnCount);
  }

  ensureColgroup(
    table: HTMLTableElement,
    columnCount: number,
  ): HTMLTableColElement {
    let colgroup = table.querySelector(
      ":scope > colgroup.markplus-colgroup",
    ) as HTMLTableColElement | null;
    if (!colgroup) {
      colgroup = document.createElement("colgroup") as HTMLTableColElement;
      colgroup.className = "markplus-colgroup";
      table.insertBefore(colgroup, table.firstChild);
    }

    while (colgroup.children.length < columnCount) {
      colgroup.appendChild(document.createElement("col"));
    }
    while (colgroup.children.length > columnCount) {
      colgroup.lastElementChild?.remove();
    }

    return colgroup;
  }

  ensureObserver(containerEl: HTMLElement): void {
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

  disconnectObservers(): void {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view as MarkdownViewLike | null | undefined;
      const contentEl = view?.contentEl;
      const observer = contentEl ? this.observerMap.get(contentEl) : null;
      observer?.disconnect();
    }
  }

  syncHandleCount(
    table: HTMLTableElement,
    count: number,
    tableSpec: MarkdownTableSpec | null,
    view: MarkdownViewLike,
  ): void {
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
      handles.pop()?.remove();
    }

    this.handleMap.set(table, handles);
    this.positionHandles(table);
  }

  bindTableHoverTracking(table: HTMLTableElement): void {
    const headerRow = getTableHeaderRow(table);
    if (!headerRow || table.dataset.markplusHoverBound === "true") {
      return;
    }

    table.dataset.markplusHoverBound = "true";
    headerRow.addEventListener("mousemove", (event) => {
      if (this.dragState?.table !== table) {
        this.updateActiveHandleForPointer(table, event.clientX);
      }
    });
    headerRow.addEventListener("mouseleave", () => {
      if (this.dragState?.table !== table) {
        this.clearActiveHandles(table);
      }
    });
  }

  syncScaleHandle(
    table: HTMLTableElement,
    tableSpec: MarkdownTableSpec | null,
    view: MarkdownViewLike,
  ): void {
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

  syncMenuButton(
    table: HTMLTableElement,
    tableSpec: MarkdownTableSpec | null,
    view: MarkdownViewLike | null,
  ): void {
    let button = this.menuButtonMap.get(table);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "markplus-table-menu-button clickable-icon";
      button.setAttribute("aria-label", "表格菜单");
      setIcon(button, "settings-2");
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

  positionMenuButton(
    table: HTMLTableElement,
    button: HTMLButtonElement | null = null,
  ): void {
    const current = button || this.menuButtonMap.get(table);
    if (!current) {
      return;
    }

    const top = getTableHeaderRow(table)?.offsetTop ?? 0;
    current.style.left = "0px";
    current.style.top = `${top}px`;
  }

  showTableMenu(
    event: MouseEvent | PointerEvent,
    table: HTMLTableElement,
    tableSpec: MarkdownTableSpec | null,
    view: MarkdownViewLike | null,
  ): void {
    const resolvedView = view || this.getViewForTable(table);
    const resolvedSpec = this.resolveTableSpec(table, tableSpec, resolvedView);
    const styleVariant =
      this.plugin.settings.tableStyleVariant ||
      DEFAULT_SETTINGS.tableStyleVariant;
    const alignment = this.getTableAlignment(resolvedView, resolvedSpec);
    const menu = new Menu();

    menu.addItem((item) => {
      item
        .setTitle("复制表格")
        .setIcon("copy")
        .onClick(() => {
          this.copyTableToClipboard(resolvedView, resolvedSpec, table);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle("删除表格")
        .setIcon("trash")
        .onClick(() => {
          this.deleteTableFromMarkdown(resolvedView, resolvedSpec, table).catch(
            () => {},
          );
        });
    });

    menu.addSeparator();
    TABLE_ALIGNMENT_OPTIONS.forEach((option) => {
      menu.addItem((item) => {
        item
          .setTitle(option.label)
          .setIcon(option.icon)
          .setChecked(alignment === option.value)
          .onClick(() => {
            this.setTableAlignment(
              resolvedView,
              resolvedSpec,
              table,
              option.value,
            ).catch(() => {});
          });
      });
    });

    menu.addSeparator();
    TABLE_STYLE_OPTIONS.forEach((option) => {
      menu.addItem((item) => {
        item
          .setTitle(option.label)
          .setChecked(styleVariant === option.value)
          .onClick(() => {
            this.setGlobalTableStyleVariant(option.value).catch(() => {});
          });
      });
    });

    menu.showAtPosition({ x: event.clientX, y: event.clientY });
  }

  getTableAlignment(
    view: MarkdownViewLike | null,
    tableSpec: MarkdownTableSpec | null,
  ): TableAlignment | null {
    const editor = view?.editor;
    if (editor && tableSpec && typeof editor.getValue === "function") {
      const separatorLine = findSeparatorLineForSpec(
        editor.getValue(),
        tableSpec,
      );
      if (separatorLine !== null && typeof editor.getLine === "function") {
        const separator = parseSeparatorLine(editor.getLine(separatorLine));
        if (separator?.columns?.length) {
          return getTableAlignmentFromColumns(separator.columns);
        }
      }
    }

    return getTableAlignmentFromColumns(tableSpec?.columns);
  }

  async setTableAlignment(
    view: MarkdownViewLike | null,
    tableSpec: MarkdownTableSpec | null,
    table: HTMLTableElement | null,
    alignment: TableAlignment,
  ): Promise<void> {
    const editor = view?.editor;
    if (
      !editor ||
      !view?.file ||
      !tableSpec ||
      !TABLE_ALIGNMENT_OPTIONS.some((option) => option.value === alignment)
    ) {
      return;
    }

    const markdown = editor.getValue();
    const currentSpecs = extractMarkdownTableSpecs(markdown);
    let resolvedSpec = tableSpec;
    if (
      Number.isInteger(tableSpec.tableOrdinal) &&
      tableSpec.tableOrdinal >= 0 &&
      tableSpec.tableOrdinal < currentSpecs.length
    ) {
      resolvedSpec = currentSpecs[tableSpec.tableOrdinal];
    }

    const separatorLine = findSeparatorLineForSpec(markdown, resolvedSpec);
    if (separatorLine === null) {
      return;
    }

    const separator = parseSeparatorLine(editor.getLine(separatorLine));
    if (!separator?.columns?.length) {
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
        { line: separatorLine, ch: currentLine.length },
      );
    });

    const nextMarkdown = editor.getValue();
    this.fileMarkdownSnapshots.set(view.file.path, nextMarkdown);
    this.fileTableSnapshots.set(
      view.file.path,
      extractMarkdownTableSpecs(nextMarkdown),
    );

    const targetTable =
      table instanceof HTMLTableElement
        ? table
        : this.findTableForSpec(view, resolvedSpec);
    if (targetTable) {
      this.applyTableColumnAlignment(targetTable, nextColumns);
      this.positionHandles(targetTable);
    }

    await this.refreshAllTables();
    await this.syncPreviewAfterMarkdownChange(view);
    this.syncReadingPresentation("table-alignment");
  }

  findTableForSpec(
    view: MarkdownViewLike,
    tableSpec: MarkdownTableSpec | null,
  ): HTMLTableElement | null {
    if (!tableSpec) {
      return null;
    }

    const tables = this.queryTablesForView(view);
    if (Number.isInteger(tableSpec.tableOrdinal)) {
      const matched = tables.find(
        (table) => getTableMatchIndex(table) === tableSpec.tableOrdinal,
      );
      if (matched) {
        return matched;
      }
    }
    return tables[tableSpec.tableOrdinal] || tables[0] || null;
  }

  applyTableColumnAlignment(
    table: HTMLTableElement,
    columns: Array<MarkdownTableColumn | null | undefined>,
  ): void {
    if (
      !(table instanceof HTMLTableElement) ||
      !Array.isArray(columns) ||
      !columns.length
    ) {
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
          getColumnAlignmentKind(columns[index]),
        );
      });
    }
  }

  clearPerColumnAlignmentClasses(table: HTMLTableElement): void {
    table.querySelectorAll("td, th").forEach((cell) => {
      cell.classList.remove(...MARKPLUS_COLUMN_ALIGNMENT_CLASSES);
      (cell as HTMLElement).style.removeProperty("text-align");
    });
  }

  setCellAlignmentClass(
    cell: HTMLTableCellElement | HTMLElement,
    alignment: TableAlignment | null,
  ): void {
    if (!(cell instanceof HTMLElement)) {
      return;
    }
    cell.classList.remove(...MARKPLUS_COLUMN_ALIGNMENT_CLASSES);
    if (alignment) {
      cell.classList.add(`markplus-col-align-${alignment}`);
    }
    cell.style.removeProperty("text-align");
  }

  async copyTableToClipboard(
    view: MarkdownViewLike | null,
    tableSpec: MarkdownTableSpec | null,
    table: HTMLTableElement,
  ): Promise<void> {
    const markdown = getTableMarkdownForCopy(
      view || this.getViewForTable(table),
      this.resolveTableSpec(
        table,
        tableSpec,
        view || this.getViewForTable(table),
      ),
      table,
    );
    if (!markdown) {
      new Notice("无法复制表格");
      return;
    }

    try {
      await navigator.clipboard.writeText(markdown);
      new Notice("表格已复制到剪贴板");
    } catch (_error) {
      new Notice("复制表格失败");
    }
  }

  async setGlobalTableStyleVariant(value: TableStyleVariant): Promise<void> {
    this.plugin.settings.tableStyleVariant = value;
    await this.plugin.saveSettings();
    this.syncReadingPresentation("table-style-change");
    this.scheduleRefresh("table-style-change");
  }

  async deleteTableFromMarkdown(
    view: MarkdownViewLike | null,
    tableSpec: MarkdownTableSpec | null,
    table: HTMLTableElement,
  ): Promise<void> {
    const editor = view?.editor;
    if (!editor || !view?.file || !tableSpec) {
      return;
    }

    const start = tableSpec.headerLineIndex;
    const end = tableSpec.separatorLineIndex + tableSpec.bodyLines.length;
    const lineCount =
      typeof editor.lineCount === "function"
        ? editor.lineCount()
        : editor.getValue().split(/\r?\n/).length;
    if (
      !Number.isInteger(start) ||
      start < 0 ||
      end < start ||
      end >= lineCount
    ) {
      return;
    }

    await this.withPreservedViewScroll(view, async () => {
      this.markInternalChange(view.file.path);
      const endLineLength = editor.getLine(end).length;
      if (end < lineCount - 1) {
        editor.replaceRange(
          "",
          { line: start, ch: 0 },
          { line: end + 1, ch: 0 },
        );
      } else if (start > 0) {
        const previousLength = editor.getLine(start - 1).length;
        editor.replaceRange(
          "",
          { line: start - 1, ch: previousLength },
          { line: end, ch: endLineLength },
        );
      } else {
        editor.replaceRange(
          "",
          { line: 0, ch: 0 },
          { line: end, ch: endLineLength },
        );
      }

      const nextMarkdown = editor.getValue();
      this.fileMarkdownSnapshots.set(view.file.path, nextMarkdown);
      this.fileTableSnapshots.set(
        view.file.path,
        extractMarkdownTableSpecs(nextMarkdown),
      );
    });

    this.removeResizeHandles(table);
    await this.syncPreviewAfterMarkdownChange(view);
    this.scheduleRefresh("delete-table");
  }

  getViewForTable(table: HTMLTableElement): MarkdownViewLike | null {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.contentEl?.contains(table)) {
        return view;
      }
    }

    return null;
  }

  bindTableCellFill(table: HTMLTableElement): void {
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
        if (
          !this.plugin.settings.enableTableCellFill ||
          this.fillDragState ||
          (event.target as Element | null)?.closest(
            ".markplus-cell-fill-handle, .markplus-column-handle, .markplus-table-menu-button",
          )
        ) {
          return;
        }

        const cell = (event.target as Element | null)?.closest(
          "td, th",
        ) as HTMLTableCellElement | null;
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

  onDocumentPointerDown(event: PointerEvent): void {
    if (
      this.fillDragState ||
      (event.target as Element | null)?.closest(".markplus-cell-fill-handle") ||
      (event.target as Element | null)?.closest(
        ".markplus-resizable-table td, .markplus-resizable-table th",
      )
    ) {
      return;
    }

    this.clearActiveFillCell();
  }

  resolveTableSpec(
    table: HTMLTableElement,
    fallbackSpec: MarkdownTableSpec | null,
    view: MarkdownViewLike | null,
  ): MarkdownTableSpec | null {
    if (!view?.editor || typeof view.editor.getValue !== "function") {
      return fallbackSpec || null;
    }

    const currentSpecs = extractMarkdownTableSpecs(view.editor.getValue());
    if (currentSpecs.length === 1) {
      return currentSpecs[0];
    }

    for (const index of [
      getTableMatchIndex(table),
      fallbackSpec?.tableOrdinal,
    ].filter(
      (value): value is number => Number.isInteger(value) && value >= 0,
    )) {
      if (index < currentSpecs.length) {
        return currentSpecs[index];
      }
    }

    for (const separatorLine of [
      Number.parseInt(table.dataset.markplusSeparatorLine ?? "", 10),
      fallbackSpec?.separatorLineIndex,
    ].filter(
      (value): value is number => Number.isInteger(value) && value >= 0,
    )) {
      const matched = currentSpecs.find(
        (spec) => spec.separatorLineIndex === separatorLine,
      );
      if (matched) {
        return matched;
      }
    }

    return (
      this.matchSpecForTable(
        table,
        currentSpecs,
        new Set<number>(),
        getTableMatchIndex(table),
        view,
      ) ||
      fallbackSpec ||
      null
    );
  }

  activateCellFill(
    table: HTMLTableElement,
    cell: HTMLTableCellElement,
    tableSpec: MarkdownTableSpec | null,
    view: MarkdownViewLike | null,
  ): void {
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
        },
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
      sourceCol: colIndex,
    };
  }

  syncActiveFillCell(
    table: HTMLTableElement,
    tableSpec: MarkdownTableSpec | null,
    view: MarkdownViewLike | null,
  ): void {
    if (
      !this.fillState ||
      this.fillState.table !== table ||
      this.fillDragState
    ) {
      return;
    }

    const { sourceRow, sourceCol, handle } = this.fillState;
    const sourceCell = table.rows[sourceRow]?.cells[sourceCol];
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
    if (!sourceCell.contains(handle)) {
      sourceCell.appendChild(handle);
    }
  }

  clearActiveFillCell(): void {
    this.fillState?.handle?.remove();
    this.fillState = null;
  }

  startFillDrag(event: PointerEvent, table: HTMLTableElement): void {
    event.preventDefault();
    event.stopPropagation();

    const fillState = this.fillState;
    if (!fillState || fillState.table !== table) {
      return;
    }

    const view = fillState.view || this.getViewForTable(table);
    const tableSpec = this.resolveTableSpec(table, fillState.tableSpec, view);
    if (!tableSpec || !view?.file) {
      return;
    }

    const { sourceRow, sourceCol } = fillState;
    const cell = table.rows[sourceRow]?.cells[sourceCol];
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
      targets: [],
    };

    table.classList.add("markplus-is-filling");
    document.body.classList.add("markplus-fill-cursor");
    if (handle && "setPointerCapture" in (handle as Element)) {
      try {
        (handle as Element).setPointerCapture(event.pointerId);
      } catch (_error) {}
    }

    window.addEventListener("pointermove", this.boundFillPointerMove);
    window.addEventListener("pointerup", this.boundFillPointerUp);
    window.addEventListener("pointercancel", this.boundFillPointerCancel);
  }

  onFillPointerMove(event: PointerEvent): void {
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

  async onFillPointerUp(event: PointerEvent): Promise<void> {
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
      tableSpec: dragTableSpec,
    } = this.fillDragState;
    const tableSpec = this.resolveTableSpec(table, dragTableSpec, view);
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
        { disableIncrementFill },
      );
      this.stopFillDragging();
      this.reapplyTableFormulasAfterFill(view, tableSpec);
      this.scheduleRefresh("fill-complete");
      return;
    }

    this.stopFillDragging();
  }

  onFillPointerCancel(): void {
    this.stopFillDragging();
  }

  stopFillDragging(): void {
    if (this.fillDragState) {
      const { table, fillHandle, pointerId } = this.fillDragState;
      this.clearFillHighlights(table);
      table.classList.remove("markplus-is-filling");

      if (fillHandle && "releasePointerCapture" in (fillHandle as Element)) {
        try {
          const el = fillHandle as Element;
          if (el.hasPointerCapture?.(pointerId)) {
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
    if (this.pendingRefreshReason) {
      const reason = this.pendingRefreshReason;
      this.pendingRefreshReason = null;
      this.scheduleRefresh(reason);
    }
  }

  highlightFillTargets(
    table: HTMLTableElement,
    targets: TableCellCoords[],
  ): void {
    for (const { rowIndex, colIndex } of targets) {
      const cell = table.rows[rowIndex]?.cells[colIndex];
      cell?.classList.add("markplus-cell-fill-target");
    }
  }

  clearFillHighlights(table: HTMLTableElement): void {
    table.querySelectorAll(".markplus-cell-fill-target").forEach((cell) => {
      cell.classList.remove("markplus-cell-fill-target");
    });
  }

  async applyCellFill(
    view: MarkdownViewLike | null,
    tableSpec: MarkdownTableSpec,
    sourceRow: number,
    sourceCol: number,
    sourceText: string,
    targets: TableCellCoords[],
    options: { disableIncrementFill?: boolean } = {},
  ): Promise<void> {
    const editor = view?.editor;
    if (
      !editor ||
      !view?.file ||
      !tableSpec ||
      !Array.isArray(targets) ||
      !targets.length
    ) {
      return;
    }

    const updates = new Map<number, string>();
    for (const { rowIndex, colIndex } of targets) {
      if (rowIndex === sourceRow && colIndex === sourceCol) {
        continue;
      }

      const markdownLineIndex = getMarkdownLineIndexForTableRow(
        tableSpec,
        rowIndex,
      );
      const currentLine = updates.has(markdownLineIndex)
        ? (updates.get(markdownLineIndex) as string)
        : editor.getLine(markdownLineIndex);
      const nextValue = getFillCellValue(
        sourceText,
        sourceRow,
        sourceCol,
        rowIndex,
        colIndex,
        options,
      );
      updates.set(
        markdownLineIndex,
        replaceCellInMarkdownRow(currentLine, colIndex, nextValue),
      );
    }

    if (!updates.size) {
      return;
    }

    this.markInternalChange(view.file.path, updates.size);
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

    const markdown = editor.getValue();
    this.fileMarkdownSnapshots.set(view.file.path, markdown);
    this.fileTableSnapshots.set(
      view.file.path,
      extractMarkdownTableSpecs(markdown),
    );
    await this.syncPreviewAfterMarkdownChange(view);
  }

  positionHandles(table: HTMLTableElement): void {
    const handles = this.handleMap.get(table) || [];
    const widths = this.readCurrentWidths(table, handles.length);
    const headerRow = getTableHeaderRow(table);
    const top = headerRow?.offsetTop ?? 0;
    const height = headerRow?.offsetHeight ?? 0;
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

  updateActiveHandleForPointer(table: HTMLTableElement, clientX: number): void {
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

  clearActiveHandles(table: HTMLTableElement): void {
    (this.handleMap.get(table) || []).forEach((handle) => {
      handle.classList.remove("is-active");
    });
    table.classList.remove("markplus-has-active-handle");
  }

  startDragging(
    event: PointerEvent,
    handle: HTMLDivElement,
    table: HTMLTableElement,
    handleIndex: number,
    tableSpec: MarkdownTableSpec | null,
    view: MarkdownViewLike,
  ): void {
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

  startScaleDragging(
    event: PointerEvent,
    table: HTMLTableElement,
    tableSpec: MarkdownTableSpec | null,
    view: MarkdownViewLike,
  ): void {
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

  onPointerMove(event: PointerEvent): void {
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

  computeDragWidths(event: PointerEvent): number[] | null {
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

  async onPointerUp(event: PointerEvent): Promise<void> {
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

    let resolvedSpec = tableSpec;
    if (view?.editor && typeof view.editor.getValue === "function") {
      const matchedSpec = this.matchSpecForTable(
        table,
        extractMarkdownTableSpecs(view.editor.getValue()),
        new Set<number>(),
        getTableMatchIndex(table),
        view,
      );
      if (matchedSpec) {
        resolvedSpec = matchedSpec;
      }
    }

    await this.writeWidthsBackToMarkdown(
      this.readCurrentWidths(table),
      resolvedSpec,
      view,
    );
    this.stopDragging();
    if (view) {
      await this.syncPreviewAfterMarkdownChange(view);
    }
    this.scheduleRefresh("pointer-up");
  }

  onPointerCancel(): void {
    if (this.dragState) {
      this.stopDragging();
      this.scheduleRefresh("pointer-cancel");
    }
  }

  stopDragging(): void {
    if (this.dragState?.table) {
      this.dragState.table.classList.remove("markplus-is-resizing");
      this.clearActiveHandles(this.dragState.table);

      const handle = this.dragState.handle;
      if (handle && typeof handle.releasePointerCapture === "function") {
        try {
          if (handle.hasPointerCapture?.(this.dragState.pointerId as number)) {
            handle.releasePointerCapture(this.dragState.pointerId as number);
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

  markInternalChange(filePath: string, count = 1): void {
    const budget =
      (this.internalChangeBudget.get(filePath) || 0) + Math.max(1, count);
    this.internalChangeBudget.set(filePath, budget);
  }

  consumeInternalChangeBudget(filePath: string): boolean {
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

  readCurrentWidths(
    table: HTMLTableElement,
    fallbackCount: number | null = null,
  ): number[] {
    const headerRow = getTableHeaderRow(table);
    if (headerRow?.cells.length) {
      return Array.from(headerRow.cells).map((cell) =>
        Math.round(cell.getBoundingClientRect().width),
      );
    }

    const colgroup = table.querySelector(":scope > colgroup.markplus-colgroup");
    if (colgroup && colgroup.children.length) {
      const widths = Array.from(colgroup.children).map((col) =>
        Math.round((col as HTMLElement).getBoundingClientRect().width),
      );
      if (widths.length) {
        return widths;
      }
    }

    return fallbackCount
      ? Array.from(
          { length: fallbackCount },
          () => this.plugin.settings.minColumnWidth,
        )
      : [];
  }

  applyWidthsToColgroup(
    table: HTMLTableElement,
    colgroup: HTMLTableColElement,
    widths: number[],
  ): void {
    const resolvedWidths =
      widths && widths.length ? widths : this.readCurrentWidths(table);
    Array.from(colgroup.children).forEach((col, index) => {
      const width = resolvedWidths[index];
      (col as HTMLElement).style.width = width ? `${width}px` : "";
    });
    this.applyColumnWidthStyles(table, resolvedWidths);
  }

  applyColumnWidthStyles(table: HTMLTableElement, widths: number[]): void {
    if (!widths?.length) {
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

  private preserveEditorScroll(
    view: MarkdownViewLike | null,
    action: () => void,
  ): void {
    const scroller = view?.contentEl?.querySelector(
      ".cm-scroller",
    ) as HTMLElement | null;
    const scrollTop = scroller?.scrollTop ?? null;
    const scrollLeft = scroller?.scrollLeft ?? null;

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

  private async withPreservedViewScroll(
    view: MarkdownViewLike | null,
    action: () => Promise<void> | void,
  ): Promise<void> {
    const scroller = view?.contentEl?.querySelector(
      ".cm-scroller",
    ) as HTMLElement | null;
    const scrollTop = scroller?.scrollTop ?? null;
    const scrollLeft = scroller?.scrollLeft ?? null;
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

  async writeWidthsBackToMarkdown(
    widths: number[],
    tableSpec: MarkdownTableSpec | null,
    view: MarkdownViewLike | null,
  ): Promise<void> {
    if (!tableSpec || !view?.file) {
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
      return;
    }

    const lines = markdown.split(/\r?\n/);
    if (!parseSeparatorLine(lines[separatorLineIndex])) {
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
        view.editor?.replaceRange(
          separatorLine,
          { line: separatorLineIndex, ch: 0 },
          { line: separatorLineIndex, ch: currentLine.length },
        );
      });

      const nextMarkdown = view.editor.getValue();
      this.fileMarkdownSnapshots.set(view.file.path, nextMarkdown);
      this.fileTableSnapshots.set(
        view.file.path,
        extractMarkdownTableSpecs(nextMarkdown),
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

  applyReadingPresentationForPreview(
    previewMode: MarkdownViewLike["previewMode"] | null | undefined,
    _reason = "(unknown)",
  ): void {
    const containerEl = previewMode?.containerEl;
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

  alignPreviewTableWrapper(table: HTMLTableElement): void {
    if (
      !(table instanceof HTMLTableElement) ||
      table.closest(".markdown-source-view, .cm-table-widget")
    ) {
      return;
    }

    table.style.marginLeft = "0";
    table.style.marginRight = "0";
    table.style.marginInlineStart = "0";
    table.style.marginInlineEnd = "0";

    const wrapper = table.closest(
      ".el-table, .table-wrapper",
    ) as HTMLElement | null;
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
    if (!block?.classList?.contains("el-div")) {
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

  syncReadingPresentation(reason = "(unknown)"): void {
    window.requestAnimationFrame(() => {
      for (const leaf of this.plugin.app.workspace.getLeavesOfType(
        "markdown",
      )) {
        const view = leaf.view;
        if (
          view instanceof MarkdownView &&
          view.getMode?.() === "preview" &&
          view.previewMode?.containerEl
        ) {
          this.applyReadingPresentationForPreview(view.previewMode, reason);
        }
      }
    });
  }

  async syncPreviewAfterMarkdownChange(view: MarkdownViewLike): Promise<void> {
    if (!(view instanceof MarkdownView) || !view.file?.path) {
      return;
    }

    const markdown = view.editor?.getValue?.();
    if (typeof markdown === "string") {
      this.fileMarkdownSnapshots.set(view.file.path, markdown);
      this.fileTableSnapshots.set(
        view.file.path,
        extractMarkdownTableSpecs(markdown),
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
      "sync-markdown-change",
    );
  }

  reapplyTableFormulasAfterFill(
    view: MarkdownViewLike | null,
    tableSpec: MarkdownTableSpec | null,
  ): void {
    if (
      !this.plugin.settings.enableTableFormulas ||
      !view?.contentEl ||
      !tableSpec
    ) {
      return;
    }

    const apply = () => {
      const editor = view.editor;
      if (!editor || typeof editor.getValue !== "function") {
        return false;
      }

      const specs = extractMarkdownTableSpecs(editor.getValue());
      const latestSpec =
        specs.find(
          (spec) => spec.separatorLineIndex === tableSpec.separatorLineIndex,
        ) ||
        (Number.isInteger(tableSpec.tableOrdinal)
          ? specs[tableSpec.tableOrdinal]
          : null);
      if (!latestSpec) {
        return false;
      }

      for (const node of view.contentEl.querySelectorAll(TABLE_SELECTOR)) {
        if (!(node instanceof HTMLTableElement)) {
          continue;
        }

        const resolvedSpec = this.resolveTableSpec(node, latestSpec, view);
        if (
          resolvedSpec?.separatorLineIndex === latestSpec.separatorLineIndex
        ) {
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

  removeResizeHandles(table: HTMLTableElement): void {
    (this.handleMap.get(table) || []).forEach((handle) => handle.remove());
    this.handleMap.delete(table);
    this.scaleHandleMap.get(table)?.remove();
    this.scaleHandleMap.delete(table);
    this.menuButtonMap.get(table)?.remove();
    this.menuButtonMap.delete(table);
    this.cellFillHandleMap.get(table)?.remove();
    this.cellFillHandleMap.delete(table);
  }
}

function getDomTableColumnCount(table: HTMLTableElement): number {
  return Math.max(...Array.from(table.rows).map((row) => row.cells.length), 0);
}

function isReadingModeTable(table: Element): table is HTMLTableElement {
  return (
    table instanceof HTMLTableElement &&
    !table.closest(".cm-table-widget, .markdown-source-view") &&
    Boolean(
      table.closest(".markdown-preview-view, .markdown-reading-view, .el-table"),
    )
  );
}

function toColumnPercents(widths: number[]): number[] {
  if (!Array.isArray(widths) || !widths.length) {
    return [];
  }

  const total = widths.reduce((sum, width) => sum + Math.max(0, width), 0);
  if (!total) {
    return widths.map(() => 0);
  }

  return widths.map((width) => Math.max(0, (width / total) * 100));
}
