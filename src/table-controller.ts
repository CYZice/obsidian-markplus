import { MarkdownView, type TFile } from "obsidian";
import { DEFAULT_SETTINGS, TABLE_SELECTOR } from "./constants";
import { mpLog, summarizeMutations } from "./debug";
import { applyTableFormulasToDom } from "./formulas";
import {
  areStringArraysEqual,
  buildSeparatorLine,
  buildSeparatorLineFromColumns,
  domTableHeaderSignature,
  extractMarkdownTableSpecs,
  findSeparatorLineForSpec,
  getCellSourceText,
  getLineAt,
  getMarkdownLineIndexForTableRow,
  isLikelyTaskSyntaxInsertion,
  parseSeparatorLine,
  reorderColumnsByHeader,
  replaceCellInMarkdownRow,
  specHeaderSignature,
  transferColumnsToCurrentLayout,
} from "./markdown-table";
import {
  computeFillTargets,
  getCellCoords,
  getFillCellValue,
  getTableCellFromPoint,
  getTableHeaderRow,
  type TableCellCoords,
} from "./table-dom";
import type {
  EditorChangeContext,
  EditorLike,
  MarkPlusSettings,
  MarkdownTableSpec,
  MarkdownViewLike,
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
  cellFillHandleMap = new WeakMap<HTMLTableElement, HTMLDivElement>();
  observerMap = new WeakMap<HTMLElement, MutationObserver>();
  fileTableSnapshots = new Map<string, MarkdownTableSpec[]>();
  fileMarkdownSnapshots = new Map<string, string>();
  internalChangeBudget = new Map<string, number>();
  isComposing = false;
  dragState: ResizeDragState | null = null;
  fillState: FillState | null = null;
  fillDragState: FillDragState | null = null;
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

    this.plugin.registerDomEvent(document, "pointerdown", this.boundDocumentPointerDown, {
      capture: true,
    });
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
      mpLog("restoreSeparatorsAfterComposition");
      this.handleEditorChange(view.editor, { file: view.file }).catch((error) => {
        console.error("MarkPlus composition restore failed", error);
      });
    }
  }

  async refreshAllTables(): Promise<void> {
    if (this.isComposing) {
      mpLog("refreshAllTables:skip-composing");
      return;
    }

    mpLog("refreshAllTables:start");
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

      const usedIndexes = new Set<number>();
      tables.forEach((table, index) => {
        const tableSpec = this.matchSpecForTable(table, specs, usedIndexes, index);
        this.decorateTable(table, tableSpec, view, index);
      });
    }
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
      mpLog("reapplyWidthsFromCache", {
        file: file.path,
        tableCount: tables.length,
        specCount: specs.length,
      });

      const usedIndexes = new Set<number>();
      tables.forEach((table, index) => {
        if (!(table instanceof HTMLTableElement)) {
          return;
        }

        const rowCount = Math.max(...Array.from(table.rows).map((row) => row.cells.length), 0);
        if (rowCount < 1) {
          return;
        }

        const tableSpec = this.matchSpecForTable(table, specs, usedIndexes, index);
        const widths = this.getWidthsForTable(table, tableSpec, rowCount);
        this.applyColumnWidthStyles(table, widths);
      });
      return;
    }
  }

  async handleEditorChange(editor: EditorLike | null | undefined, context?: EditorChangeContext): Promise<void> {
    if (!editor || typeof editor.getValue !== "function") {
      return;
    }

    if (this.isComposing) {
      mpLog("handleEditorChange:skip-composing");
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
      mpLog("handleEditorChange:internal-change-consumed", { filePath });
      this.fileTableSnapshots.set(filePath, currentSpecs);
      this.scheduleRefresh("editor-change-internal");
      return;
    }

    const previousSpecs = this.fileTableSnapshots.get(filePath) || [];
    const restorations: Array<{ lineIndex: number; line: string }> = [];

    for (const currentSpec of currentSpecs) {
      const previousSpec = previousSpecs.find(
        (item) => item.separatorLineIndex === currentSpec.separatorLineIndex,
      );
      if (!previousSpec) {
        continue;
      }

      const headerChanged = previousSpec.rawHeaderLine !== currentSpec.rawHeaderLine;
      const separatorChanged = previousSpec.rawSeparatorLine !== currentSpec.rawSeparatorLine;
      const sameColumnCount = previousSpec.columns.length === currentSpec.columns.length;
      const columnCountChanged = previousSpec.columns.length !== currentSpec.columns.length;
      const bodyChanged = !areStringArraysEqual(previousSpec.bodyLines, currentSpec.bodyLines);
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

      if (headerChanged && columnCountChanged && (transferredColumns?.matchedCount || 0) > 0) {
        restorations.push({
          lineIndex: currentSpec.separatorLineIndex,
          line: buildSeparatorLineFromColumns(transferredColumns?.columns || []),
        });
        continue;
      }

      if (separatorChanged && sameColumnCount && (headerChanged || bodyChanged)) {
        restorations.push({
          lineIndex:
            findSeparatorLineForSpec(markdown, currentSpec) ?? currentSpec.separatorLineIndex,
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
    this.fileTableSnapshots.set(filePath, extractMarkdownTableSpecs(nextMarkdown));
    this.scheduleRefresh("editor-change-restoration");
  }

  tryCompleteTaskSyntax(editor: EditorLike, filePath: string, previousMarkdown: string): boolean {
    if (
      !this.plugin.settings.enableTaskSyntaxCompletion ||
      typeof editor.getCursor !== "function" ||
      typeof editor.getLine !== "function" ||
      typeof editor.replaceRange !== "function"
    ) {
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

    if (
      !/^\s*-\s(?:\[)?$/.test(beforeCursor) ||
      afterCursor.length > 0 ||
      !isLikelyTaskSyntaxInsertion(previousLine, currentLine)
    ) {
      return false;
    }

    this.markInternalChange(filePath);
    if (beforeCursor.endsWith("[")) {
      editor.replaceRange("[ ] ", { line: cursor.line, ch: cursor.ch - 1 }, cursor);
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
  ): MarkdownTableSpec | null {
    if (!Array.isArray(specs) || !specs.length || !(table instanceof HTMLTableElement)) {
      return null;
    }

    const domSignature = domTableHeaderSignature(table);
    if (domSignature) {
      for (let index = 0; index < specs.length; index += 1) {
        if (!usedIndexes.has(index) && specHeaderSignature(specs[index]) === domSignature) {
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

  decorateTable(
    table: Element,
    tableSpec: MarkdownTableSpec | null,
    view: MarkdownViewLike,
    tableIndex: number,
  ): void {
    if (!(table instanceof HTMLTableElement)) {
      return;
    }

    const columnCount = Math.max(...Array.from(table.rows).map((row) => row.cells.length), 0);
    if (columnCount < 1) {
      return;
    }

    table.className = table.className
      .split(/\s+/)
      .filter((className) => className && !className.startsWith("markplus-table-style-"))
      .join(" ");
    table.classList.add("markplus-resizable-table");
    table.dataset.markplusTableIndex = String(tableIndex);

    const styleVariant =
      this.plugin.settings.tableStyleVariant || DEFAULT_SETTINGS.tableStyleVariant;
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
      dashCounts: tableSpec ? tableSpec.columns.map((column) => column.dashCount) : null,
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

  ensureColgroup(table: HTMLTableElement, columnCount: number): HTMLTableColElement {
    let colgroup = table.querySelector(":scope > colgroup.markplus-colgroup") as HTMLTableColElement | null;
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
        mpLog("mutation-observer", summary);
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
        this.startDragging(event, handle, table, handles.indexOf(handle), tableSpec, view);
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

    handle.style.left = "";
    handle.style.top = "";
    handle.style.right = "";
    handle.style.bottom = "";
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
    if (!this.plugin.settings.enableTableCellFill || table.dataset.markplusFillBound === "true") {
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
            ".markplus-cell-fill-handle, .markplus-column-handle, .markplus-table-scale-handle",
          )
        ) {
          return;
        }

        const cell = (event.target as Element | null)?.closest("td, th") as HTMLTableCellElement | null;
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
    const filePath = view?.file?.path;

    if (view?.editor && typeof view.editor.getValue === "function") {
      return (
        this.matchSpecForTable(
          table,
          extractMarkdownTableSpecs(view.editor.getValue()),
          new Set<number>(),
          null,
        ) ||
        fallbackSpec ||
        null
      );
    }

    if (filePath) {
      const cachedSpecs = this.fileTableSnapshots.get(filePath);
      if (cachedSpecs?.length) {
        return this.matchSpecForTable(table, cachedSpecs, new Set<number>(), null) || fallbackSpec || null;
      }
    }

    return fallbackSpec || null;
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

  syncActiveFillCell(
    table: HTMLTableElement,
    tableSpec: MarkdownTableSpec | null,
    view: MarkdownViewLike | null,
  ): void {
    if (!this.fillState || this.fillState.table !== table || this.fillDragState) {
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
    this.fillState.tableSpec = this.resolveTableSpec(table, tableSpec, resolvedView);
    this.fillState.sourceRow = sourceRow;
    this.fillState.sourceCol = sourceCol;

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
    const targetCell = getTableCellFromPoint(table, event.clientX, event.clientY);
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

    const { table, view, sourceRow, sourceCol, targets } = this.fillDragState;
    const tableSpec = this.resolveTableSpec(table, this.fillDragState.tableSpec, view);
    const sourceText = tableSpec ? getCellSourceText(tableSpec, sourceRow, sourceCol) : null;
    const targetCell = getTableCellFromPoint(table, event.clientX, event.clientY);

    let resolvedTargets = targets;
    if (targetCell) {
      const targetCoords = getCellCoords(table, targetCell);
      resolvedTargets = computeFillTargets(
        { rowIndex: sourceRow, colIndex: sourceCol },
        targetCoords,
      );
    }

    if (tableSpec && sourceText !== null) {
      await this.applyCellFill(view, tableSpec, sourceRow, sourceCol, sourceText, resolvedTargets);
      this.stopFillDragging();
      this.scheduleRefresh("cell-fill");
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
  }

  highlightFillTargets(table: HTMLTableElement, targets: TableCellCoords[]): void {
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
  ): Promise<void> {
    const editor = view?.editor;
    if (!view?.file || !tableSpec || !Array.isArray(targets) || !targets.length) {
      return;
    }

    if (editor) {
      const updates = new Map<number, string>();
      for (const { rowIndex, colIndex } of targets) {
        if (rowIndex === sourceRow && colIndex === sourceCol) {
          continue;
        }

        const markdownLineIndex = getMarkdownLineIndexForTableRow(tableSpec, rowIndex);
        const currentLine = updates.has(markdownLineIndex)
          ? (updates.get(markdownLineIndex) as string)
          : editor.getLine(markdownLineIndex);
        const nextValue = getFillCellValue(
          sourceText,
          sourceRow,
          sourceCol,
          rowIndex,
          colIndex,
        );
        updates.set(markdownLineIndex, replaceCellInMarkdownRow(currentLine, colIndex, nextValue));
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
            editor.replaceRange(value, { line: lineIndex, ch: 0 }, { line: lineIndex, ch: line.length });
          });
      });

      const markdown = editor.getValue();
      this.fileMarkdownSnapshots.set(view.file.path, markdown);
      this.fileTableSnapshots.set(view.file.path, extractMarkdownTableSpecs(markdown));
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

      const markdownLineIndex = getMarkdownLineIndexForTableRow(tableSpec, rowIndex);
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
      const nextLine = replaceCellInMarkdownRow(currentLine, colIndex, nextValue);
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
    this.fileTableSnapshots.set(view.file.path, extractMarkdownTableSpecs(nextMarkdown));
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
      minWidth: this.plugin.settings.minColumnWidth || DEFAULT_SETTINGS.minColumnWidth,
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
      minWidth: this.plugin.settings.minColumnWidth || DEFAULT_SETTINGS.minColumnWidth,
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

    const { mode, handleIndex, startX, widths, minWidth, startWidth } = this.dragState;
    const deltaX = event.clientX - startX;
    const nextWidths = widths.slice();

    if (mode === "scale") {
      const scale =
        Math.max(minWidth * widths.length, Math.round((startWidth || 0) + deltaX)) /
        (startWidth || 1);
      for (let index = 0; index < widths.length; index += 1) {
        nextWidths[index] = Math.max(minWidth, Math.round(widths[index] * scale));
      }
      return nextWidths;
    }

    if (typeof handleIndex !== "number") {
      return nextWidths;
    }

    if (handleIndex === widths.length - 1) {
      nextWidths[handleIndex] = Math.max(minWidth, Math.round(widths[handleIndex] + deltaX));
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
      this.computeDragWidths(event) || this.readCurrentWidths(this.dragState.table);
    const { table, tableSpec, view } = this.dragState;
    const colgroup = this.ensureColgroup(table, widths.length);
    this.applyWidthsToColgroup(table, colgroup, widths);
    this.positionHandles(table);

    const resolvedWidths = this.readCurrentWidths(table);
    let resolvedSpec = tableSpec;
    if (view?.editor && typeof view.editor.getValue === "function") {
      const matchedSpec = this.matchSpecForTable(
        table,
        extractMarkdownTableSpecs(view.editor.getValue()),
        new Set<number>(),
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

  markInternalChange(filePath: string): void {
    const budget = (this.internalChangeBudget.get(filePath) || 0) + 1;
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

  readCurrentWidths(table: HTMLTableElement, fallbackCount: number | null = null): number[] {
    const colgroup = table.querySelector(":scope > colgroup.markplus-colgroup");
    if (colgroup && colgroup.children.length) {
      const widths = Array.from(colgroup.children).map((col) => {
        const width = parseFloat((col as HTMLElement).style.width);
        return Number.isFinite(width) && width > 0
          ? Math.round(width)
          : Math.round((col as HTMLElement).getBoundingClientRect().width);
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
      ? Array.from({ length: fallbackCount }, () => this.plugin.settings.minColumnWidth)
      : [];
  }

  applyWidthsToColgroup(
    table: HTMLTableElement,
    colgroup: HTMLTableColElement,
    widths: number[],
  ): void {
    const resolvedWidths = widths && widths.length ? widths : this.readCurrentWidths(table);
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

  private preserveEditorScroll(view: MarkdownViewLike | null, action: () => void): void {
    const scroller = view?.contentEl?.querySelector(".cm-scroller") as HTMLElement | null;
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
        view.editor?.replaceRange(
          separatorLine,
          { line: separatorLineIndex, ch: 0 },
          { line: separatorLineIndex, ch: currentLine.length },
        );
      });

      const nextMarkdown = view.editor.getValue();
      this.fileMarkdownSnapshots.set(view.file.path, nextMarkdown);
      this.fileTableSnapshots.set(view.file.path, extractMarkdownTableSpecs(nextMarkdown));
      return;
    }

    lines[separatorLineIndex] = separatorLine;
    const nextMarkdown = lines.join("\n");
    await this.plugin.app.vault.modify(view.file, nextMarkdown);
    this.fileMarkdownSnapshots.set(view.file.path, nextMarkdown);
    this.fileTableSnapshots.set(view.file.path, extractMarkdownTableSpecs(nextMarkdown));
  }
}
