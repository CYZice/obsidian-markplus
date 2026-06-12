let obsidian = require("obsidian"),
  { Plugin, MarkdownView, PluginSettingTab, Setting } = obsidian,
  DEFAULT_SETTINGS = {
    minColumnWidth: 60,
    pixelsPerDash: 12,
    enableTaskSyntaxCompletion: !0,
    enableTableFormulas: !0,
    enableTableCellFill: !0,
    tableStyleVariant: "default",
  },
  FORMULA_PATTERN = /^=\s*(sum|avg|average|count|max|min)\s*(?:\(\s*\))?$/i,
  TABLE_SELECTOR =
    ".markdown-rendered table, .cm-preview-code-block table, .markdown-source-view.mod-cm6 .cm-table-widget table",
  MARKPLUS_DEBUG = !0,
  markplusLogSeq = 0;
function mpLog(e, t) {
  MARKPLUS_DEBUG && (markplusLogSeq += 1);
}
function summarizeMutations(e) {
  let t = 0,
    a = 0;
  var n,
    i,
    r = [];
  for (n of e)
    [...n.addedNodes, ...n.removedNodes].some(
      (e) =>
        1 === e.nodeType &&
        (e.classList?.contains("markplus-colgroup") ||
          e.classList?.contains("markplus-column-handle") ||
          e.classList?.contains("markplus-table-scale-handle") ||
          e.classList?.contains("markplus-cell-fill-handle") ||
          e.classList?.contains("markplus-formula-result") ||
          "COL" === e.tagName),
    )
      ? (t += 1)
      : ((a += 1),
        r.length < 3 &&
          ((i = n.target),
          r.push({
            type: n.type,
            target:
              1 === i?.nodeType
                ? (i.tagName + "." + (i.className || "")).trim()
                : i?.nodeName,
            added: n.addedNodes.length,
            removed: n.removedNodes.length,
          })));
  return {
    total: e.length,
    ownDecorationMutations: t,
    otherMutations: a,
    samples: r,
  };
}
class MarkPlusPlugin extends Plugin {
  async onload() {
    ((this._pluginInitialized = !1), await this.initializePluginFeatures());
  }
  async initializePluginFeatures() {
    if (!this._pluginInitialized) {
      ((this._pluginInitialized = !0),
        (this.settings = Object.assign(
          {},
          DEFAULT_SETTINGS,
          await this.loadData(),
        )),
        (this.tableEnhancer = new TableColumnResizeController(this)),
        this.addSettingTab(new MarkPlusSettingTab(this.app, this)),
        this.registerEvent(
          this.app.workspace.on("layout-change", () => {
            this.tableEnhancer.scheduleRefresh("layout-change");
          }),
        ),
        this.registerEvent(
          this.app.workspace.on("active-leaf-change", () => {
            this.tableEnhancer.scheduleRefresh("active-leaf-change");
          }),
        ),
        this.registerEvent(
          this.app.workspace.on("file-open", () => {
            this.tableEnhancer.scheduleRefresh("file-open");
          }),
        ),
        this.registerEvent(
          this.app.workspace.on("editor-change", (e, t) => {
            this.tableEnhancer.handleEditorChange(e, t).catch((e) => {});
          }),
        ),
        this.registerDomEvent(window, "resize", () => {
          this.tableEnhancer.scheduleRefresh("window-resize");
        }),
        this.registerDomEvent(
          document,
          "compositionstart",
          () => {
            ((this.tableEnhancer.isComposing = !0), mpLog("compositionstart"));
          },
          { capture: !0 },
        ),
        this.registerDomEvent(
          document,
          "compositionend",
          () => {
            ((this.tableEnhancer.isComposing = !1),
              mpLog("compositionend"),
              this.tableEnhancer.restoreSeparatorsAfterComposition(),
              this.tableEnhancer.reapplyWidthsActiveView(),
              this.tableEnhancer.scheduleRefresh("composition-end"));
          },
          { capture: !0 },
        ),
        this.register(() => {
          this.tableEnhancer && this.tableEnhancer.destroy();
        }),
        this.tableEnhancer.scheduleRefresh("onload"));
    }
  }
  onunload() {
    ((this._pluginInitialized = !1),
      this.tableEnhancer &&
        (this.tableEnhancer.destroy(), (this.tableEnhancer = null)));
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
}
module.exports = MarkPlusPlugin;
class TableColumnResizeController {
  constructor(e) {
    ((this.plugin = e),
      (this.handleMap = new WeakMap()),
      (this.scaleHandleMap = new WeakMap()),
      (this.cellFillHandleMap = new WeakMap()),
      (this.observerMap = new WeakMap()),
      (this.fileTableSnapshots = new Map()),
      (this.fileMarkdownSnapshots = new Map()),
      (this.internalChangeBudget = new Map()),
      (this.isComposing = !1),
      (this.dragState = null),
      (this.fillState = null),
      (this.fillDragState = null),
      (this.refreshTimer = null),
      (this.boundPointerMove = this.onPointerMove.bind(this)),
      (this.boundPointerUp = this.onPointerUp.bind(this)),
      (this.boundPointerCancel = this.onPointerCancel.bind(this)),
      (this.boundFillPointerMove = this.onFillPointerMove.bind(this)),
      (this.boundFillPointerUp = this.onFillPointerUp.bind(this)),
      (this.boundFillPointerCancel = this.onFillPointerCancel.bind(this)),
      (this.boundDocumentPointerDown = this.onDocumentPointerDown.bind(this)),
      this.plugin.registerDomEvent(
        document,
        "pointerdown",
        this.boundDocumentPointerDown,
        { capture: !0 },
      ));
  }
  destroy() {
    (window.clearTimeout(this.refreshTimer),
      this.disconnectObservers(),
      this.stopDragging(),
      this.stopFillDragging(),
      this.clearActiveFillCell());
  }
  scheduleRefresh(e) {
    (mpLog("scheduleRefresh", e || "(unknown)"),
      window.clearTimeout(this.refreshTimer),
      (this.refreshTimer = window.setTimeout(() => {
        this.refreshAllTables().catch((e) =>
          console.error("MarkPlus refresh failed", e),
        );
      }, 80)));
  }
  reapplyWidthsActiveView() {
    var e = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    e?.contentEl && this.reapplyWidthsFromCache(e.contentEl);
  }
  restoreSeparatorsAfterComposition() {
    var e = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    e?.editor &&
      e.file &&
      (mpLog("restoreSeparatorsAfterComposition"),
      this.handleEditorChange(e.editor, { file: e.file }).catch((e) =>
        console.error("MarkPlus composition restore failed", e),
      ));
  }
  async refreshAllTables() {
    if (this.isComposing) mpLog("refreshAllTables:skip-composing");
    else {
      var e;
      mpLog("refreshAllTables:start");
      for (e of this.plugin.app.workspace.getLeavesOfType("markdown")) {
        let r = e.view;
        if (r instanceof MarkdownView) {
          var t = r.file;
          if (t && r.contentEl) {
            this.ensureObserver(r.contentEl);
            var a = await this.getMarkdownSource(r);
            let n = extractMarkdownTableSpecs(a);
            (this.fileTableSnapshots.set(t.path, n),
              this.fileMarkdownSnapshots.set(t.path, a));
            a = r.contentEl.querySelectorAll(TABLE_SELECTOR);
            mpLog("refreshAllTables:tables", {
              file: t.path,
              tableCount: a.length,
              specCount: n.length,
            });
            let i = new Set();
            a.forEach((e, t) => {
              var a = this.matchSpecForTable(e, n, i, t);
              this.decorateTable(e, a, r, t);
            });
          }
        }
      }
    }
  }
  reapplyWidthsFromCache(e) {
    var t;
    if (!this.dragState && !this.isComposing)
      for (t of this.plugin.app.workspace.getLeavesOfType("markdown")) {
        var a = t.view;
        if (a instanceof MarkdownView && a.contentEl === e) {
          a = a.file;
          if (!a) return;
          let n = this.fileTableSnapshots.get(a.path) || [];
          var r = e.querySelectorAll(TABLE_SELECTOR);
          mpLog("reapplyWidthsFromCache", {
            file: a.path,
            tableCount: r.length,
            specCount: n.length,
          });
          let i = new Set();
          return void r.forEach((e, t) => {
            var a;
            e instanceof HTMLTableElement &&
              ((a = Array.from(e.rows)),
              (a = Math.max(...a.map((e) => e.cells.length), 0)) < 1 ||
                ((t = this.matchSpecForTable(e, n, i, t)),
                (t = this.getWidthsForTable(e, t, a)),
                this.applyColumnWidthStyles(e, t)));
          });
        }
      }
  }
  async handleEditorChange(a, e) {
    if (a && "function" == typeof a.getValue)
      if (this.isComposing) mpLog("handleEditorChange:skip-composing");
      else {
        e = e?.file || e?.view?.file;
        if (e?.path) {
          var e = e.path,
            n = this.fileMarkdownSnapshots.get(e) || "";
          if (this.tryCompleteTaskSyntax(a, e, n))
            this.fileMarkdownSnapshots.set(e, a.getValue());
          else {
            var i = a.getValue(),
              n = extractMarkdownTableSpecs(i);
            if (
              (this.fileMarkdownSnapshots.set(e, i),
              this.consumeInternalChangeBudget(e))
            )
              (mpLog("handleEditorChange:internal-change-consumed", {
                filePath: e,
              }),
                this.fileTableSnapshots.set(e, n),
                this.scheduleRefresh("editor-change-internal"));
            else {
              var t,
                r = this.fileTableSnapshots.get(e) || [],
                l = [];
              for (let t of n) {
                var s,
                  o,
                  c,
                  h,
                  u,
                  d,
                  p,
                  g = r.find(
                    (e) => e.separatorLineIndex === t.separatorLineIndex,
                  );
                g &&
                  ((s = g.rawHeaderLine !== t.rawHeaderLine),
                  (o = g.rawSeparatorLine !== t.rawSeparatorLine),
                  (c = g.columns.length === t.columns.length),
                  (h = g.columns.length !== t.columns.length),
                  (u = !areStringArraysEqual(g.bodyLines, t.bodyLines)),
                  (d = c ? reorderColumnsByHeader(g, t) : null),
                  (p = s ? transferColumnsToCurrentLayout(g, t) : null),
                  s && d
                    ? l.push({
                        lineIndex: t.separatorLineIndex,
                        line: buildSeparatorLineFromColumns(d),
                      })
                    : s && h && 0 < p?.matchedCount
                      ? l.push({
                          lineIndex: t.separatorLineIndex,
                          line: buildSeparatorLineFromColumns(p.columns),
                        })
                      : o &&
                        c &&
                        (s || u) &&
                        l.push({
                          lineIndex:
                            findSeparatorLineForSpec(i, t) ??
                            t.separatorLineIndex,
                          line: g.rawSeparatorLine,
                        }));
              }
              l.length
                ? (mpLog("handleEditorChange:restoring-separator", {
                    filePath: e,
                    restorations: l.map((e) => ({
                      lineIndex: e.lineIndex,
                      line: e.line,
                    })),
                  }),
                  this.markInternalChange(e),
                  l
                    .sort((e, t) => t.lineIndex - e.lineIndex)
                    .forEach((e) => {
                      var t = a.getLine(e.lineIndex);
                      a.replaceRange(
                        e.line,
                        { line: e.lineIndex, ch: 0 },
                        { line: e.lineIndex, ch: t.length },
                      );
                    }),
                  (t = a.getValue()),
                  this.fileMarkdownSnapshots.set(e, t),
                  this.fileTableSnapshots.set(e, extractMarkdownTableSpecs(t)),
                  this.scheduleRefresh("editor-change-restoration"))
                : (mpLog("handleEditorChange:no-restoration", { filePath: e }),
                  this.fileTableSnapshots.set(e, n),
                  this.scheduleRefresh("editor-change"));
            }
          }
        }
      }
  }
  tryCompleteTaskSyntax(e, t, a) {
    var n, i, r, l;
    return (
      !!this.plugin.settings.enableTaskSyntaxCompletion &&
      "function" == typeof e.getCursor &&
      "function" == typeof e.getLine &&
      "function" == typeof e.replaceRange &&
      !(
        !(n = e.getCursor()) ||
        "number" != typeof n.line ||
        "number" != typeof n.ch ||
        "string" != typeof (i = e.getLine(n.line)) ||
        ((r = i.slice(0, n.ch)),
        (l = i.slice(n.ch)),
        (a = getLineAt(a, n.line)),
        !/^\s*-\s(?:\[)?$/.test(r)) ||
        0 < l.length ||
        !isLikelyTaskSyntaxInsertion(a, i) ||
        (this.markInternalChange(t),
        r.endsWith("[")
          ? e.replaceRange("[ ] ", { line: n.line, ch: n.ch - 1 }, n)
          : e.replaceRange(" ] ", n),
        "function" == typeof e.setCursor &&
          e.setCursor({ line: n.line, ch: n.ch + 3 }),
        0)
      )
    );
  }
  async getMarkdownSource(e) {
    return e.editor && "function" == typeof e.editor.getValue
      ? e.editor.getValue()
      : this.plugin.app.vault.cachedRead(e.file);
  }
  matchSpecForTable(e, t, a, n) {
    if (!Array.isArray(t) || !t.length) return null;
    var i = domTableHeaderSignature(e);
    if (i)
      for (let e = 0; e < t.length; e += 1)
        if (!a.has(e) && specHeaderSignature(t[e]) === i)
          return (a.add(e), t[e]);
    return null != n && 0 <= n && n < t.length && !a.has(n)
      ? (a.add(n), t[n])
      : null;
  }
  decorateTable(e, t, a, n) {
    var i, r, l;
    e instanceof HTMLTableElement &&
      ((i = Array.from(e.rows)),
      (i = Math.max(...i.map((e) => e.cells.length), 0)) < 1 ||
        ((e.className = e.className
          .split(/\s+/)
          .filter((e) => e && !e.startsWith("markplus-table-style-"))
          .join(" ")),
        e.classList.add("markplus-resizable-table"),
        (e.dataset.markplusTableIndex = String(n)),
        (r =
          this.plugin.settings.tableStyleVariant ||
          DEFAULT_SETTINGS.tableStyleVariant),
        (e.dataset.markplusStyle = r),
        e.classList.add("markplus-table-style-" + r),
        (l =
          "true" ===
          (r = this.ensureColgroup(e, i)).dataset.markplusInitialized),
        (r.dataset.markplusInitialized = "true"),
        mpLog("decorateTable", {
          tableIndex: n,
          columnCount: i,
          widths: (n = this.getWidthsForTable(e, t, i)),
          hadColgroup: l,
          dashCounts: t ? t.columns.map((e) => e.dashCount) : null,
        }),
        this.applyWidthsToColgroup(e, r, n),
        this.bindTableHoverTracking(e),
        this.syncHandleCount(e, i, t, a),
        this.syncScaleHandle(e, t, a),
        this.bindTableCellFill(e),
        this.syncActiveFillCell(e, t, a),
        this.applyTableFormulas(e, t)));
  }
  applyTableFormulas(t, a) {
    if (this.plugin.settings.enableTableFormulas) {
      t = Array.from(t.rows);
      if (!(t.length < 2)) {
        var n = t[t.length - 1];
        let o = t.slice(1, t.length - 1);
        var i,
          t = n.cells.length;
        let e = null,
          c = null;
        (a &&
          Array.isArray(a.bodyLines) &&
          a.bodyLines.length &&
          (i = splitMarkdownRow((a = a.bodyLines)[a.length - 1]).map((e) =>
            e.trim(),
          )).length === t &&
          ((e = i),
          (c = a
            .slice(0, -1)
            .map((e) => splitMarkdownRow(e).map((e) => e.trim())))),
          Array.from(n.cells).forEach((t, a) => {
            if (!isCellBeingEdited(t)) {
              var n = e
                ? parseFormulaName(e[a])
                : t.dataset.markplusFormula || parseFormulaName(t.textContent);
              if (n) {
                t.dataset.markplusFormula = n;
                var i = [];
                if (c)
                  for (var r of c) {
                    r = parseNumericValue(r[a]);
                    null !== r && i.push(r);
                  }
                else
                  for (var l of o) {
                    var l = l.cells[a];
                    l &&
                      null !== (l = parseNumericValue(l.textContent)) &&
                      i.push(l);
                  }
                var s = formatFormulaResult(computeFormulaResult(n, i));
                let e = t.querySelector(":scope > .markplus-formula-result");
                (e && e.dataset.formula === n && e.textContent === s) ||
                  (e ||
                    (((e = document.createElement("span")).className =
                      "markplus-formula-result"),
                    t.replaceChildren(e)),
                  (e.dataset.formula = n),
                  (e.textContent = s),
                  (e.title = "=" + n.toUpperCase()));
              } else
                (delete t.dataset.markplusFormula,
                  t.querySelector(":scope > .markplus-formula-result") &&
                    e &&
                    (t.textContent = e[a] || ""));
            }
          }));
      }
    }
  }
  getWidthsForTable(e, a, t) {
    return a && a.columns.length
      ? Array.from({ length: t }, (e, t) => {
          t = a.columns[t]?.dashCount ?? 3;
          return Math.max(
            this.plugin.settings.minColumnWidth,
            t * this.plugin.settings.pixelsPerDash,
          );
        })
      : this.readCurrentWidths(e, t);
  }
  ensureColgroup(e, t) {
    let a = e.querySelector(":scope > colgroup.markplus-colgroup");
    for (
      a ||
      (((a = document.createElement("colgroup")).className =
        "markplus-colgroup"),
      e.insertBefore(a, e.firstChild));
      a.children.length < t;
    )
      a.appendChild(document.createElement("col"));
    for (; a.children.length > t; ) a.lastElementChild.remove();
    return a;
  }
  ensureObserver(t) {
    var e;
    this.observerMap.has(t) ||
      ((e = new MutationObserver((e) => {
        e = summarizeMutations(e);
        0 !== e.otherMutations &&
          (mpLog("mutation-observer", e),
          this.reapplyWidthsFromCache(t),
          this.scheduleRefresh("mutation-observer"));
      })).observe(t, { childList: !0, subtree: !0 }),
      this.observerMap.set(t, e));
  }
  disconnectObservers() {
    var e;
    for (e of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      var t = e.view?.contentEl,
        t = t ? this.observerMap.get(t) : null;
      t && t.disconnect();
    }
  }
  syncHandleCount(a, e, n, i) {
    let r = this.handleMap.get(a) || [];
    for (; r.length < e; ) {
      let t = document.createElement("div");
      ((t.className = "markplus-column-handle"),
        t.addEventListener("pointerdown", (e) => {
          this.startDragging(e, t, a, r.indexOf(t), n, i);
        }),
        a.appendChild(t),
        r.push(t));
    }
    for (; r.length > e; ) r.pop().remove();
    (this.handleMap.set(a, r), this.positionHandles(a));
  }
  bindTableHoverTracking(t) {
    var e = getTableHeaderRow(t);
    e &&
      "true" !== t.dataset.markplusHoverBound &&
      ((t.dataset.markplusHoverBound = "true"),
      e.addEventListener("mousemove", (e) => {
        this.dragState?.table !== t &&
          this.updateActiveHandleForPointer(t, e.clientX);
      }),
      e.addEventListener("mouseleave", () => {
        this.dragState?.table !== t && this.clearActiveHandles(t);
      }));
  }
  syncScaleHandle(t, a, n) {
    let e = this.scaleHandleMap.get(t);
    (e ||
      (((e = document.createElement("div")).className =
        "markplus-table-scale-handle"),
      e.addEventListener("pointerdown", (e) => {
        this.startScaleDragging(e, t, a, n);
      }),
      t.appendChild(e),
      this.scaleHandleMap.set(t, e)),
      (e.style.left = ""),
      (e.style.top = ""),
      (e.style.right = ""),
      (e.style.bottom = ""));
  }
  getViewForTable(e) {
    var t;
    for (t of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      var a = t.view;
      if (a instanceof MarkdownView && a.contentEl?.contains(e)) return a;
    }
    return null;
  }
  bindTableCellFill(n) {
    this.plugin.settings.enableTableCellFill &&
      "true" !== n.dataset.markplusFillBound &&
      ((n.dataset.markplusFillBound = "true"),
      n.addEventListener(
        "pointerdown",
        (e) => {
          var t, a;
          !this.plugin.settings.enableTableCellFill ||
            this.fillDragState ||
            e.target.closest(
              ".markplus-cell-fill-handle, .markplus-column-handle, .markplus-table-scale-handle",
            ) ||
            ((e = e.target.closest("td, th")) &&
              n.contains(e) &&
              ((t = this.getViewForTable(n)),
              (a = this.resolveTableSpec(n, null, t)),
              this.activateCellFill(n, e, a, t)));
        },
        !0,
      ));
  }
  onDocumentPointerDown(e) {
    this.fillDragState ||
      e.target.closest(".markplus-cell-fill-handle") ||
      e.target.closest(
        ".markplus-resizable-table td, .markplus-resizable-table th",
      ) ||
      this.clearActiveFillCell();
  }
  resolveTableSpec(e, t, a) {
    return a?.editor && "function" == typeof a.editor.getValue
      ? this.matchSpecForTable(
          e,
          extractMarkdownTableSpecs(a.editor.getValue()),
          new Set(),
          null,
        ) ||
          t ||
          null
      : t || null;
  }
  activateCellFill(t, a, n, i) {
    if (this.plugin.settings.enableTableCellFill) {
      var i = i || this.getViewForTable(t),
        n = this.resolveTableSpec(t, n, i),
        { rowIndex: r, colIndex: l } = getCellCoords(t, a);
      this.clearActiveFillCell();
      let e = this.cellFillHandleMap.get(t);
      (e ||
        (((e = document.createElement("div")).className =
          "markplus-cell-fill-handle"),
        e.addEventListener("pointerdown", (e) => {
          this.startFillDrag(e, t);
        }),
        this.cellFillHandleMap.set(t, e)),
        a.appendChild(e),
        (this.fillState = {
          table: t,
          cell: a,
          tableSpec: n,
          view: i,
          handle: e,
          sourceRow: r,
          sourceCol: l,
        }));
    }
  }
  syncActiveFillCell(e, t, a) {
    var n, i, r, l;
    this.fillState &&
      this.fillState.table === e &&
      !this.fillDragState &&
      (({ sourceRow: n, sourceCol: i, handle: r } = this.fillState),
      (l = e.rows[n]?.cells[i])
        ? ((a = a || this.getViewForTable(e)),
          (this.fillState.cell = l),
          (this.fillState.view = a),
          (this.fillState.tableSpec = this.resolveTableSpec(e, t, a)),
          (this.fillState.sourceRow = n),
          (this.fillState.sourceCol = i),
          l.contains(r) || l.appendChild(r))
        : this.clearActiveFillCell());
  }
  clearActiveFillCell() {
    (this.fillState?.handle && this.fillState.handle.remove(),
      (this.fillState = null));
  }
  startFillDrag(e, t) {
    (e.preventDefault(), e.stopPropagation());
    var a = this.fillState;
    if (a && a.table === t) {
      var n = a.view || this.getViewForTable(t),
        i = this.resolveTableSpec(t, a.tableSpec, n);
      if (i && n?.file) {
        var r = a.sourceRow,
          l = a.sourceCol,
          s = t.rows[r]?.cells[l];
        if (s) {
          ((a.cell = s), (a.tableSpec = i), (a.view = n));
          s = getCellSourceText(i, r, l);
          if (null !== s) {
            a = e.currentTarget;
            if (
              ((this.fillDragState = {
                table: t,
                tableSpec: i,
                view: n,
                sourceRow: r,
                sourceCol: l,
                sourceText: s,
                pointerId: e.pointerId,
                fillHandle: a,
                targets: [],
              }),
              t.classList.add("markplus-is-filling"),
              document.body.classList.add("markplus-fill-cursor"),
              a && "function" == typeof a.setPointerCapture)
            )
              try {
                a.setPointerCapture(e.pointerId);
              } catch (e) {}
            (window.addEventListener("pointermove", this.boundFillPointerMove),
              window.addEventListener("pointerup", this.boundFillPointerUp),
              window.addEventListener(
                "pointercancel",
                this.boundFillPointerCancel,
              ));
          }
        }
      }
    }
  }
  onFillPointerMove(e) {
    var t, a, n;
    this.fillDragState &&
      (({ table: t, sourceRow: n, sourceCol: a } = this.fillDragState),
      (e = getTableCellFromPoint(t, e.clientX, e.clientY)),
      this.clearFillHighlights(t),
      e
        ? ((n = computeFillTargets(
            { rowIndex: n, colIndex: a },
            getCellCoords(t, e),
          )),
          this.highlightFillTargets(t, n),
          (this.fillDragState.targets = n))
        : (this.fillDragState.targets = []));
  }
  async onFillPointerUp(t) {
    if (this.fillDragState) {
      var {
          table: a,
          view: n,
          sourceRow: i,
          sourceCol: r,
          targets: l,
        } = this.fillDragState,
        s = this.resolveTableSpec(a, this.fillDragState.tableSpec, n),
        o = s ? getCellSourceText(s, i, r) : null,
        t = getTableCellFromPoint(a, t.clientX, t.clientY);
      let e = l;
      (t &&
        ((l = getCellCoords(a, t)),
        (e = computeFillTargets({ rowIndex: i, colIndex: r }, l))),
        s && null !== o
          ? (await this.applyCellFill(n, s, i, r, o, e),
            this.stopFillDragging(),
            this.scheduleRefresh("cell-fill"))
          : this.stopFillDragging());
    }
  }
  onFillPointerCancel() {
    this.stopFillDragging();
  }
  stopFillDragging() {
    if (this.fillDragState) {
      var { table: e, fillHandle: t, pointerId: a } = this.fillDragState;
      if (
        (this.clearFillHighlights(e),
        e.classList.remove("markplus-is-filling"),
        t && "function" == typeof t.releasePointerCapture)
      )
        try {
          t.hasPointerCapture?.(a) && t.releasePointerCapture(a);
        } catch (e) {}
    }
    ((this.fillDragState = null),
      document.body.classList.remove("markplus-fill-cursor"),
      window.removeEventListener("pointermove", this.boundFillPointerMove),
      window.removeEventListener("pointerup", this.boundFillPointerUp),
      window.removeEventListener("pointercancel", this.boundFillPointerCancel));
  }
  highlightFillTargets(e, t) {
    for (var { rowIndex: a, colIndex: n } of t) {
      a = e.rows[a]?.cells[n];
      a && a.classList.add("markplus-cell-fill-target");
    }
  }
  clearFillHighlights(e) {
    e.querySelectorAll(".markplus-cell-fill-target").forEach((e) => {
      e.classList.remove("markplus-cell-fill-target");
    });
  }
  async applyCellFill(e, t, a, n, i, r) {
    let l = e?.editor;
    if (l && e.file && t && Array.isArray(r) && r.length) {
      var s,
        o,
        c,
        h,
        u,
        d = new Map();
      for ({ rowIndex: s, colIndex: o } of r)
        (s === a && o === n) ||
          ((c = getMarkdownLineIndexForTableRow(t, s)),
          (h = d.has(c) ? d.get(c) : l.getLine(c)),
          (u = getFillCellValue(i, a, n, s, o)),
          d.set(c, replaceCellInMarkdownRow(h, o, u)));
      d.size &&
        (this.markInternalChange(e.file.path),
        [...d.entries()]
          .sort((e, t) => t[0] - e[0])
          .forEach(([e, t]) => {
            var a = l.getLine(e);
            l.replaceRange(t, { line: e, ch: 0 }, { line: e, ch: a.length });
          }),
        (r = l.getValue()),
        this.fileMarkdownSnapshots.set(e.file.path, r),
        this.fileTableSnapshots.set(e.file.path, extractMarkdownTableSpecs(r)));
    }
  }
  positionHandles(e) {
    let n = this.handleMap.get(e) || [],
      i = this.readCurrentWidths(e, n.length),
      r = getTableHeaderRow(e),
      l = r?.offsetTop ?? 0,
      s = r?.offsetHeight ?? 0,
      o = 0;
    (e.classList.toggle(
      "markplus-has-active-handle",
      n.some((e) => e.classList.contains("is-active")),
    ),
      n.forEach((e, t) => {
        var a = i[t];
        a && r
          ? ((o += a),
            (e.style.display = "block"),
            (e.style.left = o - 4 + "px"),
            (e.style.top = l + "px"),
            (e.style.height = s + "px"),
            (e.dataset.edge = t === n.length - 1 ? "right" : "middle"))
          : (e.style.display = "none");
      }));
    e = this.scaleHandleMap.get(e);
    e &&
      ((e.style.left = ""),
      (e.style.top = ""),
      (e.style.right = ""),
      (e.style.bottom = ""));
  }
  updateActiveHandleForPointer(e, n) {
    var i = this.handleMap.get(e) || [];
    if (i.length) {
      var r = n - e.getBoundingClientRect().left,
        l = this.readCurrentWidths(e, i.length);
      let t = 0,
        a = i.length - 1;
      for (let e = 0; e < l.length; e += 1)
        if (r <= (t += l[e])) {
          a = Math.min(e, i.length - 1);
          break;
        }
      (i.forEach((e, t) => {
        e.classList.toggle("is-active", t === a);
      }),
        e.classList.add("markplus-has-active-handle"));
    }
  }
  clearActiveHandles(e) {
    ((this.handleMap.get(e) || []).forEach((e) => {
      e.classList.remove("is-active");
    }),
      e.classList.remove("markplus-has-active-handle"));
  }
  startDragging(e, t, a, n, i, r) {
    (e.preventDefault(), e.stopPropagation(), this.clearActiveFillCell());
    var l = this.readCurrentWidths(a);
    if (!(!l.length || n < 0 || n >= l.length)) {
      if (
        ((this.dragState = {
          mode: "column",
          table: a,
          handle: t,
          handleIndex: n,
          pointerId: e.pointerId,
          startX: e.clientX,
          widths: l,
          tableSpec: i,
          view: r,
          minWidth:
            this.plugin.settings.minColumnWidth ||
            DEFAULT_SETTINGS.minColumnWidth,
        }),
        a.classList.add("markplus-is-resizing"),
        (this.handleMap.get(a) || []).forEach((e, t) => {
          e.classList.toggle("is-active", t === n);
        }),
        a.classList.add("markplus-has-active-handle"),
        t && "function" == typeof t.setPointerCapture)
      )
        try {
          t.setPointerCapture(e.pointerId);
        } catch (e) {}
      (document.body.classList.add("markplus-resize-cursor"),
        window.addEventListener("pointermove", this.boundPointerMove),
        window.addEventListener("pointerup", this.boundPointerUp),
        window.addEventListener("pointercancel", this.boundPointerCancel));
    }
  }
  startScaleDragging(e, t, a, n) {
    (e.preventDefault(), e.stopPropagation(), this.clearActiveFillCell());
    var i = this.readCurrentWidths(t);
    i.length &&
      ((this.dragState = {
        mode: "scale",
        table: t,
        startX: e.clientX,
        startWidth: i.reduce((e, t) => e + t, 0),
        widths: i,
        tableSpec: a,
        view: n,
        minWidth:
          this.plugin.settings.minColumnWidth ||
          DEFAULT_SETTINGS.minColumnWidth,
      }),
      t.classList.add("markplus-is-resizing"),
      document.body.classList.add("markplus-resize-cursor-diagonal"),
      window.addEventListener("pointermove", this.boundPointerMove),
      window.addEventListener("pointerup", this.boundPointerUp));
  }
  onPointerMove(e) {
    var t, a;
    this.dragState &&
      (e = this.computeDragWidths(e)) &&
      ((t = this.dragState.table),
      (a = this.ensureColgroup(t, e.length)),
      this.applyWidthsToColgroup(t, a, e),
      this.positionHandles(t));
  }
  computeDragWidths(e) {
    if (!this.dragState) return null;
    var {
        mode: t,
        handleIndex: a,
        startX: n,
        widths: i,
        minWidth: r,
        startWidth: l,
      } = this.dragState,
      e = e.clientX - n,
      s = i.slice();
    if ("scale" === t) {
      var o = Math.max(r * i.length, Math.round(l + e)) / l;
      for (let e = 0; e < i.length; e += 1)
        s[e] = Math.max(r, Math.round(i[e] * o));
    } else
      a === i.length - 1
        ? (s[a] = Math.max(r, Math.round(i[a] + e)))
        : ((n = i[a] + i[a + 1]),
          (t = Math.min(n - r, Math.max(r, i[a] + e))),
          (s[a] = Math.round(t)),
          (s[a + 1] = Math.round(n - t)));
    return s;
  }
  async onPointerUp(t) {
    if (this.dragState) {
      var t =
          this.computeDragWidths(t) ||
          this.readCurrentWidths(this.dragState.table),
        { table: a, tableSpec: n, view: i } = this.dragState,
        r = this.ensureColgroup(a, t.length),
        r =
          (this.applyWidthsToColgroup(a, r, t),
          this.positionHandles(a),
          this.readCurrentWidths(a));
      let e = n;
      (i?.editor &&
        "function" == typeof i.editor.getValue &&
        (t = this.matchSpecForTable(
          a,
          extractMarkdownTableSpecs(i.editor.getValue()),
          new Set(),
          null,
        )) &&
        (e = t),
        await this.writeWidthsBackToMarkdown(r, e, i),
        this.stopDragging(),
        this.scheduleRefresh("pointer-up"));
    }
  }
  onPointerCancel() {
    this.dragState &&
      (this.stopDragging(), this.scheduleRefresh("pointer-cancel"));
  }
  stopDragging() {
    if (this.dragState?.table) {
      (this.dragState.table.classList.remove("markplus-is-resizing"),
        this.clearActiveHandles(this.dragState.table));
      var e = this.dragState.handle;
      if (e && "function" == typeof e.releasePointerCapture)
        try {
          e.hasPointerCapture?.(this.dragState.pointerId) &&
            e.releasePointerCapture(this.dragState.pointerId);
        } catch (e) {}
    }
    ((this.dragState = null),
      document.body.classList.remove("markplus-resize-cursor"),
      document.body.classList.remove("markplus-resize-cursor-diagonal"),
      window.removeEventListener("pointermove", this.boundPointerMove),
      window.removeEventListener("pointerup", this.boundPointerUp),
      window.removeEventListener("pointercancel", this.boundPointerCancel));
  }
  markInternalChange(e) {
    var t = (this.internalChangeBudget.get(e) || 0) + 1;
    this.internalChangeBudget.set(e, t);
  }
  consumeInternalChangeBudget(e) {
    var t = this.internalChangeBudget.get(e) || 0;
    return !(
      t <= 0 ||
      (1 === t
        ? this.internalChangeBudget.delete(e)
        : this.internalChangeBudget.set(e, t - 1),
      0)
    );
  }
  readCurrentWidths(e, t = null) {
    var a = e.querySelector(":scope > colgroup.markplus-colgroup");
    if (a && a.children.length) {
      a = Array.from(a.children).map((e) => {
        var t = parseFloat(e.style.width);
        return Number.isFinite(t) && 0 < t
          ? Math.round(t)
          : Math.round(e.getBoundingClientRect().width);
      });
      if (a.length) return a;
    }
    a = e.rows[0];
    return a
      ? Array.from(a.cells).map((e) =>
          Math.round(e.getBoundingClientRect().width),
        )
      : t
        ? Array.from({ length: t }, () => this.plugin.settings.minColumnWidth)
        : [];
  }
  applyWidthsToColgroup(e, t, a) {
    let n = a && a.length ? a : this.readCurrentWidths(e);
    (Array.from(t.children).forEach((e, t) => {
      t = n[t];
      e.style.width = t ? t + "px" : "";
    }),
      this.applyColumnWidthStyles(e, n));
  }
  applyColumnWidthStyles(e, a) {
    if (a && a.length) {
      ((e.style.tableLayout = "fixed"),
        (e.style.width = a.reduce((e, t) => e + t, 0) + "px"));
      for (var t of Array.from(e.rows))
        Array.from(t.cells).forEach((e, t) => {
          t = a[t];
          t &&
            ((e.style.width = t + "px"),
            (e.style.minWidth = t + "px"),
            (e.style.maxWidth = t + "px"));
        });
    }
  }
  async writeWidthsBackToMarkdown(t, a, n) {
    if (a && n?.file) {
      t = buildSeparatorLine(
        a,
        t.map((e) =>
          Math.max(3, Math.round(e / this.plugin.settings.pixelsPerDash)),
        ),
      );
      let e = "";
      a = findSeparatorLineForSpec(
        (e =
          n.editor && "function" == typeof n.editor.getValue
            ? n.editor.getValue()
            : await this.plugin.app.vault.cachedRead(n.file)),
        a,
      );
      if (null == a) mpLog("writeWidthsBackToMarkdown:separator-not-found");
      else {
        var i = e.split(/\r?\n/);
        if (parseSeparatorLine(i[a]))
          if (
            n.editor &&
            "function" == typeof n.editor.replaceRange &&
            "function" == typeof n.editor.getLine
          ) {
            var r = n.editor.getLine(a);
            if (!parseSeparatorLine(r)) return;
            (this.markInternalChange(n.file.path),
              n.editor.replaceRange(
                t,
                { line: a, ch: 0 },
                { line: a, ch: r.length },
              ));
            let e = n.editor.getValue();
            (this.fileMarkdownSnapshots.set(n.file.path, e),
              void this.fileTableSnapshots.set(
                n.file.path,
                extractMarkdownTableSpecs(e),
              ));
          } else {
            i[a] = t;
            let e = i.join("\n");
            (await this.plugin.app.vault.modify(n.file, e),
              this.fileMarkdownSnapshots.set(n.file.path, e),
              this.fileTableSnapshots.set(
                n.file.path,
                extractMarkdownTableSpecs(e),
              ));
          }
        else
          mpLog("writeWidthsBackToMarkdown:line-not-separator", {
            lineIndex: a,
            line: i[a],
          });
      }
    }
  }
}
function extractMarkdownTableSpecs(e) {
  var a = e.split(/\r?\n/),
    n = [];
  for (let t = 1; t < a.length; t += 1) {
    var i = parseSeparatorLine(a[t]);
    if (i) {
      var r = a[t - 1] || "",
        l = splitMarkdownRow(r);
      if (l.length) {
        var s = [];
        let e = t + 1;
        for (; e < a.length; ) {
          var o = a[e];
          if (!isMarkdownTableRow(o)) break;
          (s.push(o), (e += 1));
        }
        (n.push({
          separatorLineIndex: t,
          headerLineIndex: t - 1,
          columns: i.columns,
          headerCells: l,
          bodyLines: s,
          rawHeaderLine: r,
          rawSeparatorLine: a[t],
        }),
          (t = e - 1));
      }
    }
  }
  return n;
}
function findSeparatorLineForSpec(e, t) {
  if (!t || "string" != typeof e) return null;
  var a = specHeaderSignature(t);
  if (a)
    for (var n of extractMarkdownTableSpecs(e))
      if (specHeaderSignature(n) === a) return n.separatorLineIndex;
  ((e = e.split(/\r?\n/)), (t = t.separatorLineIndex));
  return Number.isInteger(t) &&
    0 <= t &&
    t < e.length &&
    parseSeparatorLine(e[t])
    ? t
    : null;
}
function parseSeparatorLine(e) {
  e = splitMarkdownRow(e);
  if (!e.length) return null;
  var t,
    a = [];
  for (t of e) {
    var n = t.trim().match(/^(:)?(-{3,})(:)?$/);
    if (!n) return null;
    a.push({
      alignLeft: Boolean(n[1]),
      alignRight: Boolean(n[3]),
      dashCount: n[2].length,
    });
  }
  return { columns: a };
}
function getTableHeaderRow(e) {
  return (
    (e instanceof HTMLTableElement &&
      (e.querySelector("thead tr") || e.rows[0])) ||
    null
  );
}
function getCellCoords(e, t) {
  var a = t.parentElement;
  return {
    rowIndex: Array.from(e.rows).indexOf(a),
    colIndex: Array.from(a.cells).indexOf(t),
  };
}
function getTableCellFromPoint(e, t, a) {
  if ("function" == typeof document.elementsFromPoint)
    for (var n of document.elementsFromPoint(t, a)) {
      if (n === e) break;
      if (("TD" === n.tagName || "TH" === n.tagName) && e.contains(n)) return n;
    }
  return null;
}
function computeFillTargets(t, e) {
  var a = e.rowIndex - t.rowIndex,
    n = e.colIndex - t.colIndex,
    i = [];
  if (Math.abs(a) >= Math.abs(n)) {
    var a = Math.min(t.rowIndex, e.rowIndex),
      r = Math.max(t.rowIndex, e.rowIndex);
    for (let e = a; e <= r; e += 1)
      i.push({ rowIndex: e, colIndex: t.colIndex });
  } else {
    var n = Math.min(t.colIndex, e.colIndex),
      l = Math.max(t.colIndex, e.colIndex);
    for (let e = n; e <= l; e += 1)
      i.push({ rowIndex: t.rowIndex, colIndex: e });
  }
  return i;
}
function getMarkdownLineIndexForTableRow(e, t) {
  return 0 === t ? e.headerLineIndex : e.separatorLineIndex + t;
}
function getFillCellValue(e, t, a, n, i) {
  var r = parseNumericValue(e);
  return null === r
    ? e
    : ((n = n - t),
      (t = i - a),
      formatFillNumber(r + (Math.abs(n) >= Math.abs(t) ? n : t), e));
}
function formatFillNumber(e, t) {
  var t = String(t)
    .trim()
    .replace(/[,\s楼$鈧?]/g, "")
    .match(/^-?\d+\.(\d+)$/);
  return t
    ? ((t = 10 ** t[1].length), String(Math.round(e * t) / t))
    : String(Math.round(e));
}
function getCellSourceText(e, t, a) {
  return e
    ? 0 === t
      ? (e.headerCells[a] ?? "").trim()
      : (t = t - 1) < 0 || t >= e.bodyLines.length
        ? null
        : (splitMarkdownRow(e.bodyLines[t])[a] ?? "").trim()
    : null;
}
function buildMarkdownTableRow(e) {
  return `| ${e.map((e) => String(e).trim()).join(" | ")} |`;
}
function replaceCellInMarkdownRow(e, t, a) {
  var n = splitMarkdownRow(e);
  return t < 0 || t >= n.length ? e : ((n[t] = a), buildMarkdownTableRow(n));
}
function splitMarkdownRow(e) {
  if (!e.includes("|")) return [];
  let t = e.trim();
  return (t = (t = t.startsWith("|") ? t.slice(1) : t).endsWith("|")
    ? t.slice(0, -1)
    : t).split("|");
}
function buildSeparatorLine(a, e) {
  return `| ${e
    .map((e, t) => {
      ((t = a.columns[t] || { alignLeft: !1, alignRight: !1 }),
        (e = "-".repeat(Math.max(3, e))));
      return (t.alignLeft ? ":" : "") + e + (t.alignRight ? ":" : "");
    })
    .join(" | ")} |`;
}
function buildSeparatorLineFromColumns(e) {
  return `| ${e
    .map((e) => {
      var e = e || {},
        t = "-".repeat(Math.max(3, e.dashCount || 3));
      return (e.alignLeft ? ":" : "") + t + (e.alignRight ? ":" : "");
    })
    .join(" | ")} |`;
}
function reorderColumnsByHeader(t, e) {
  var a = t.headerCells || [],
    n = e.headerCells || [];
  if (!a.length || a.length !== n.length) return null;
  if (t.columns.length !== a.length || e.columns.length !== n.length)
    return null;
  let i = new Map();
  a.forEach((e, t) => {
    var e = normalizeHeaderCell(e),
      a = i.get(e) || [];
    (a.push(t), i.set(e, a));
  });
  var r,
    l = [];
  for (r of n) {
    var s = normalizeHeaderCell(r),
      s = i.get(s);
    if (!s || !s.length) return null;
    l.push(s.shift());
  }
  return l.every((e, t) => e === t) ||
    (e = l.map((e) => t.columns[e])).some((e) => !e)
    ? null
    : e;
}
function normalizeHeaderCell(e) {
  return String(e || "").trim();
}
function transferColumnsToCurrentLayout(a, e) {
  let n = a.headerCells || [];
  var t = e.headerCells || [],
    e = e.columns || [];
  if (!n.length || !t.length) return null;
  let i = new Map(),
    r =
      (n.forEach((e, t) => {
        var e = normalizeHeaderCell(e),
          a = i.get(e) || [];
        (a.push(t), i.set(e, a));
      }),
      new Set()),
    l = Array.from({ length: t.length }, () => null);
  return (
    t.forEach((e, t) => {
      var e = normalizeHeaderCell(e),
        e = i.get(e);
      e && e.length && ((e = e.shift()), r.add(e), (l[t] = e));
    }),
    n.length === t.length &&
      t.forEach((e, t) => {
        null !== l[t] || r.has(t) || t >= n.length || ((l[t] = t), r.add(t));
      }),
    {
      columns: e.map((e, t) => {
        t = l[t];
        return (null === t ? null : a.columns[t]) || e;
      }),
      matchedCount: l.filter((e) => null !== e).length,
    }
  );
}
function normalizeMatchText(e) {
  return String(e || "")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function domTableHeaderSignature(e) {
  e = e.rows && e.rows[0];
  return e && e.cells.length
    ? Array.from(e.cells)
        .map((e) => normalizeMatchText(e.textContent))
        .join("")
    : null;
}
function specHeaderSignature(e) {
  return e && Array.isArray(e.headerCells) && e.headerCells.length
    ? e.headerCells.map((e) => normalizeMatchText(e)).join("")
    : null;
}
function isCellBeingEdited(e) {
  var t = document.activeElement;
  if (t && t !== document.body && e.contains(t)) return !0;
  t = "function" == typeof window.getSelection ? window.getSelection() : null;
  if (t && 0 < t.rangeCount) {
    var a = t.anchorNode,
      t = t.focusNode;
    if ((a && e.contains(a)) || (t && e.contains(t))) return !0;
  }
  return !1;
}
function parseFormulaName(e) {
  var e = String(e || "")
    .trim()
    .match(FORMULA_PATTERN);
  return e ? ("average" === (e = e[1].toLowerCase()) ? "avg" : e) : null;
}
function parseNumericValue(e) {
  return null != e &&
    (e = String(e)
      .trim()
      .replace(/[,\s楼$鈧?*_`~]/g, "")) &&
    ((e = Number(e)), Number.isFinite(e))
    ? e
    : null;
}
function computeFormulaResult(e, t) {
  switch (e) {
    case "sum":
      return t.reduce((e, t) => e + t, 0);
    case "avg":
      return t.length ? t.reduce((e, t) => e + t, 0) / t.length : null;
    case "count":
      return t.length;
    case "max":
      return t.length ? Math.max(...t) : null;
    case "min":
      return t.length ? Math.min(...t) : null;
    default:
      return null;
  }
}
function formatFormulaResult(e) {
  return null !== e && Number.isFinite(e)
    ? String(Math.round(1e6 * e) / 1e6)
    : "-";
}
function isMarkdownTableRow(e) {
  return 0 < splitMarkdownRow(e).length;
}
function areStringArraysEqual(e, a) {
  return (
    e === a ||
    (!(!Array.isArray(e) || !Array.isArray(a) || e.length !== a.length) &&
      e.every((e, t) => e === a[t]))
  );
}
function getLineAt(e, t) {
  return (!("string" != typeof e || t < 0) && e.split(/\r?\n/)[t]) || "";
}
function isLikelyTaskSyntaxInsertion(e, t) {
  return (
    "string" == typeof e &&
    "string" == typeof t &&
    t.length === e.length + 1 &&
    /^\s*-\s$/.test(e) &&
    /^\s*-\s(?:\[)?$/.test(t)
  );
}
class MarkPlusSettingTab extends PluginSettingTab {
  constructor(e, t) {
    (super(e, t), (this.plugin = t));
  }
  display() {
    var e = this.containerEl;
    (e.empty(),
      e
        .createEl("h2")
        .createEl("a", {
          text: "作者：CYZice",
          href: "https://github.com/CYZice/obsidian-markplus",
        })
        .setAttr("target", "_blank"),
      e.createEl("h2", { text: "MarkPlus 设置" }),
      new Setting(e)
        .setName("任务语法自动补全")
        .setDesc("输入 `- [` 或 `-` 后继续输入时，自动补全任务列表语法。")
        .addToggle((e) => {
          e.setValue(this.plugin.settings.enableTaskSyntaxCompletion).onChange(
            async (e) => {
              ((this.plugin.settings.enableTaskSyntaxCompletion = e),
                await this.plugin.saveSettings());
            },
          );
        }),
      new Setting(e)
        .setName("表格公式")
        .setDesc(
          "在表格最后一行单元格输入 `=sum`、`=avg`、`=count`、`=max`、`=min` 时自动计算该列数据。",
        )
        .addToggle((e) => {
          e.setValue(this.plugin.settings.enableTableFormulas).onChange(
            async (e) => {
              ((this.plugin.settings.enableTableFormulas = e),
                await this.plugin.saveSettings(),
                this.plugin.tableEnhancer?.scheduleRefresh(
                  "table-formula-toggle",
                ));
            },
          );
        }),
      new Setting(e)
        .setName("单元格填充")
        .setDesc(
          "选中表格单元格后，可拖动右下角填充手柄向上下左右复制内容；数字单元格会按 +1 递增。",
        )
        .addToggle((e) => {
          e.setValue(this.plugin.settings.enableTableCellFill).onChange(
            async (e) => {
              ((this.plugin.settings.enableTableCellFill = e),
                await this.plugin.saveSettings(),
                this.plugin.tableEnhancer?.clearActiveFillCell(),
                this.plugin.tableEnhancer?.scheduleRefresh(
                  "table-cell-fill-toggle",
                ));
            },
          );
        }),
      new Setting(e)
        .setName("表格样式")
        .setDesc("为 Markdown 表格选择一种增强样式。")
        .addDropdown((e) => {
          e.addOption("default", "默认样式")
            .addOption("horizontal-lines", "横线样式")
            .addOption("striped-rows", "隔行背景")
            .addOption("horizontal-lines-striped", "横线 + 隔行背景")
            .setValue(
              this.plugin.settings.tableStyleVariant ||
                DEFAULT_SETTINGS.tableStyleVariant,
            )
            .onChange(async (e) => {
              ((this.plugin.settings.tableStyleVariant = e),
                await this.plugin.saveSettings(),
                this.plugin.tableEnhancer?.scheduleRefresh(
                  "table-style-change",
                ));
            });
        }));
  }
}
