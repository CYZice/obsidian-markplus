let obsidian = require("obsidian"),
  { Plugin, MarkdownView, PluginSettingTab, Setting, Menu, setIcon } = obsidian,
  markplusSyntaxTree = null;
function getMarkplusSyntaxTree(e) {
  if (!e) return null;
  if (!markplusSyntaxTree)
    try {
      markplusSyntaxTree = require("@codemirror/language").syntaxTree;
    } catch (e) {
      markplusSyntaxTree = null;
    }
  return markplusSyntaxTree ? markplusSyntaxTree(e) : null;
}
let DEFAULT_SETTINGS = {
    minColumnWidth: 60,
    pixelsPerDash: 12,
    enableTaskSyntaxCompletion: !0,
    enableTableFormulas: !0,
    enableTableCellFill: !0,
    tableStyleVariant: "default",
    tableStripeRowBackgroundLight: "",
    tableStripeRowBackgroundDark: "",
    tableHeaderBackgroundLight: "",
    tableHeaderBackgroundDark: "",
  },
  MARKPLUS_TABLE_STRIPE_ROW_BACKGROUND_VAR =
    "--markplus-table-stripe-row-background",
  MARKPLUS_TABLE_HEADER_BACKGROUND_VAR = "--markplus-table-header-background",
  MARKPLUS_TABLE_COLOR_STYLE_ID = "markplus-table-color-style",
  MARKPLUS_DEFAULT_TABLE_BACKGROUND = "var(--background-primary)",
  TABLE_STYLE_OPTIONS = [
    { value: "default", label: "默认样式" },
    { value: "horizontal-lines", label: "横线样式" },
    { value: "striped-rows", label: "隔行背景色" },
    { value: "horizontal-lines-striped", label: "横线 + 隔行背景色" },
  ],
  TABLE_ALIGNMENT_OPTIONS = [
    { value: "left", label: "居左", icon: "align-left" },
    { value: "center", label: "居中", icon: "align-center" },
    { value: "right", label: "居右", icon: "align-right" },
  ],
  MARKPLUS_TABLE_ALIGNMENT_CLASSES = [
    "markplus-table-align-left",
    "markplus-table-align-center",
    "markplus-table-align-right",
  ],
  MARKPLUS_COLUMN_ALIGNMENT_CLASSES = [
    "markplus-col-align-left",
    "markplus-col-align-center",
    "markplus-col-align-right",
  ],
  FORMULA_PATTERN = /^=\s*(sum|avg|average|count|max|min)\s*(?:\(\s*\))?$/i,
  TABLE_SELECTOR =
    ".markdown-preview-view table, .markdown-reading-view table, .markdown-rendered table, .cm-preview-code-block table, .markdown-source-view.mod-cm6 .cm-table-widget table",
  PREVIEW_TABLE_SELECTOR =
    ".markdown-preview-view table, .markdown-reading-view table, .markdown-rendered table",
  MARKPLUS_DEBUG = !0,
  markplusLogSeq = 0;
function mpLog(e, t) {
  MARKPLUS_DEBUG && (markplusLogSeq += 1);
}
function getTableSpecsDashSignature(e) {
  return Array.isArray(e) && e.length
    ? e
        .map((e) => (e.columns || []).map((e) => e.dashCount).join(","))
        .join("|")
    : "";
}
function summarizeMutations(e) {
  let t = 0,
    a = 0;
  var n,
    r,
    i = [];
  for (n of e)
    [...n.addedNodes, ...n.removedNodes].some(
      (e) =>
        1 === e.nodeType &&
        (e.classList?.contains("markplus-colgroup") ||
          e.classList?.contains("markplus-column-handle") ||
          e.classList?.contains("markplus-table-menu-button") ||
          e.classList?.contains("markplus-cell-fill-handle") ||
          e.classList?.contains("markplus-formula-result") ||
          "COL" === e.tagName),
    )
      ? (t += 1)
      : ((a += 1),
        i.length < 3 &&
          ((r = n.target),
          i.push({
            type: n.type,
            target:
              1 === r?.nodeType
                ? (r.tagName + "." + (r.className || "")).trim()
                : r?.nodeName,
            added: n.addedNodes.length,
            removed: n.removedNodes.length,
          })));
  return {
    total: e.length,
    ownDecorationMutations: t,
    otherMutations: a,
    samples: i,
  };
}
let CP_REQUIRED_MASK = 255,
  CP_VAULT_TTL_MS = 216e5,
  CP_VAULT_SALT = "edge-recall-cp-vault-v2",
  cpCrypto = null;
try {
  cpCrypto = require("crypto");
} catch (e) {
  cpCrypto = null;
}
function cpDecode(e) {
  try {
    return "undefined" != typeof Buffer
      ? Buffer.from(e, "base64").toString("utf8")
      : decodeURIComponent(escape(atob(e)));
  } catch (e) {
    return "";
  }
}
let __cpMeta = Object.freeze({
  get pluginId() {
    return cpDecode("b2JzaWRpYW4tY29udGVudC1wcm90ZWN0aW9u");
  },
  get author() {
    return cpDecode("eXRtYXBz");
  },
  minVersion: "1.3.0",
  get mainMarker() {
    return cpDecode("Q29udGVudFByb3RlY3Rpb25QbHVnaW4=");
  },
  mainSecondaryMarkers: [
    cpDecode("dmVyaWZ5T2ZmbGluZUxpY2Vuc2VMb2NhbGx5"),
    cpDecode("dmVyaWZ5T2ZmbGluZUxpY2Vuc2U="),
    "checkActivation",
    "ObsidianActivationAPI",
    "hasBeenActivated",
    "isActivated",
  ],
  mainMinBytes: 3e4,
});
function __cpLicenseBypassCheck() {
  return !0;
}
function __cpQuickValidateStub() {
  return !0;
}
let __cpVault = null;
function cpInvalidateVault() {
  ((__cpVault = null),
    (__cpMainProbeCache = null),
    (__cpMainProbeCacheKey = ""));
}
function cpVaultActive() {
  return (
    !(!__cpVault || Date.now() > __cpVault.exp) &&
    __cpVault.mask === CP_REQUIRED_MASK &&
    "string" == typeof __cpVault.sig
  );
}
async function cpMintVault(e, t, a) {
  var n = Math.floor(Date.now() / 864e5),
    t = await resolveSecureHash(
      `${e}|${t}|${a.toString(16)}|` + n,
      CP_VAULT_SALT,
    );
  return (
    !!t &&
    ((__cpVault = Object.freeze({
      sig: t,
      mask: a,
      exp: Date.now() + CP_VAULT_TTL_MS,
      tail: e.slice(-6),
    })),
    !0)
  );
}
function compareVersions(e, t) {
  if (!e || !t) return 0;
  try {
    for (
      var a = e.split(".").map((e) => parseInt(e, 10) || 0),
        n = t.split(".").map((e) => parseInt(e, 10) || 0);
      a.length < 3;
    )
      a.push(0);
    for (; n.length < 3; ) n.push(0);
    for (let e = 0; e < 3; e++) {
      if (a[e] < n[e]) return -1;
      if (a[e] > n[e]) return 1;
    }
    return 0;
  } catch (e) {
    return 0;
  }
}
function generateSimpleHash(t) {
  let a = 0;
  if (0 === t.length) return a.toString(16);
  for (let e = 0; e < t.length; e++) {
    var n = t.charCodeAt(e);
    ((a = (a << 5) - a + n), (a &= a));
  }
  return (
    Math.abs(a).toString(16) +
    t.length.toString(16) +
    Date.now().toString(16).slice(-8)
  )
    .padStart(64, "0")
    .slice(0, 64);
}
function generateSecureHash(e, t = null) {
  e = (t = t || `cp_salt_${Math.floor(Date.now() / 864e5)}_security`) + e + t;
  if (cpCrypto && cpCrypto.createHash)
    try {
      var a = cpCrypto.createHash("sha256");
      return (a.update(e), a.digest("hex"));
    } catch (e) {}
  if ("undefined" != typeof window && window.crypto && window.crypto.subtle)
    try {
      return window.crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(e))
        .then((e) =>
          Array.from(new Uint8Array(e))
            .map((e) => e.toString(16).padStart(2, "0"))
            .join(""),
        )
        .catch(() => null);
    } catch (e) {}
  return generateSimpleHash(e);
}
async function resolveSecureHash(e, t = null) {
  e = generateSecureHash(e, t);
  return (e && e.then, e);
}
async function generatePluginFingerprint(e, t) {
  try {
    var a = {
      id: e.id || __cpMeta.pluginId,
      version: e.version,
      author: e.author,
      name: e.name,
      path: t.replace(/\\/g, "/"),
      minAppVersion: e.minAppVersion,
    };
    return await resolveSecureHash(JSON.stringify(a, Object.keys(a).sort()));
  } catch (e) {
    return null;
  }
}
async function validatePluginIntegrity(e, t) {
  try {
    var a, n, r, i, l;
    return (await generatePluginFingerprint(e, t))
      ? ((a = __cpMeta.pluginId),
        (n = __cpMeta.author),
        (r = __cpMeta.minVersion),
        e.id === a &&
          e.author === n &&
          !(
            compareVersions(e.version, r) < 0 ||
            ((i = await resolveSecureHash(
              JSON.stringify({ id: a, author: n }),
            )),
            (l = await resolveSecureHash(
              JSON.stringify({ id: e.id, author: e.author }),
            )),
            !i) ||
            !l ||
            l !== i
          ))
      : !1;
  } catch (e) {
    return !1;
  }
}
function cpProbePluginMemory(e) {
  try {
    var t,
      a,
      n = e.plugins.plugins[__cpMeta.pluginId];
    return n && "function" == typeof n.onload
      ? n.settings && "object" == typeof n.settings
        ? ((a =
            "string" == typeof (t = n.settings).deviceId
              ? t.deviceId.trim()
              : ""),
          !0 !== t.isActivated ||
          !0 !== t.hasBeenActivated ||
          a.length < 8 ||
          /^(.)\1{7,}$/.test(a)
            ? { ok: !1, deviceId: a }
            : { ok: !0, deviceId: a })
        : { ok: !1, deviceId: "" }
      : { ok: !1, deviceId: "" };
  } catch (e) {
    return { ok: !1, deviceId: "" };
  }
}
function cpValidateActivationShape(e) {
  if (!e || "object" != typeof e) return !1;
  if (!0 !== e.isActivated || !0 !== e.hasBeenActivated) return !1;
  var t = "string" == typeof e.deviceId ? e.deviceId.trim() : "";
  if (t.length < 8) return !1;
  var a = e.authSession;
  if (a && "object" == typeof a) {
    var n = a.offlineLicense;
    if ("string" == typeof n && n.includes(".") && 32 < n.length) return !0;
    n = a.sessionToken;
    if ("string" == typeof n && 20 < n.length) return !0;
  }
  return !0 === e.hasBeenActivated && 8 <= t.length;
}
async function cpProbeActivationFile(e, t) {
  try {
    var a = await e.vault.adapter.read(t),
      n = JSON.parse(a);
    return cpValidateActivationShape(n)
      ? { ok: !0, deviceId: String(n.deviceId).trim() }
      : { ok: !1, deviceId: "" };
  } catch (e) {
    return { ok: !1, deviceId: "" };
  }
}
let __cpMainProbeCache = null,
  __cpMainProbeCacheKey = "";
function cpScoreMainScriptSource(e, t) {
  if (!e || e.length < __cpMeta.mainMinBytes) return 0;
  if (t && t < __cpMeta.mainMinBytes) return 0;
  let a = 0,
    n =
      (e.includes(__cpMeta.mainMarker) && (a += 3),
      e.includes(__cpMeta.pluginId) && (a += 1),
      0);
  for (var r of __cpMeta.mainSecondaryMarkers) r && e.includes(r) && n++;
  return (a += Math.min(n, 3));
}
function cpProbeMainScriptFromSource(e, t) {
  return 4 <= cpScoreMainScriptSource(e, t);
}
async function cpProbeMainScript(e, t, a = "") {
  a = t + "::" + a;
  if (__cpMainProbeCacheKey === a && null !== __cpMainProbeCache)
    return __cpMainProbeCache;
  try {
    var n,
      r,
      i = obsidian.normalizePath(t + "/main.js");
    return (await e.vault.adapter.exists(i))
      ? ((n = await e.vault.adapter.stat(i)),
        (r = cpProbeMainScriptFromSource(
          await e.vault.adapter.read(i),
          n?.size,
        )),
        (__cpMainProbeCache = r),
        (__cpMainProbeCacheKey = a),
        r)
      : ((__cpMainProbeCache = !1), (__cpMainProbeCacheKey = a), !1);
  } catch (e) {
    return ((__cpMainProbeCache = !1), (__cpMainProbeCacheKey = a), !1);
  }
}
async function cpRunSecurityPipeline(e) {
  let t = 0;
  try {
    if (!e?.plugins?.enabledPlugins?.has(__cpMeta.pluginId)) return 0;
    ((t |= 1), e?.vault?.adapter && e?.plugins?.plugins && (t |= 128));
    var a = obsidian.normalizePath(
        e.vault.configDir + "/plugins/" + __cpMeta.pluginId,
      ),
      n = a + "/manifest.json",
      r = a + "/data.json",
      i = await e.vault.adapter.read(n),
      l = JSON.parse(i),
      s =
        (l.id === __cpMeta.pluginId &&
          l.author === __cpMeta.author &&
          0 <= compareVersions(l.version, __cpMeta.minVersion) &&
          (t |= 2),
        (await validatePluginIntegrity(l, a)) && (t |= 4),
        await resolveSecureHash(`${l.id}:${l.author}:` + l.version)),
      o = (s && (t |= 8), cpProbePluginMemory(e)),
      h = await cpProbeActivationFile(e, r),
      u =
        ((o.ok || h.ok) && (t |= 16),
        !h.ok || (o.ok && h.deviceId !== o.deviceId) || (t |= 32),
        (await cpProbeMainScript(e, a, l.version)) && (t |= 64),
        (o.ok ? o.deviceId : "") || (h.ok ? h.deviceId : ""));
    t === CP_REQUIRED_MASK && u
      ? await cpMintVault(u, l.version, t)
      : cpInvalidateVault();
  } catch (e) {
    return (cpInvalidateVault(), 0);
  }
  return t;
}
function cpAssertVaultActive() {
  return (
    !(!__cpLicenseBypassCheck() || !__cpQuickValidateStub()) && cpVaultActive()
  );
}
class MarkPlusPlugin extends Plugin {
  async onload() {
    ((this.isContentProtectionActivated = !1),
      (this._pluginInitialized = !1),
      (this._cpWatchRegistered = !1));
    var e = await this.validateContentProtectionPlugin();
    e.ok
      ? ((this.isContentProtectionActivated = !0),
        await this.initializePluginFeatures())
      : (this.showContentProtectionRequired(e.mask),
        this.addSettingTab(new MarkPlusSettingTab(this.app, this)),
        this.registerContentProtectionWatch());
  }
  getContentProtectionPaths() {
    var e = obsidian.normalizePath(
      this.app.vault.configDir + "/plugins/" + __cpMeta.pluginId,
    );
    return {
      manifestPath: e + "/manifest.json",
      pluginPath: e,
      dataPath: e + "/data.json",
    };
  }
  _cpAssertTrust() {
    return (
      !!this.isContentProtectionActivated &&
      !!cpAssertVaultActive() &&
      ((this._cpRuntimeChecks = (this._cpRuntimeChecks || 0) + 1),
      this._cpRuntimeChecks % 24 == 0 &&
        this.validateContentProtectionPlugin().then((e) => {
          e.ok || this._cpHandleTrustLoss();
        }),
      !0)
    );
  }
  _cpHandleTrustLoss() {
    (cpInvalidateVault(),
      (this.isContentProtectionActivated = !1),
      this.tableEnhancer &&
        (this.tableEnhancer.destroy(), (this.tableEnhancer = null)));
  }
  async validateContentProtectionPlugin() {
    try {
      var e = await cpRunSecurityPipeline(this.app),
        t = e === CP_REQUIRED_MASK && cpVaultActive();
      return (t || cpInvalidateVault(), { ok: t, mask: e });
    } catch (e) {
      return (cpInvalidateVault(), { ok: !1, mask: 0 });
    }
  }
  showContentProtectionRequired(e = 0) {
    this.app.plugins.enabledPlugins.has(__cpMeta.pluginId) &&
      0 < e &&
      new obsidian.Notice("请先启用 Content Protection 插件");
  }
  registerContentProtectionWatch() {
    this._cpWatchRegistered ||
      ((this._cpWatchRegistered = !0),
      this.registerInterval(async () => {
        this._pluginInitialized ||
          ((await this.validateContentProtectionPlugin()).ok &&
            ((this.isContentProtectionActivated = !0),
            await this.initializePluginFeatures()));
      }, 3e4));
  }
  async checkAndUpdateContentProtectionStatus() {
    !(await this.validateContentProtectionPlugin()).ok &&
      this.isContentProtectionActivated &&
      this._cpHandleTrustLoss();
  }
  installPreviewRenderHook() {
    let e = obsidian.MarkdownPreviewView;
    if (e?.prototype) {
      let a = e.prototype.onRenderComplete;
      if ("function" == typeof a) {
        let t = this.tableEnhancer;
        ((e.prototype.onRenderComplete = function (...e) {
          e = a.apply(this, e);
          return (
            t &&
              this.file?.path &&
              this.containerEl &&
              (mpLog("preview-render-complete", { file: this.file.path }),
              window.requestAnimationFrame(() => {
                t.applyReadingPresentationForPreview(
                  this,
                  "preview-render-complete",
                );
              })),
            e
          );
        }),
          this.register(() => {
            e.prototype.onRenderComplete = a;
          }));
      }
    }
  }
  async initializePluginFeatures() {
    if (!this._pluginInitialized) {
      if (!cpVaultActive())
        if (!(await this.validateContentProtectionPlugin()).ok) return;
      this._pluginInitialized = !0;
      var e = await this.loadData(),
        t = e && Object.prototype.hasOwnProperty.call(e, "tableStyles"),
        a = migrateLegacyTableColorSettings(e);
      ((this.settings = Object.assign({}, DEFAULT_SETTINGS, e)),
        delete this.settings.tableStyles,
        delete this.settings.tableStripeRowBackground,
        delete this.settings.tableHeaderBackground,
        (this.tableEnhancer = new TableColumnResizeController(this)),
        (t || a) && this.saveSettings(),
        this.applyTableStyleVariables(),
        this.register(() => {
          document.getElementById(MARKPLUS_TABLE_COLOR_STYLE_ID)?.remove();
        }),
        this.addSettingTab(new MarkPlusSettingTab(this.app, this)),
        this.registerEvent(
          this.app.workspace.on("layout-change", () => {
            (this.tableEnhancer.scheduleRefresh("layout-change"),
              this.tableEnhancer.syncReadingPresentation("layout-change"));
          }),
        ),
        this.registerEvent(
          this.app.workspace.on("active-leaf-change", () => {
            (this.tableEnhancer.scheduleRefresh("active-leaf-change"),
              this.tableEnhancer.syncReadingPresentation("active-leaf-change"));
          }),
        ),
        this.registerEvent(
          this.app.workspace.on("file-open", () => {
            (this.tableEnhancer.scheduleRefresh("file-open"),
              this.tableEnhancer.syncReadingPresentation("file-open"));
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
        this.registerMarkdownPostProcessor((e, t) =>
          this.tableEnhancer.processPreviewSectionTables(e, t),
        ),
        this.installPreviewRenderHook(),
        this.tableEnhancer.scheduleRefresh("onload"),
        this.registerInterval(() => {
          this.checkAndUpdateContentProtectionStatus();
        }, 3e5));
    }
  }
  onunload() {
    (cpInvalidateVault(),
      (this._pluginInitialized = !1),
      (this.isContentProtectionActivated = !1),
      this.tableEnhancer &&
        (this.tableEnhancer.destroy(), (this.tableEnhancer = null)));
  }
  async saveSettings() {
    this._cpAssertTrust() &&
      (await this.saveData(this.settings), this.applyTableStyleVariables());
  }
  applyTableStyleVariables() {
    let e = document.getElementById(MARKPLUS_TABLE_COLOR_STYLE_ID);
    e ||
      (((e = document.createElement("style")).id =
        MARKPLUS_TABLE_COLOR_STYLE_ID),
      document.head.appendChild(e));
    var t = [];
    (appendTableColorThemeRule(
      t,
      "theme-light",
      MARKPLUS_TABLE_STRIPE_ROW_BACKGROUND_VAR,
      this.settings.tableStripeRowBackgroundLight,
    ),
      appendTableColorThemeRule(
        t,
        "theme-dark",
        MARKPLUS_TABLE_STRIPE_ROW_BACKGROUND_VAR,
        this.settings.tableStripeRowBackgroundDark,
      ),
      appendTableColorThemeRule(
        t,
        "theme-light",
        MARKPLUS_TABLE_HEADER_BACKGROUND_VAR,
        this.settings.tableHeaderBackgroundLight,
      ),
      appendTableColorThemeRule(
        t,
        "theme-dark",
        MARKPLUS_TABLE_HEADER_BACKGROUND_VAR,
        this.settings.tableHeaderBackgroundDark,
      ),
      (e.textContent = t.join("\n")));
  }
}
module.exports = MarkPlusPlugin;
class TableColumnResizeController {
  constructor(e) {
    ((this.plugin = e),
      (this.handleMap = new WeakMap()),
      (this.menuButtonMap = new WeakMap()),
      (this.cellFillHandleMap = new WeakMap()),
      (this.observerMap = new WeakMap()),
      (this.scrollListenerMap = new WeakMap()),
      (this.fileTableSnapshots = new Map()),
      (this.fileMarkdownSnapshots = new Map()),
      (this.readingRenderMatchState = new Map()),
      (this.internalChangeBudget = new Map()),
      (this.isComposing = !1),
      (this.dragState = null),
      (this.fillState = null),
      (this.fillDragState = null),
      (this.pendingRefreshReason = null),
      (this.refreshTimer = null),
      (this.previewRefreshTimer = null),
      (this.pendingPreviewRefresh = null),
      (this.previewRefreshInFlight = null),
      (this.previewDecorateState = new Map()),
      (this.tableLayoutObserverMap = new WeakMap()),
      (this.tableLayoutObserver = null),
      (this.boundEditorWidthSliderInput =
        this.onEditorWidthSliderInput.bind(this)),
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
      ),
      this.plugin.registerDomEvent(
        document,
        "input",
        this.boundEditorWidthSliderInput,
        { capture: !0 },
      ));
  }
  destroy() {
    (window.clearTimeout(this.refreshTimer),
      window.clearTimeout(this.previewRefreshTimer),
      this.tableLayoutObserver &&
        (this.tableLayoutObserver.disconnect(),
        (this.tableLayoutObserver = null)),
      this.disconnectObservers(),
      this.stopDragging(),
      this.stopFillDragging(),
      this.clearActiveFillCell(),
      this.readingRenderMatchState.clear(),
      this.previewDecorateState.clear());
  }
  scheduleRefresh(e) {
    this.fillDragState
      ? ((this.pendingRefreshReason = e || "(unknown)"),
        mpLog("scheduleRefresh:defer-fill-drag", this.pendingRefreshReason))
      : (mpLog("scheduleRefresh", e || "(unknown)"),
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
    if (this.isComposing || this.fillDragState)
      mpLog("refreshAllTables:skip-composing");
    else {
      var e;
      mpLog("refreshAllTables:start");
      for (e of this.plugin.app.workspace.getLeavesOfType("markdown")) {
        let l = e.view;
        if (l instanceof MarkdownView) {
          var t = l.file;
          if (t && l.contentEl)
            if (
              (this.ensureObserver(l.contentEl),
              "function" == typeof l.getMode && "preview" === l.getMode())
            )
              mpLog("refreshAllTables:skip-preview-mode", { file: t.path });
            else {
              var a = await this.getMarkdownSource(l);
              let n = extractMarkdownTableSpecs(a);
              (this.fileTableSnapshots.set(t.path, n),
                this.fileMarkdownSnapshots.set(t.path, a));
              a = this.queryTablesForView(l);
              mpLog("refreshAllTables:tables", {
                file: t.path,
                tableCount: a.length,
                specCount: n.length,
              });
              let r = new Set(),
                i = a.length === n.length;
              a.forEach((e, t) => {
                var a = this.matchSpecForTable(e, n, r, i ? t : null, l);
                this.decorateTable(e, a, l, t, "refreshAllTables");
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
        let o = t.view;
        if (o instanceof MarkdownView && o.contentEl === e) {
          var a = o.file;
          if (!a) return;
          let i = this.ensureTableSpecsForFile(a.path, o);
          var n = this.queryTablesForView(o);
          mpLog("reapplyWidthsFromCache", {
            file: a.path,
            mode: o.getMode?.() || "(unknown)",
            tableCount: n.length,
            specCount: i.length,
          });
          let l = new Set(),
            s = n.length === i.length;
          return void n.forEach((e, t) => {
            var a, n, r;
            e instanceof HTMLTableElement &&
              ((a = Array.from(e.rows)),
              (a = Math.max(...a.map((e) => e.cells.length), 0)) < 1 ||
                ((n = this.matchSpecForTable(e, i, l, s ? t : null, o)),
                (r = e.querySelector(":scope > colgroup.markplus-colgroup")),
                n && (!r || "true" !== r.dataset.markplusInitialized)
                  ? this.decorateTable(e, n, o, t, "reapplyWidthsFromCache")
                  : ((t = this.getWidthsForTable(e, n, a)),
                    r
                      ? this.applyWidthsToColgroup(e, r, t)
                      : n && this.applyColumnWidthStyles(e, t))));
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
            var r = a.getValue(),
              n = extractMarkdownTableSpecs(r);
            if (
              (this.fileMarkdownSnapshots.set(e, r),
              this.consumeInternalChangeBudget(e))
            )
              (mpLog("handleEditorChange:internal-change-consumed", {
                filePath: e,
              }),
                this.fileTableSnapshots.set(e, n),
                this.scheduleRefresh("editor-change-internal"));
            else {
              var t,
                i = this.fileTableSnapshots.get(e) || [],
                l = [];
              for (let t of n) {
                var s,
                  o,
                  h,
                  u,
                  c,
                  d,
                  p,
                  g = i.find(
                    (e) => e.separatorLineIndex === t.separatorLineIndex,
                  );
                g &&
                  ((s = g.rawHeaderLine !== t.rawHeaderLine),
                  (o = g.rawSeparatorLine !== t.rawSeparatorLine),
                  (h = g.columns.length === t.columns.length),
                  (u = g.columns.length !== t.columns.length),
                  (c = !areStringArraysEqual(g.bodyLines, t.bodyLines)),
                  (d = h ? reorderColumnsByHeader(g, t) : null),
                  (p = s ? transferColumnsToCurrentLayout(g, t) : null),
                  s && d
                    ? l.push({
                        lineIndex: t.separatorLineIndex,
                        line: buildSeparatorLineFromColumns(d),
                      })
                    : s && u && 0 < p?.matchedCount
                      ? l.push({
                          lineIndex: t.separatorLineIndex,
                          line: buildSeparatorLineFromColumns(p.columns),
                        })
                      : o &&
                        h &&
                        (s || c) &&
                        l.push({
                          lineIndex:
                            findSeparatorLineForSpec(r, t) ??
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
    var n, r, i, l;
    return (
      !!this.plugin.settings.enableTaskSyntaxCompletion &&
      "function" == typeof e.getCursor &&
      "function" == typeof e.getLine &&
      "function" == typeof e.replaceRange &&
      !(
        !(n = e.getCursor()) ||
        "number" != typeof n.line ||
        "number" != typeof n.ch ||
        "string" != typeof (r = e.getLine(n.line)) ||
        ((i = r.slice(0, n.ch)),
        (l = r.slice(n.ch)),
        (a = getLineAt(a, n.line)),
        !/^\s*-\s(?:\[|【)$/.test(i)) ||
        0 < l.length ||
        !isLikelyTaskSyntaxInsertion(a, r) ||
        (this.markInternalChange(t),
        i.endsWith("【")
          ? e.replaceRange("[ ] ", { line: n.line, ch: n.ch - 1 }, n)
          : e.replaceRange(" ] ", n),
        "function" == typeof e.setCursor &&
          e.setCursor({ line: n.line, ch: n.ch + 3 }),
        0)
      )
    );
  }
  async getMarkdownSource(e) {
    return e?.file?.path
      ? this.getMarkdownForFile(e.file.path)
      : e.editor && "function" == typeof e.editor.getValue
        ? e.editor.getValue()
        : "";
  }
  async getMarkdownForFile(t) {
    if (t) {
      var e = this.resolveViewForFile(t);
      if (e?.editor && "function" == typeof e.editor.getValue) {
        e = e.editor.getValue();
        if ("string" == typeof e && e.trim()) return e;
      }
      e = this.fileMarkdownSnapshots.get(t);
      if ("string" == typeof e && e.trim()) return e;
      e = this.plugin.app.vault.getAbstractFileByPath(t);
      if (e)
        try {
          var a = await this.plugin.app.vault.cachedRead(e);
          if ("string" == typeof a && a.trim())
            return (this.fileMarkdownSnapshots.set(t, a), a);
        } catch (e) {
          mpLog("getMarkdownForFile:vault-read-failed", {
            filePath: t,
            error: String(e),
          });
        }
    }
    return "";
  }
  ensureTableSpecsForFile(e, t) {
    let a = this.fileTableSnapshots.get(e) || [];
    return (
      a.length ||
        ("string" ==
          typeof (t =
            t?.editor?.getValue?.() ||
            this.fileMarkdownSnapshots.get(e) ||
            "") &&
          t.trim() &&
          ((a = extractMarkdownTableSpecs(t)),
          this.fileTableSnapshots.set(e, a),
          this.fileMarkdownSnapshots.set(e, t))),
      a
    );
  }
  findViewForContainer(e) {
    var t;
    for (t of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      var a = t.view;
      if (a instanceof MarkdownView && a.contentEl === e) return a;
    }
    return null;
  }
  queryTablesForView(e) {
    var t;
    return e instanceof MarkdownView
      ? "function" == typeof e.getMode && "preview" === e.getMode()
        ? (t = e.previewMode?.containerEl)
          ? Array.from(t.querySelectorAll(PREVIEW_TABLE_SELECTOR))
          : []
        : e.contentEl
          ? Array.from(e.contentEl.querySelectorAll(TABLE_SELECTOR)).filter(
              (e) => !isReadingModeTable(e),
            )
          : []
      : [];
  }
  resolveViewForFile(e) {
    var t;
    for (t of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      var a = t.view;
      if (a instanceof MarkdownView && a.file?.path === e) return a;
    }
    var n = this.plugin.app.vault.getAbstractFileByPath(e);
    return n ? { file: n } : null;
  }
  getReadingMatchState(e, t) {
    var a = this.readingRenderMatchState.get(e);
    return (
      (a && a.docId === t) ||
        ((a = { docId: t, usedSpecs: new Set() }),
        this.readingRenderMatchState.set(e, a)),
      a.usedSpecs
    );
  }
  async processPreviewSectionTables(s, o) {
    if (
      s &&
      o?.sourcePath &&
      !this.isComposing &&
      !this.dragState &&
      !s.closest(".markdown-source-view, .cm-table-widget")
    ) {
      var e = s.querySelectorAll("table");
      if (e.length)
        if (this.plugin.app.vault.getAbstractFileByPath(o.sourcePath)) {
          let n = this.getReadingMatchState(o.sourcePath, o.docId);
          var t = await this.getMarkdownForFile(o.sourcePath);
          let r = extractMarkdownTableSpecs(t),
            i =
              (this.fileTableSnapshots.set(o.sourcePath, r),
              this.fileMarkdownSnapshots.set(o.sourcePath, t),
              this.resolveViewForFile(o.sourcePath)),
            l = o.getSectionInfo?.(s);
          (mpLog("processPreviewSectionTables", {
            sourcePath: o.sourcePath,
            tableCount: e.length,
            specCount: r.length,
            lineStart: l?.lineStart ?? null,
            lineEnd: l?.lineEnd ?? null,
            docId: o.docId,
          }),
            e.forEach((t, a) => {
              if (t instanceof HTMLTableElement) {
                let e = matchSpecForSection(s, o, t, r, n, a);
                (e = e || this.matchSpecForTable(t, r, n, a, i))
                  ? this.decorateTable(
                      t,
                      e,
                      i,
                      e.tableOrdinal ?? a,
                      "post-processor",
                    )
                  : (this.applyTableStyleClasses(t),
                    this.alignPreviewTableWrapper(t),
                    mpLog("processPreviewSectionTables:style-only", {
                      index: a,
                      lineStart: l?.lineStart ?? null,
                      lineEnd: l?.lineEnd ?? null,
                      styleVariant: this.plugin.settings.tableStyleVariant,
                    }));
              }
            }),
            this.previewDecorateState.set(o.sourcePath, {
              at: Date.now(),
              docId: o.docId,
              dashSignature: getTableSpecsDashSignature(r),
              source: "post-processor",
            }));
        }
    }
  }
  schedulePreviewRefresh(e, t) {
    e?.containerEl &&
      e.file?.path &&
      (mpLog("schedulePreviewRefresh", {
        reason: t || "(unknown)",
        file: e.file.path,
      }),
      (this.pendingPreviewRefresh = {
        previewView: e,
        reason: t || "(unknown)",
      }),
      window.clearTimeout(this.previewRefreshTimer),
      (this.previewRefreshTimer = window.setTimeout(() => {
        var e = this.pendingPreviewRefresh;
        ((this.pendingPreviewRefresh = null),
          e?.previewView &&
            this.refreshPreviewContainer(e.previewView, e.reason).catch((e) =>
              console.error("MarkPlus preview refresh failed", e),
            ));
      }, 150)));
  }
  schedulePreviewContainerRefresh(e, t) {
    this.schedulePreviewRefresh(e, t || "preview-render-complete");
  }
  applyTableStyleClasses(e) {
    var t;
    e instanceof HTMLTableElement &&
      ((e.className = e.className
        .split(/\s+/)
        .filter((e) => e && !e.startsWith("markplus-table-style-"))
        .join(" ")),
      e.classList.add("markplus-resizable-table"),
      (t =
        this.plugin.settings.tableStyleVariant ||
        DEFAULT_SETTINGS.tableStyleVariant),
      (e.dataset.markplusStyle = t),
      e.classList.add("markplus-table-style-" + t));
  }
  applyReadingPresentationForPreview(e, t = "(unknown)") {
    var a = e?.containerEl,
      e = e?.file?.path;
    if (a && e) {
      a = a.querySelectorAll(PREVIEW_TABLE_SELECTOR);
      if (a.length) {
        let n =
            this.plugin.settings.tableStyleVariant ||
            DEFAULT_SETTINGS.tableStyleVariant,
          r = 0,
          i = 0;
        (a.forEach((e) => {
          var t, a;
          e instanceof HTMLTableElement &&
            ((t = e.dataset.markplusStyle),
            (a = e.classList.contains("markplus-table-style-" + n)),
            this.applyTableStyleClasses(e),
            this.alignPreviewTableWrapper(e),
            (r += 1),
            (t === n && a) || (i += 1));
        }),
          mpLog("applyReadingPresentationForPreview", {
            reason: t,
            file: e,
            tableCount: a.length,
            styledCount: r,
            repairedCount: i,
            styleVariant: n,
          }));
      }
    }
  }
  syncReadingPresentation(a = "(unknown)") {
    window.requestAnimationFrame(() => {
      var e;
      for (e of this.plugin.app.workspace.getLeavesOfType("markdown")) {
        var t = e.view;
        t instanceof MarkdownView &&
          "preview" === t.getMode?.() &&
          t.previewMode?.containerEl &&
          this.applyReadingPresentationForPreview(t.previewMode, a);
      }
    });
  }
  async syncPreviewAfterMarkdownChange(e) {
    var t, a;
    e instanceof MarkdownView &&
      e.file?.path &&
      ((t = e.file.path),
      "string" == typeof (a = e.editor?.getValue?.()) &&
        (this.fileMarkdownSnapshots.set(t, a),
        this.fileTableSnapshots.set(t, extractMarkdownTableSpecs(a))),
      this.readingRenderMatchState.delete(t),
      (a = e.previewMode)) &&
      (this.previewDecorateState.delete(t),
      "function" == typeof a.rerender
        ? (mpLog("syncPreviewAfterMarkdownChange:rerender", { file: t }),
          a.rerender(!0))
        : a.containerEl &&
          (await this.refreshPreviewContainer(a, "sync-markdown-change")));
  }
  async refreshPreviewContainer(e, o = "(unknown)") {
    if (this.isComposing || this.dragState)
      mpLog("refreshPreviewContainer:skip", {
        reason: o,
        state: this.isComposing ? "composing" : "dragging",
      });
    else {
      var t = e.file,
        e = e.containerEl;
      if (t?.path && e)
        if (this.previewRefreshInFlight === t.path)
          mpLog("refreshPreviewContainer:skip-inflight", {
            reason: o,
            file: t.path,
          });
        else {
          var a = await this.getMarkdownForFile(t.path);
          let s = extractMarkdownTableSpecs(a);
          var h = getTableSpecsDashSignature(s),
            u = this.resolveViewForFile(t.path),
            u =
              u?.editor && "function" == typeof u.editor.getValue
                ? "editor"
                : this.fileMarkdownSnapshots.has(t.path)
                  ? "snapshot"
                  : "vault",
            c = this.previewDecorateState.get(t.path),
            d = Date.now();
          if (
            c &&
            c.dashSignature === h &&
            d - c.at < 250 &&
            "post-processor" === c.source &&
            "sync-markdown-change" !== o &&
            "force" !== o
          )
            mpLog("refreshPreviewContainer:skip-recent-post-processor", {
              reason: o,
              file: t.path,
              ageMs: d - c.at,
              dashSignature: h,
            });
          else {
            e = e.querySelectorAll(PREVIEW_TABLE_SELECTOR);
            if (e.length) {
              this.previewRefreshInFlight = t.path;
              try {
                (this.fileTableSnapshots.set(t.path, s),
                  this.fileMarkdownSnapshots.set(t.path, a));
                let n = new Set(),
                  r = e.length === s.length,
                  i = this.resolveViewForFile(t.path),
                  l = [];
                (mpLog("refreshPreviewContainer:start", {
                  reason: o,
                  file: t.path,
                  markdownSource: u,
                  tableCount: e.length,
                  specCount: s.length,
                  dashSignature: h,
                  previousSource: c?.source || null,
                  previousAgeMs: c ? d - c.at : null,
                }),
                  e.forEach((e, t) => {
                    var a;
                    e instanceof HTMLTableElement &&
                      ((a = this.matchSpecForTable(e, s, n, r ? t : null, i)),
                      l.push({
                        index: t,
                        ordinal: a?.tableOrdinal ?? null,
                        separatorLineIndex: a?.separatorLineIndex ?? null,
                        dashCounts: a
                          ? a.columns.map((e) => e.dashCount)
                          : null,
                        tableOrdinalDataset:
                          e.dataset.markplusTableOrdinal || null,
                      }),
                      this.decorateTable(e, a, i, t, o));
                  }),
                  this.previewDecorateState.set(t.path, {
                    at: Date.now(),
                    dashSignature: h,
                    source: o,
                    tableCount: e.length,
                  }),
                  mpLog("refreshPreviewContainer:done", {
                    reason: o,
                    file: t.path,
                    decorateResults: l,
                  }));
              } finally {
                this.previewRefreshInFlight === t.path &&
                  (this.previewRefreshInFlight = null);
              }
            } else
              mpLog("refreshPreviewContainer:no-tables", {
                reason: o,
                file: t.path,
              });
          }
        }
    }
  }
  matchSpecForTable(e, i, l, t, s = null) {
    if (Array.isArray(i) && i.length) {
      var o = getTableMatchIndex(e, t);
      if (null != o && 0 <= o && o < i.length && !l.has(o))
        return (l.add(o), i[o]);
      if (s) {
        o = matchSpecBySourceLine(s, e, i, l);
        if (o) return o;
      }
      o = domTableBodySignature(e);
      if (o) {
        var h = matchSpecIndexesByBodySignature(o, i, l);
        if (1 === h.length) return (l.add(h[0]), i[h[0]]);
      }
      let a = Number.parseInt(e?.dataset?.markplusSeparatorLine ?? "", 10);
      if (Number.isInteger(a) && 0 <= a) {
        h = i.findIndex((e, t) => !l.has(t) && e.separatorLineIndex === a);
        if (0 <= h) return (l.add(h), i[h]);
      }
      let n = getDomTableColumnCount(e),
        r = domTableContentSignature(e);
      if (r) {
        let t = [];
        for (let e = 0; e < i.length; e += 1)
          l.has(e) || (specContentSignature(i[e]) === r && t.push(e));
        if (0 < n && 1 < t.length) {
          h = t.filter((e) => i[e].headerCells.length === n);
          if (1 === h.length) return (l.add(h[0]), i[h[0]]);
          0 < h.length && (t = h);
        }
        if (1 === t.length) return (l.add(t[0]), i[t[0]]);
      }
      var u = domTableHeaderSignature(e);
      if (u) {
        let t = [];
        for (let e = 0; e < i.length; e += 1)
          l.has(e) || (specHeaderSignature(i[e]) === u && t.push(e));
        if (0 < n && 1 < t.length) {
          h = t.filter((e) => i[e].headerCells.length === n);
          if (1 === h.length) return (l.add(h[0]), i[h[0]]);
          0 < h.length && (t = h);
        }
        if (1 < t.length && o) {
          h = matchSpecIndexesByBodySignature(o, i, l, t);
          if (1 === h.length) return (l.add(h[0]), i[h[0]]);
        }
        if (1 < t.length && r) {
          h = t.filter((e) => specContentSignature(i[e]) === r);
          if (1 === h.length) return (l.add(h[0]), i[h[0]]);
        }
        if (1 === t.length) return (l.add(t[0]), i[t[0]]);
      }
      if (null != t && 0 <= t && t < i.length && !l.has(t))
        return (l.add(t), i[t]);
      mpLog("matchSpecForTable:miss", {
        columnCount: n,
        headerSignature: u,
        contentSignature: r,
        bodySignature: o,
        separatorLine: Number.isInteger(a) ? a : null,
        sourceLine: s ? getTableSourceLineForDomTable(s, e) : null,
      });
    }
    return null;
  }
  decorateTable(e, t, a, n, r = "(unknown)") {
    var i, l, s, o;
    e instanceof HTMLTableElement &&
      ((i = Array.from(e.rows)),
      (i = Math.max(...i.map((e) => e.cells.length), 0)) < 1 ||
        (this.applyTableStyleClasses(e),
        (e.dataset.markplusTableIndex = String(n)),
        !t && isReadingModeTable(e)
          ? (this.alignPreviewTableWrapper(e),
            mpLog("decorateTable:reading-style-only-no-spec", {
              decorateSource: r,
              tableIndex: n,
              styleVariant: e.dataset.markplusStyle,
            }))
          : t &&
            (Number.isInteger(t?.tableOrdinal)
              ? (e.dataset.markplusTableOrdinal = String(t.tableOrdinal))
              : delete e.dataset.markplusTableOrdinal,
            Number.isInteger(t?.separatorLineIndex)
              ? (e.dataset.markplusSeparatorLine = String(t.separatorLineIndex))
              : delete e.dataset.markplusSeparatorLine,
            (s =
              "true" ===
              (l = this.ensureColgroup(e, i)).dataset.markplusInitialized),
            (l.dataset.markplusInitialized = "true"),
            (o = this.getWidthsForTable(e, t, i)),
            mpLog("decorateTable", {
              decorateSource: r,
              mode: isReadingModeTable(e) ? "reading" : "live-preview",
              tableIndex: n,
              tableOrdinal: t?.tableOrdinal ?? null,
              separatorLineIndex: t?.separatorLineIndex ?? null,
              columnCount: i,
              widths: o,
              percents: toColumnPercents(o),
              hadColgroup: s,
              dashCounts: t ? t.columns.map((e) => e.dashCount) : null,
              styleVariant: e.dataset.markplusStyle,
            }),
            this.applyWidthsToColgroup(e, l, o),
            this.applyTableColumnAlignment(e, t.columns),
            this.applyTableFormulas(e, t),
            isReadingModeTable(e)
              ? this.removeResizeHandles(e)
              : (this.bindTableHoverTracking(e),
                this.syncHandleCount(e, i, t, a),
                this.syncMenuButton(e, t, a),
                this.bindTableCellFill(e),
                this.syncActiveFillCell(e, t, a)))));
  }
  applyTableFormulas(t, a) {
    if (this.plugin.settings.enableTableFormulas) {
      t = Array.from(t.rows);
      if (!(t.length < 2)) {
        var n = t[t.length - 1];
        let o = t.slice(1, t.length - 1);
        var r,
          t = n.cells.length;
        let e = null,
          h = null;
        (a &&
          Array.isArray(a.bodyLines) &&
          a.bodyLines.length &&
          (r = splitMarkdownRow((a = a.bodyLines)[a.length - 1]).map((e) =>
            e.trim(),
          )).length === t &&
          ((e = r),
          (h = a
            .slice(0, -1)
            .map((e) => splitMarkdownRow(e).map((e) => e.trim())))),
          Array.from(n.cells).forEach((t, a) => {
            if (!isCellBeingEdited(t)) {
              var n = e
                ? parseFormulaName(e[a])
                : t.dataset.markplusFormula || parseFormulaName(t.textContent);
              if (n) {
                t.dataset.markplusFormula = n;
                var r = [];
                if (h)
                  for (var i of h) {
                    i = parseNumericValue(i[a]);
                    null !== i && r.push(i);
                  }
                else
                  for (var l of o) {
                    var l = l.cells[a];
                    l &&
                      null !== (l = parseNumericValue(l.textContent)) &&
                      r.push(l);
                  }
                var s = formatFormulaResult(computeFormulaResult(n, r));
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
  ensureObserver(i) {
    var e;
    this.observerMap.has(i) ||
      ((e = new MutationObserver((e) => {
        var a = summarizeMutations(e);
        if (0 !== a.otherMutations) {
          var n = this.findViewForContainer(i);
          let t = n?.previewMode?.containerEl;
          var r = "preview" === n?.getMode?.(),
            e =
              r &&
              t &&
              e.every((e) =>
                [e.target, ...e.addedNodes, ...e.removedNodes].every(
                  (e) => !(e instanceof Node) || t.contains(e),
                ),
              );
          r || e
            ? mpLog("mutation-observer:skip-preview", {
                ...a,
                mode: n?.getMode?.() || "(unknown)",
              })
            : (mpLog("mutation-observer", {
                ...a,
                mode: n?.getMode?.() || "(unknown)",
              }),
              this.reapplyWidthsFromCache(i),
              this.scheduleRefresh("mutation-observer"));
        }
      })).observe(i, { childList: !0, subtree: !0 }),
      this.observerMap.set(i, e),
      this.ensureScrollRefresh(i));
  }
  ensureScrollRefresh(t) {
    t = t.querySelector(".cm-scroller");
    if (t && !this.scrollListenerMap.has(t)) {
      let e = { timer: null };
      var a = () => {
        this.dragState ||
          this.fillDragState ||
          this.isComposing ||
          (window.clearTimeout(e.timer),
          (e.timer = window.setTimeout(() => {
            this.scheduleRefresh("cm-scroll");
          }, 150)));
      };
      (t.addEventListener("scroll", a, { passive: !0 }),
        this.scrollListenerMap.set(t, { onScroll: a, state: e }));
    }
  }
  disconnectObservers() {
    var e;
    for (e of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      var t = e.view?.contentEl,
        a = t ? this.observerMap.get(t) : null,
        a = (a && a.disconnect(), t?.querySelector(".cm-scroller")),
        t = a ? this.scrollListenerMap.get(a) : null;
      a &&
        t &&
        (a.removeEventListener("scroll", t.onScroll),
        window.clearTimeout(t.state.timer),
        this.scrollListenerMap.delete(a));
    }
  }
  removeResizeHandles(e) {
    var t = this.handleMap.get(e),
      t =
        (t?.length && (t.forEach((e) => e.remove()), this.handleMap.delete(e)),
        this.menuButtonMap.get(e));
    (t && (t.remove(), this.menuButtonMap.delete(e)),
      e
        .querySelectorAll(
          ":scope > .markplus-column-handle, :scope > .markplus-table-menu-button",
        )
        .forEach((e) => e.remove()),
      this.unbindTableLayoutObserver(e),
      delete e.dataset.markplusHoverBound,
      e.classList.remove("markplus-has-active-handle"));
  }
  onEditorWidthSliderInput(e) {
    e = e?.target;
    e instanceof HTMLInputElement &&
      "editor-width-slider" === e.id &&
      (mpLog("editor-width-slider:input"), this.repositionAllColumnHandles());
  }
  repositionAllColumnHandles() {
    window.requestAnimationFrame(() => {
      var e;
      for (e of this.plugin.app.workspace.getLeavesOfType("markdown")) {
        var t = e.view;
        t instanceof MarkdownView &&
          this.queryTablesForView(t)
            .filter((e) => !isReadingModeTable(e))
            .forEach((e) => {
              this.positionHandles(e);
            });
      }
    });
  }
  bindTableLayoutObserver(e) {
    e instanceof HTMLTableElement &&
      !isReadingModeTable(e) &&
      (this.tableLayoutObserverMap.has(e) ||
        (this.tableLayoutObserver ||
          (this.tableLayoutObserver = new ResizeObserver((t) => {
            window.requestAnimationFrame(() => {
              for (var e of t) {
                e = e.target;
                e instanceof HTMLTableElement &&
                  ((this.dragState?.table === e &&
                    "column" === this.dragState.mode) ||
                    this.positionHandles(e));
              }
            });
          })),
        this.tableLayoutObserver.observe(e),
        this.tableLayoutObserverMap.set(e, !0)));
  }
  unbindTableLayoutObserver(e) {
    this.tableLayoutObserver &&
      this.tableLayoutObserverMap.has(e) &&
      (this.tableLayoutObserver.unobserve(e),
      this.tableLayoutObserverMap.delete(e));
  }
  syncHandleCount(a, e, n, r) {
    let i = this.handleMap.get(a) || [];
    for (; i.length < e; ) {
      let t = document.createElement("div");
      ((t.className = "markplus-column-handle"),
        t.addEventListener("pointerdown", (e) => {
          this.startDragging(e, t, a, i.indexOf(t), n, r);
        }),
        a.appendChild(t),
        i.push(t));
    }
    for (; i.length > e; ) i.pop().remove();
    (this.handleMap.set(a, i),
      this.bindTableLayoutObserver(a),
      this.positionHandles(a));
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
  syncMenuButton(t, a, n) {
    let e = this.menuButtonMap.get(t);
    (e ||
      (((e = document.createElement("button")).type = "button"),
      (e.className = "markplus-table-menu-button clickable-icon"),
      e.setAttribute("aria-label", "表格菜单"),
      setIcon(e, "settings-2"),
      e.addEventListener("click", (e) => {
        (e.preventDefault(),
          e.stopPropagation(),
          this.showTableMenu(e, t, a, n));
      }),
      t.appendChild(e),
      this.menuButtonMap.set(t, e)),
      this.positionMenuButton(t, e));
  }
  positionMenuButton(e, t = null) {
    t = t || this.menuButtonMap.get(e);
    t &&
      ((e = getTableHeaderRow(e)?.offsetTop ?? 0),
      (t.style.left = "0px"),
      (t.style.top = e + "px"));
  }
  showTableMenu(e, a, t, n) {
    let r = n || this.getViewForTable(a),
      i = this.resolveTableSpec(a, t, r),
      l =
        this.plugin.settings.tableStyleVariant ||
        DEFAULT_SETTINGS.tableStyleVariant,
      s = this.getTableAlignment(r, i),
      o = new Menu();
    (o.addItem((e) => {
      e.setTitle("复制表格")
        .setIcon("copy")
        .onClick(() => {
          this.copyTableToClipboard(r, i, a);
        });
    }),
      o.addItem((e) => {
        e.setTitle("删除表格")
          .setIcon("trash")
          .onClick(() => {
            this.deleteTableFromMarkdown(r, i, a);
          });
      }),
      o.addSeparator(),
      TABLE_ALIGNMENT_OPTIONS.forEach((t) => {
        o.addItem((e) => {
          e.setTitle(t.label)
            .setIcon(t.icon)
            .setChecked(s === t.value)
            .onClick(() => {
              this.setTableAlignment(r, i, a, t.value);
            });
        });
      }),
      o.addSeparator(),
      TABLE_STYLE_OPTIONS.forEach((t) => {
        o.addItem((e) => {
          e.setTitle(t.label)
            .setChecked(l === t.value)
            .onClick(() => {
              this.setGlobalTableStyleVariant(t.value);
            });
        });
      }),
      o.showAtPosition({ x: e.clientX, y: e.clientY }));
  }
  getTableAlignment(e, t) {
    e = e?.editor;
    if (e && t && "function" == typeof e.getValue) {
      var a = findSeparatorLineForSpec(e.getValue(), t);
      if (null != a && "function" == typeof e.getLine) {
        e = parseSeparatorLine(e.getLine(a));
        if (e?.columns?.length) return getTableAlignmentFromColumns(e.columns);
      }
    }
    return getTableAlignmentFromColumns(t?.columns);
  }
  async setTableAlignment(n, r, i, l) {
    let s = n?.editor;
    if (
      s &&
      n?.file &&
      r &&
      TABLE_ALIGNMENT_OPTIONS.some((e) => e.value === l)
    ) {
      var o = s.getValue(),
        h = extractMarkdownTableSpecs(o);
      let e = r,
        a = findSeparatorLineForSpec(
          o,
          (e =
            Number.isInteger(r.tableOrdinal) &&
            0 <= r.tableOrdinal &&
            r.tableOrdinal < h.length
              ? h[r.tableOrdinal]
              : e),
        );
      if (null != a) {
        o = parseSeparatorLine(s.getLine(a));
        if (o?.columns?.length) {
          h = applyAlignmentToColumns(o.columns, l);
          let t = buildSeparatorLineFromColumns(h);
          r = i instanceof HTMLTableElement ? i : this.findTableForSpec(n, e);
          (await withPreservedViewScroll(n, async () => {
            var e = s.getLine(a);
            parseSeparatorLine(e) &&
              (this.markInternalChange(n.file.path),
              s.replaceRange(t, { line: a, ch: 0 }, { line: a, ch: e.length }),
              (e = s.getValue()),
              this.fileMarkdownSnapshots.set(n.file.path, e),
              this.fileTableSnapshots.set(
                n.file.path,
                extractMarkdownTableSpecs(e),
              ));
          }),
            r &&
              (this.applyTableColumnAlignment(r, h), this.positionHandles(r)),
            await this.refreshAllTables(),
            await this.syncPreviewAfterMarkdownChange(n),
            this.syncReadingPresentation("table-alignment"));
        }
      }
    }
  }
  findTableForSpec(e, t) {
    if (!(e instanceof MarkdownView && t)) return null;
    e = this.queryTablesForView(e).filter((e) => !isReadingModeTable(e));
    if (!e.length) return null;
    if (Number.isInteger(t.tableOrdinal)) {
      var a = e.find((e) => getTableMatchIndex(e) === t.tableOrdinal);
      if (a) return a;
    }
    return e[t.tableOrdinal] || e[0];
  }
  applyTableColumnAlignment(e, a) {
    if (e instanceof HTMLTableElement && Array.isArray(a) && a.length) {
      e.classList.remove(...MARKPLUS_TABLE_ALIGNMENT_CLASSES);
      var t = getTableAlignmentFromColumns(a);
      if (t)
        (e.classList.add("markplus-table-align-" + t),
          this.clearPerColumnAlignmentClasses(e));
      else
        for (var n of Array.from(e.rows))
          Array.from(n.cells).forEach((e, t) => {
            isCellBeingEdited(e) ||
              this.setCellAlignmentClass(e, getColumnAlignmentKind(a[t]));
          });
    }
  }
  clearPerColumnAlignmentClasses(e) {
    e.querySelectorAll("td, th").forEach((e) => {
      (e.classList.remove(...MARKPLUS_COLUMN_ALIGNMENT_CLASSES),
        e.style.removeProperty("text-align"));
    });
  }
  setCellAlignmentClass(e, t) {
    e instanceof HTMLElement &&
      (e.classList.remove(...MARKPLUS_COLUMN_ALIGNMENT_CLASSES),
      ("center" !== t && "right" !== t && "left" !== t) ||
        e.classList.add("markplus-col-align-" + t),
      e.style.removeProperty("text-align"));
  }
  async copyTableToClipboard(e, t, a) {
    ((e = e || this.getViewForTable(a)),
      (t = getTableMarkdownForCopy(e, this.resolveTableSpec(a, t, e), a)));
    if (t)
      try {
        (await navigator.clipboard.writeText(t),
          new obsidian.Notice("表格已复制到剪贴板"));
      } catch (e) {
        new obsidian.Notice("复制表格失败");
      }
    else new obsidian.Notice("无法复制表格");
  }
  async setGlobalTableStyleVariant(e) {
    ((this.plugin.settings.tableStyleVariant = e),
      await this.plugin.saveSettings(),
      this.syncReadingPresentation("table-style-change"),
      this.scheduleRefresh("table-style-change"));
  }
  async deleteTableFromMarkdown(e, t, l) {
    let s = e?.editor;
    if (s && e?.file && t) {
      let r = t.headerLineIndex,
        i = t.separatorLineIndex + t.bodyLines.length;
      if (!(!Number.isInteger(r) || r < 0 || i < r)) {
        let n = s.lineCount();
        if (!(i >= n)) {
          let a = e.file.path;
          (await withPreservedViewScroll(e, async () => {
            this.markInternalChange(a);
            var e = s.getLine(i).length,
              t =
                (i < n - 1
                  ? s.replaceRange(
                      "",
                      { line: r, ch: 0 },
                      { line: i + 1, ch: 0 },
                    )
                  : 0 < r
                    ? ((t = s.getLine(r - 1).length),
                      s.replaceRange(
                        "",
                        { line: r - 1, ch: t },
                        { line: i, ch: e },
                      ))
                    : s.replaceRange(
                        "",
                        { line: 0, ch: 0 },
                        { line: i, ch: e },
                      ),
                s.getValue());
            (this.fileMarkdownSnapshots.set(a, t),
              this.fileTableSnapshots.set(a, extractMarkdownTableSpecs(t)));
          }),
            this.removeResizeHandles(l),
            await this.syncPreviewAfterMarkdownChange(e),
            this.scheduleRefresh("delete-table"));
        }
      }
    }
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
              ".markplus-cell-fill-handle, .markplus-column-handle, .markplus-table-menu-button",
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
  resolveTableSpec(e, a, t) {
    if (!t?.editor || "function" != typeof t.editor.getValue) return a || null;
    var n,
      r = extractMarkdownTableSpecs(t.editor.getValue());
    for (n of [getTableMatchIndex(e), a?.tableOrdinal].filter(
      (e) => Number.isInteger(e) && 0 <= e,
    ))
      if (n < r.length) return r[n];
    for (let t of [
      Number.parseInt(e?.dataset?.markplusSeparatorLine ?? "", 10),
      a?.separatorLineIndex,
    ].filter((e) => Number.isInteger(e) && 0 <= e)) {
      let e = r.find((e) => e.separatorLineIndex === t);
      if (e) return e;
    }
    let i = this.matchSpecForTable(e, r, new Set(), getTableMatchIndex(e), t);
    return i || a || null;
  }
  activateCellFill(t, a, n, r) {
    if (this.plugin.settings.enableTableCellFill) {
      var r = r || this.getViewForTable(t),
        n = this.resolveTableSpec(t, n, r),
        { rowIndex: i, colIndex: l } = getCellCoords(t, a);
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
          view: r,
          handle: e,
          sourceRow: i,
          sourceCol: l,
        }));
    }
  }
  syncActiveFillCell(e, t, a) {
    var n, r, i, l;
    this.fillState &&
      this.fillState.table === e &&
      !this.fillDragState &&
      (({ sourceRow: n, sourceCol: r, handle: i } = this.fillState),
      (l = e.rows[n]?.cells[r])
        ? ((a = a || this.getViewForTable(e)),
          (this.fillState.cell = l),
          (this.fillState.view = a),
          (this.fillState.tableSpec = this.resolveTableSpec(e, t, a)),
          (this.fillState.sourceRow = n),
          (this.fillState.sourceCol = r),
          l.contains(i) || l.appendChild(i))
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
        r = this.resolveTableSpec(t, a.tableSpec, n);
      if (r && n?.file) {
        var i = a.sourceRow,
          l = a.sourceCol,
          s = t.rows[i]?.cells[l];
        if (s) {
          ((a.cell = s), (a.tableSpec = r), (a.view = n));
          s = getCellSourceText(r, i, l);
          if (null !== s) {
            a = e.currentTarget;
            if (
              ((this.fillDragState = {
                table: t,
                tableSpec: r,
                view: n,
                sourceRow: i,
                sourceCol: l,
                sourceText: s,
                disableIncrementFill: e.ctrlKey || e.metaKey,
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
          sourceRow: r,
          sourceCol: i,
          targets: l,
          disableIncrementFill: s,
          tableSpec: o,
        } = this.fillDragState,
        o = this.resolveTableSpec(a, o, n),
        h = o ? getCellSourceText(o, r, i) : null,
        t = getTableCellFromPoint(a, t.clientX, t.clientY);
      let e = l;
      (t &&
        ((l = getCellCoords(a, t)),
        (e = computeFillTargets({ rowIndex: r, colIndex: i }, l))),
        o && null !== h
          ? (await this.applyCellFill(n, o, r, i, h, e, {
              disableIncrementFill: s,
            }),
            this.stopFillDragging(),
            this.reapplyTableFormulasAfterFill(n, o),
            this.scheduleRefresh("fill-complete"))
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
      window.removeEventListener("pointercancel", this.boundFillPointerCancel),
      this.pendingRefreshReason &&
        ((e = this.pendingRefreshReason),
        (this.pendingRefreshReason = null),
        this.scheduleRefresh(e)));
  }
  reapplyTableFormulasAfterFill(r, i) {
    if (this.plugin.settings.enableTableFormulas && r?.contentEl && i) {
      let e = () => {
        var e = r.editor;
        if (e && "function" == typeof e.getValue) {
          var t,
            e = extractMarkdownTableSpecs(e.getValue()),
            a =
              e.find((e) => e.separatorLineIndex === i.separatorLineIndex) ||
              (Number.isInteger(i.tableOrdinal) ? e[i.tableOrdinal] : null);
          if (a)
            for (t of r.contentEl.querySelectorAll(TABLE_SELECTOR))
              if (t instanceof HTMLTableElement) {
                var n = this.resolveTableSpec(t, a, r);
                if (n?.separatorLineIndex === a.separatorLineIndex)
                  return (this.applyTableFormulas(t, a), !0);
              }
        }
        return !1;
      };
      window.requestAnimationFrame(() => {
        e() || window.requestAnimationFrame(e);
      });
    }
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
  async applyCellFill(a, e, n, r, i, l, s = {}) {
    let o = a?.editor;
    if (o && a.file && e && Array.isArray(l) && l.length) {
      var h,
        u,
        c,
        d,
        p,
        { disableIncrementFill: g = !1 } = s;
      let t = new Map();
      for ({ rowIndex: h, colIndex: u } of l)
        (h === n && u === r) ||
          ((c = getMarkdownLineIndexForTableRow(e, h)),
          (d = t.has(c) ? t.get(c) : o.getLine(c)),
          (p = getFillCellValue(i, n, r, h, u, { disableIncrementFill: g })),
          t.set(c, replaceCellInMarkdownRow(d, u, p)));
      t.size &&
        (this.markInternalChange(a.file.path, t.size),
        await withPreservedViewScroll(a, async () => {
          [...t.entries()]
            .sort((e, t) => t[0] - e[0])
            .forEach(([e, t]) => {
              var a = o.getLine(e);
              o.replaceRange(t, { line: e, ch: 0 }, { line: e, ch: a.length });
            });
          var e = o.getValue();
          (this.fileMarkdownSnapshots.set(a.file.path, e),
            this.fileTableSnapshots.set(
              a.file.path,
              extractMarkdownTableSpecs(e),
            ));
        }));
    }
  }
  positionHandles(e) {
    let n = this.handleMap.get(e) || [],
      r = getTableHeaderRow(e),
      i = r?.offsetTop ?? 0,
      l = r?.offsetHeight ?? 0,
      s = getColumnBoundaryOffsets(e, r);
    (e.classList.toggle(
      "markplus-has-active-handle",
      n.some((e) => e.classList.contains("is-active")),
    ),
      n.forEach((e, t) => {
        var a = s[t];
        !Number.isFinite(a) || a <= 0 || !r
          ? (e.style.display = "none")
          : ((e.style.display = "block"),
            (e.style.left = Math.max(0, Math.round(a - 4)) + "px"),
            (e.style.top = i + "px"),
            (e.style.height = l + "px"),
            (e.dataset.edge = t === n.length - 1 ? "right" : "middle"));
      }),
      this.positionMenuButton(e));
  }
  updateActiveHandleForPointer(e, t) {
    var n = this.handleMap.get(e) || [],
      r = getTableHeaderRow(e);
    if (n.length && r) {
      var i = t - e.getBoundingClientRect().left,
        l = getColumnBoundaryOffsets(e, r);
      let a = n.length - 1;
      for (let e = 0; e < l.length; e += 1)
        if (i <= l[e]) {
          a = Math.min(e, n.length - 1);
          break;
        }
      (n.forEach((e, t) => {
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
  startDragging(e, t, a, n, r, i) {
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
          tableSpec: r,
          view: i,
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
    var t, a, n, r, i;
    return this.dragState
      ? (({
          handleIndex: t,
          startX: n,
          widths: a,
          minWidth: i,
        } = this.dragState),
        (e = e.clientX - n),
        (n = a.slice()),
        t === a.length - 1
          ? (n[t] = Math.max(i, Math.round(a[t] + e)))
          : ((r = a[t] + a[t + 1]),
            (i = Math.min(r - i, Math.max(i, a[t] + e))),
            (n[t] = Math.round(i)),
            (n[t + 1] = Math.round(r - i))),
        n)
      : null;
  }
  async onPointerUp(t) {
    if (this.dragState) {
      var t =
          this.computeDragWidths(t) ||
          this.readCurrentWidths(this.dragState.table),
        { table: a, tableSpec: n, view: r } = this.dragState,
        i = this.ensureColgroup(a, t.length),
        i =
          (this.applyWidthsToColgroup(a, i, t),
          this.positionHandles(a),
          this.readCurrentWidths(a));
      let e = n;
      (r?.editor &&
        "function" == typeof r.editor.getValue &&
        (t = this.matchSpecForTable(
          a,
          extractMarkdownTableSpecs(r.editor.getValue()),
          new Set(),
          getTableMatchIndex(a),
          r,
        )) &&
        (e = t),
        await this.writeWidthsBackToMarkdown(i, e, r),
        this.stopDragging(),
        await this.syncPreviewAfterMarkdownChange(r),
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
      window.removeEventListener("pointermove", this.boundPointerMove),
      window.removeEventListener("pointerup", this.boundPointerUp),
      window.removeEventListener("pointercancel", this.boundPointerCancel));
  }
  markInternalChange(e, t = 1) {
    ((t = Number.isInteger(t) && 0 < t ? t : 1),
      (t = (this.internalChangeBudget.get(e) || 0) + t));
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
    var a = getTableHeaderRow(e);
    return a?.cells.length
      ? Array.from(a.cells).map((e) =>
          Math.round(e.getBoundingClientRect().width),
        )
      : (a = e.querySelector(":scope > colgroup.markplus-colgroup")) &&
          a.children.length
        ? Array.from(a.children).map((e) =>
            Math.round(e.getBoundingClientRect().width),
          )
        : t
          ? Array.from({ length: t }, () => this.plugin.settings.minColumnWidth)
          : [];
  }
  applyWidthsToColgroup(e, t, a) {
    a = a && a.length ? a : this.readCurrentWidths(e);
    let n = toColumnPercents(a);
    (Array.from(t.children).forEach((e, t) => {
      t = n[t];
      e.style.width = t ? t + "%" : "";
    }),
      this.applyColumnWidthStyles(e, a));
  }
  alignPreviewTableWrapper(e) {
    var t;
    e instanceof HTMLTableElement &&
      !e.closest(".markdown-source-view, .cm-table-widget") &&
      ((e.style.marginLeft = "0"),
      (e.style.marginRight = "0"),
      (e.style.marginInlineStart = "0"),
      (e.style.marginInlineEnd = "0"),
      (e = e.closest(".el-table, .table-wrapper"))) &&
      (e.classList.add("markplus-table-wrapper"),
      (e.style.width = "var(--file-line-width)"),
      (e.style.maxWidth = "var(--file-line-width)"),
      (e.style.marginLeft = "0"),
      (e.style.marginRight = "auto"),
      (e.style.marginInlineStart = "0"),
      (e.style.marginInlineEnd = "auto"),
      (e = e.parentElement)?.classList?.contains("el-div")) &&
      (e.classList.add("markplus-table-block"),
      (e.style.textAlign = "start"),
      (t = window.getComputedStyle(e).display).includes("flex") ||
        t.includes("grid")) &&
      ((e.style.justifyContent = "flex-start"),
      (e.style.alignItems = "flex-start"),
      (e.style.justifyItems = "start"));
  }
  applyColumnWidthStyles(e, t) {
    if (t && t.length) {
      let a = toColumnPercents(t);
      ((e.style.tableLayout = "fixed"),
        (e.style.width = ""),
        (e.style.maxWidth = ""));
      for (var n of Array.from(e.rows))
        Array.from(n.cells).forEach((e, t) => {
          t = a[t];
          t &&
            ((e.style.width = t + "%"),
            (e.style.minWidth = ""),
            (e.style.maxWidth = ""));
        });
      this.alignPreviewTableWrapper(e);
    }
  }
  async writeWidthsBackToMarkdown(n, r, i) {
    if (r && i?.file) {
      let t = buildSeparatorLine(
          r,
          n.map((e) =>
            Math.max(3, Math.round(e / this.plugin.settings.pixelsPerDash)),
          ),
        ),
        e = "",
        a = findSeparatorLineForSpec(
          (e =
            i.editor && "function" == typeof i.editor.getValue
              ? i.editor.getValue()
              : await this.plugin.app.vault.cachedRead(i.file)),
          r,
        );
      null == a
        ? mpLog("writeWidthsBackToMarkdown:separator-not-found")
        : parseSeparatorLine((n = e.split(/\r?\n/))[a])
          ? i.editor &&
            "function" == typeof i.editor.replaceRange &&
            "function" == typeof i.editor.getLine
            ? await withPreservedViewScroll(i, async () => {
                var e = i.editor.getLine(a);
                parseSeparatorLine(e) &&
                  (this.markInternalChange(i.file.path),
                  i.editor.replaceRange(
                    t,
                    { line: a, ch: 0 },
                    { line: a, ch: e.length },
                  ),
                  (e = i.editor.getValue()),
                  this.fileMarkdownSnapshots.set(i.file.path, e),
                  this.fileTableSnapshots.set(
                    i.file.path,
                    extractMarkdownTableSpecs(e),
                  ));
              })
            : ((n[a] = t),
              (r = n.join("\n")),
              await this.plugin.app.vault.modify(i.file, r),
              this.fileMarkdownSnapshots.set(i.file.path, r),
              this.fileTableSnapshots.set(
                i.file.path,
                extractMarkdownTableSpecs(r),
              ),
              await this.syncPreviewAfterMarkdownChange(i))
          : mpLog("writeWidthsBackToMarkdown:line-not-separator", {
              lineIndex: a,
              line: n[a],
            });
    }
  }
}
function extractMarkdownTableSpecs(e) {
  var a = e.split(/\r?\n/),
    n = [];
  let r = !1,
    i = "";
  for (let t = 1; t < a.length; t += 1) {
    var l = a[t],
      s = l.match(/^(`{3,}|~{3,})(.*)$/);
    if (s) {
      s = s[1];
      r ? s[0] === i && ((r = !1), (i = "")) : ((r = !0), (i = s[0]));
    } else if (!r) {
      s = parseSeparatorLine(l);
      if (s) {
        var o = a[t - 1] || "";
        if (isMarkdownTableRow(o) && !parseSeparatorLine(o)) {
          var h = splitMarkdownRow(o);
          if (h.length && h.length === s.columns.length) {
            var u = [];
            let e = t + 1;
            for (; e < a.length; ) {
              var c = a[e];
              if (!isMarkdownTableRow(c) || parseSeparatorLine(c)) break;
              (u.push(c), (e += 1));
            }
            (n.push({
              tableOrdinal: n.length,
              separatorLineIndex: t,
              headerLineIndex: t - 1,
              columns: s.columns,
              headerCells: h,
              bodyLines: u,
              rawHeaderLine: o,
              rawSeparatorLine: l,
            }),
              (t = e - 1));
          }
        }
      }
    }
  }
  return n;
}
function findSeparatorLineForSpec(e, n) {
  if (n && "string" == typeof e) {
    var r = extractMarkdownTableSpecs(e);
    if (
      Number.isInteger(n.tableOrdinal) &&
      0 <= n.tableOrdinal &&
      n.tableOrdinal < r.length
    )
      return r[n.tableOrdinal].separatorLineIndex;
    e = e.split(/\r?\n/);
    let t = n.separatorLineIndex;
    if (
      Number.isInteger(t) &&
      0 <= t &&
      t < e.length &&
      parseSeparatorLine(e[t])
    )
      return t;
    let a = specHeaderSignature(n);
    if (a) {
      e = r.filter((e) => specHeaderSignature(e) === a);
      if (1 === e.length) return e[0].separatorLineIndex;
      if (
        1 < e.length &&
        Number.isInteger(t) &&
        e.some((e) => e.separatorLineIndex === t)
      )
        return t;
    }
  }
  return null;
}
function parseSeparatorLine(e) {
  e = splitMarkdownRow(e);
  if (!e.length) return null;
  var t,
    a = [];
  for (t of e) {
    var n = t.trim().match(/^(:)?(-{2,})(:)?$/);
    if (!n) return null;
    a.push({
      alignLeft: Boolean(n[1]),
      alignRight: Boolean(n[3]),
      dashCount: n[2].length,
    });
  }
  return { columns: a };
}
function isReadingModeTable(e) {
  return (
    e instanceof HTMLTableElement &&
    !e.closest(".cm-table-widget, .markdown-source-view") &&
    Boolean(
      e.closest(".markdown-preview-view, .markdown-reading-view, .el-table"),
    )
  );
}
function matchSpecForSection(e, a, n, r, i, l = 0) {
  if (Array.isArray(r) && r.length) {
    a = a?.getSectionInfo?.(e);
    if (a && Number.isInteger(a.lineStart)) {
      var t = a.lineStart,
        s = Number.isInteger(a.lineEnd) ? a.lineEnd : t,
        o = [];
      for (let e = 0; e < r.length; e += 1) {
        var h = r[e],
          u = h.headerLineIndex;
        t <= h.separatorLineIndex + Math.max(h.bodyLines?.length || 0, 0) &&
          u <= s &&
          o.push(e);
      }
      if (1 === o.length) {
        e = o[0];
        if (!i.has(e)) return (i.add(e), r[e]);
      }
      if (1 < o.length) {
        a = o.filter((e) => !i.has(e));
        if (Number.isInteger(l) && l < a.length)
          return ((e = a[l]), i.add(e), r[e]);
        var c = domTableContentSignature(n);
        if (c)
          for (var d of a)
            if (specContentSignature(r[d]) === c) return (i.add(d), r[d]);
        let t = domTableHeaderSignature(n);
        if (t) {
          l = a.filter((e) => specHeaderSignature(r[e]) === t);
          if (1 === l.length) return ((e = l[0]), i.add(e), r[e]);
        }
      }
    }
  }
  return null;
}
function buildMarkdownTableFromSpec(e) {
  return e?.rawHeaderLine && e?.rawSeparatorLine
    ? [e.rawHeaderLine, e.rawSeparatorLine, ...(e.bodyLines || [])].join("\n")
    : "";
}
function buildMarkdownTableFromElement(e) {
  var t;
  return e instanceof HTMLTableElement && (e = Array.from(e.rows)).length
    ? (1 ===
      (t = e.map(
        (e) =>
          `| ${Array.from(e.cells)
            .map((e) => (e.textContent ?? "").trim().replace(/\|/g, "\\|"))
            .join(" | ")} |`,
      )).length
        ? ((e = `| ${Array.from(e[0].cells, () => "---").join(" | ")} |`),
          [t[0], e])
        : t
      ).join("\n")
    : "";
}
function getTableMarkdownForCopy(t, e, a) {
  var n = t?.editor;
  if (n && e) {
    var t = e.headerLineIndex,
      r = e.separatorLineIndex + (e.bodyLines?.length ?? 0);
    if (Number.isInteger(t) && 0 <= t && t <= r && r < n.lineCount()) {
      var i = [];
      for (let e = t; e <= r; e += 1) i.push(n.getLine(e));
      if (2 <= i.length && parseSeparatorLine(i[1])) return i.join("\n");
    }
  }
  t = buildMarkdownTableFromSpec(e);
  return t || buildMarkdownTableFromElement(a);
}
function getColumnBoundaryOffsets(e, t) {
  if (!(e instanceof HTMLTableElement && t?.cells?.length)) return [];
  let a = e.getBoundingClientRect();
  return Array.from(t.cells).map(
    (e) => e.getBoundingClientRect().right - a.left,
  );
}
function toColumnPercents(t) {
  if (!Array.isArray(t) || !t.length) return [];
  let a = t.reduce((e, t) => e + Math.max(0, t), 0);
  if (a <= 0) {
    let e = 100 / t.length;
    return t.map(() => e);
  }
  return t.map((e) => (Math.max(0, e) / a) * 100);
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
    r = [];
  if (Math.abs(a) >= Math.abs(n)) {
    var a = Math.min(t.rowIndex, e.rowIndex),
      i = Math.max(t.rowIndex, e.rowIndex);
    for (let e = a; e <= i; e += 1)
      r.push({ rowIndex: e, colIndex: t.colIndex });
  } else {
    var n = Math.min(t.colIndex, e.colIndex),
      l = Math.max(t.colIndex, e.colIndex);
    for (let e = n; e <= l; e += 1)
      r.push({ rowIndex: t.rowIndex, colIndex: e });
  }
  return r;
}
function getMarkdownLineIndexForTableRow(e, t) {
  return 0 === t ? e.headerLineIndex : e.separatorLineIndex + t;
}
function getFillCellValue(e, t, a, n, r, i = {}) {
  var { disableIncrementFill: i = !1 } = i;
  return i
    ? e
    : ((i = n - t),
      (n = r - a),
      incrementEmbeddedNumber(e, Math.abs(i) >= Math.abs(n) ? i : n));
}
function incrementEmbeddedNumber(e, t) {
  var a = findFirstNumericToken(e);
  return a
    ? ((t = formatFillNumber(a.value + t, a.raw)),
      "" + e.slice(0, a.index) + t + e.slice(a.index + a.raw.length))
    : e;
}
function findFirstNumericToken(e) {
  var t;
  return null != e &&
    (e = String(e).match(/-?\d+(?:\.\d+)?/)) &&
    "number" == typeof e.index &&
    ((t = Number(e[0])), Number.isFinite(t))
    ? { raw: e[0], value: t, index: e.index }
    : null;
}
function formatFillNumber(a, n) {
  var n = String(n).trim(),
    r = n.replace(/[,\s¥$€£%]/g, "").match(/^-?\d+\.(\d+)$/);
  if (r) {
    var r = r[1].length,
      i = 10 ** r,
      i = Math.round(a * i) / i;
    let e = getIntegerDigitWidth(n);
    var [r, l = ""] = Math.abs(i).toFixed(r).split(".");
    let t = 1 < e ? r.padStart(e, "0") : r;
    return (i < 0 ? "-" : "") + t + "." + l;
  }
  r = Math.round(a);
  let e = getIntegerDigitWidth(n);
  i = String(Math.abs(r));
  let t = 1 < e ? i.padStart(e, "0") : i;
  return (r < 0 ? "-" : "") + t;
}
function getIntegerDigitWidth(e) {
  e = String(e)
    .trim()
    .replace(/[,\s¥$€£%]/g, "")
    .match(/^-?(\d+)(?:\.\d+)?$/);
  return e ? e[1].length : 0;
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
function alignmentToColumnFlags(e) {
  return "center" === e
    ? { alignLeft: !0, alignRight: !0 }
    : "right" === e
      ? { alignLeft: !1, alignRight: !0 }
      : { alignLeft: !0, alignRight: !1 };
}
function getColumnAlignmentKind(e) {
  return e?.alignLeft && e?.alignRight
    ? "center"
    : e?.alignRight
      ? "right"
      : "left";
}
function getTableAlignmentFromColumns(e) {
  if (!Array.isArray(e) || !e.length) return null;
  let t = getColumnAlignmentKind(e[0]);
  return e.every((e) => getColumnAlignmentKind(e) === t) ? t : null;
}
function applyAlignmentToColumns(e, t) {
  let a = alignmentToColumnFlags(t);
  return e.map((e) => ({
    ...e,
    alignLeft: a.alignLeft,
    alignRight: a.alignRight,
  }));
}
function reorderColumnsByHeader(t, e) {
  var a = t.headerCells || [],
    n = e.headerCells || [];
  if (!a.length || a.length !== n.length) return null;
  if (t.columns.length !== a.length || e.columns.length !== n.length)
    return null;
  let r = new Map();
  a.forEach((e, t) => {
    var e = normalizeHeaderCell(e),
      a = r.get(e) || [];
    (a.push(t), r.set(e, a));
  });
  var i,
    l = [];
  for (i of n) {
    var s = normalizeHeaderCell(i),
      s = r.get(s);
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
  let r = new Map(),
    i =
      (n.forEach((e, t) => {
        var e = normalizeHeaderCell(e),
          a = r.get(e) || [];
        (a.push(t), r.set(e, a));
      }),
      new Set()),
    l = Array.from({ length: t.length }, () => null);
  return (
    t.forEach((e, t) => {
      var e = normalizeHeaderCell(e),
        e = r.get(e);
      e && e.length && ((e = e.shift()), i.add(e), (l[t] = e));
    }),
    n.length === t.length &&
      t.forEach((e, t) => {
        null !== l[t] || i.has(t) || t >= n.length || ((l[t] = t), i.add(t));
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
function getDomTableColumnCount(e) {
  return e instanceof HTMLTableElement && e.rows?.length
    ? Math.max(...Array.from(e.rows).map((e) => e.cells.length), 0)
    : 0;
}
function getEditorView(e) {
  e = e?.editor?.cm;
  return e?.state && "function" == typeof e.state.doc?.lineAt ? e : null;
}
function isMarkdownTableSyntaxNode(e) {
  return (
    !(
      !e ||
      "string" != typeof e ||
      (e = e.toLowerCase()).includes("cell") ||
      e.includes("row") ||
      e.includes("header")
    ) &&
    ("table" === e || e.endsWith("table"))
  );
}
function domTableBodySignature(e) {
  return !(e instanceof HTMLTableElement) || e.rows.length < 2
    ? null
    : Array.from(e.rows)
        .slice(1)
        .map((e) =>
          Array.from(e.cells)
            .map((e) => normalizeMatchText(e.textContent))
            .join(""),
        )
        .join("");
}
function specBodySignature(e) {
  return e && Array.isArray(e.bodyLines) && e.bodyLines.length
    ? e.bodyLines
        .map((e) =>
          splitMarkdownRow(e)
            .map((e) => normalizeMatchText(e))
            .join(""),
        )
        .join("")
    : null;
}
function matchSpecIndexesByBodySignature(t, a, n, e = null) {
  return t
    ? (Array.isArray(e) ? e : a.map((e, t) => t)).filter(
        (e) => !n.has(e) && specBodySignature(a[e]) === t,
      )
    : [];
}
function getTableSourceLineForDomTable(e, t) {
  var a = e?.editor;
  if (!(a && t instanceof HTMLTableElement)) return null;
  var n = t.closest(".cm-table-widget"),
    r = [
      n,
      t.querySelector("thead th"),
      t.querySelector("tr th"),
      t.querySelector("tr td"),
      t,
    ].filter(Boolean);
  if ("function" == typeof a.posAtDOM)
    for (var i of r)
      for (var l of [-1, 0, 1])
        try {
          var s = a.posAtDOM(i, l);
          if (s && Number.isInteger(s.line) && 0 <= s.line) return s.line;
        } catch (e) {}
  let o = getEditorView(e);
  if (!o) return null;
  r = t.getBoundingClientRect();
  if (n)
    for (var h of [-1, 0, 1])
      try {
        var u = o.posAtDOM(n, h);
        if (Number.isInteger(u) && 0 <= u)
          return o.state.doc.lineAt(u).number - 1;
      } catch (e) {}
  if (r.width || r.height)
    try {
      var c = o.posAtCoords({
        left: r.left + 12,
        top: r.top + Math.min(24, r.height / 2),
      });
      if (null != c) return o.state.doc.lineAt(c).number - 1;
    } catch (e) {}
  e = getMarkplusSyntaxTree(o.state);
  if (!e || (!r.width && !r.height)) return null;
  let d = r.top + r.height / 2,
    p = null,
    g = 1 / 0;
  try {
    e.iterate({
      enter(t) {
        if (isMarkdownTableSyntaxNode(t.type?.name)) {
          let e;
          try {
            e = o.coordsAtPos(t.from);
          } catch (e) {
            return;
          }
          var a;
          e &&
            (a = Math.abs(e.top - d)) < g &&
            ((g = a), (p = o.state.doc.lineAt(t.from).number - 1));
        }
      },
    });
  } catch (e) {
    return null;
  }
  return null != p && g < 320 ? p : null;
}
function matchSpecBySourceLine(e, t, a, n) {
  let r = getTableSourceLineForDomTable(e, t);
  if (!Number.isInteger(r) || r < 0) return null;
  var i,
    l,
    s,
    o = [];
  for (let e = 0; e < a.length; e += 1)
    n.has(e) ||
      ((l = (i = a[e]).headerLineIndex),
      (s =
        i.separatorLineIndex +
        (Array.isArray(i.bodyLines) ? i.bodyLines.length : 0)),
      r >= l && r <= s && o.push({ index: e, spec: i }));
  if (!o.length) return null;
  if (1 === o.length) return (n.add(o[0].index), o[0].spec);
  let h = getDomTableColumnCount(t),
    u = o;
  if (0 < h) {
    e = o.filter(({ spec: e }) => e.headerCells.length === h);
    if (1 === e.length) return (n.add(e[0].index), e[0].spec);
    0 < e.length && (u = e);
  }
  let c = domTableBodySignature(t);
  if (c) {
    e = u.filter(({ spec: e }) => specBodySignature(e) === c);
    if (1 === e.length) return (n.add(e[0].index), e[0].spec);
  }
  let d = domTableContentSignature(t);
  if (d) {
    e = u.filter(({ spec: e }) => specContentSignature(e) === d);
    if (1 === e.length) return (n.add(e[0].index), e[0].spec);
  }
  let p = domTableHeaderSignature(t);
  if (p) {
    e = u.filter(({ spec: e }) => specHeaderSignature(e) === p);
    if (1 === e.length) return (n.add(e[0].index), e[0].spec);
  }
  return (
    u.sort(
      (e, t) =>
        Math.abs(r - e.spec.headerLineIndex) -
        Math.abs(r - t.spec.headerLineIndex),
    ),
    n.add(u[0].index),
    u[0].spec
  );
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
function domTableContentSignature(e) {
  var t, a;
  return e instanceof HTMLTableElement &&
    e.rows?.length &&
    (e = Array.from(e.rows).map((e) =>
      Array.from(e.cells).map((e) => normalizeMatchText(e.textContent)),
    )).length &&
    e[0].length
    ? ((t = e[0].join("")),
      (a = e
        .slice(1, 3)
        .map((e) => e.join(""))
        .join("")),
      [e.length, e[0].length, t, a].join(""))
    : null;
}
function specContentSignature(e) {
  var t, a;
  return e && Array.isArray(e.headerCells) && e.headerCells.length
    ? ((a = Array.isArray(e.bodyLines)
        ? e.bodyLines
            .slice(0, 2)
            .map((e) => splitMarkdownRow(e).map((e) => normalizeMatchText(e)))
        : []),
      (t = e.headerCells.map((e) => normalizeMatchText(e)).join("")),
      (a = a.map((e) => e.join("")).join("")),
      [
        1 + (Array.isArray(e.bodyLines) ? e.bodyLines.length : 0),
        e.headerCells.length,
        t,
        a,
      ].join(""))
    : null;
}
function getTableMatchIndex(e, t = null) {
  ((e = e?.dataset?.markplusTableOrdinal), (e = Number.parseInt(e ?? "", 10)));
  return Number.isInteger(e) && 0 <= e
    ? e
    : Number.isInteger(t) && 0 <= t
      ? t
      : null;
}
function captureViewScrollState(e) {
  return e?.contentEl
    ? Array.from(
        e.contentEl.querySelectorAll(".cm-scroller, .markdown-preview-view"),
      )
        .filter((e) => e instanceof HTMLElement)
        .map((e) => ({ element: e, top: e.scrollTop, left: e.scrollLeft }))
    : [];
}
function restoreViewScrollState(e) {
  e.forEach(({ element: e, top: t, left: a }) => {
    ((e.scrollTop = t), (e.scrollLeft = a));
  });
}
async function withPreservedViewScroll(e, t) {
  let a = captureViewScrollState(e);
  e = await t();
  return (
    restoreViewScrollState(a),
    window.requestAnimationFrame(() => restoreViewScrollState(a)),
    e
  );
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
      .replace(/[,\s¥$€£%*_`~]/g, "")) &&
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
    : "—";
}
function isMarkdownTableRow(e) {
  return (
    !("string" != typeof e || !e.includes("|") || parseSeparatorLine(e)) &&
    0 < splitMarkdownRow(e).length
  );
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
    /^\s*-\s(?:\[|【)$/.test(t)
  );
}
function migrateLegacyTableColorSettings(e) {
  if (!e) return !1;
  let t = !1;
  return (
    e.tableStripeRowBackground &&
      (e.tableStripeRowBackgroundLight ||
        (e.tableStripeRowBackgroundLight = e.tableStripeRowBackground),
      e.tableStripeRowBackgroundDark ||
        (e.tableStripeRowBackgroundDark = e.tableStripeRowBackground),
      (t = !0)),
    e.tableHeaderBackground &&
      (e.tableHeaderBackgroundLight ||
        (e.tableHeaderBackgroundLight = e.tableHeaderBackground),
      e.tableHeaderBackgroundDark ||
        (e.tableHeaderBackgroundDark = e.tableHeaderBackground),
      (t = !0)),
    t
  );
}
function appendTableColorThemeRule(e, t, a, n) {
  n = "string" == typeof n ? n.trim() : "";
  n && e.push(`body.${t} { ${a}: ${n}; }`);
}
function resolveDefaultTableColorHex(e = null) {
  var t,
    a,
    e =
      "dark" === e ||
      ("light" !== e && document.body.classList.contains("theme-dark"));
  return (
    (e === document.body.classList.contains("theme-dark") &&
      ((t = document.createElement("span")).style.setProperty(
        "color",
        MARKPLUS_DEFAULT_TABLE_BACKGROUND,
      ),
      (t.style.display = "none"),
      document.body.appendChild(t),
      (a = getComputedStyle(t).color),
      document.body.removeChild(t),
      cssRgbStringToHex(a))) ||
    (e ? "#363636" : "#f6f6f6")
  );
}
function cssRgbStringToHex(e) {
  e =
    "string" == typeof e
      ? e.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i)
      : null;
  return e
    ? "#" +
        [e[1], e[2], e[3]]
          .map((e) => Number(e).toString(16).padStart(2, "0"))
          .join("")
    : null;
}
function hexToRgb(e) {
  e = e.replace("#", "");
  return 6 !== e.length
    ? null
    : {
        r: Number.parseInt(e.slice(0, 2), 16),
        g: Number.parseInt(e.slice(2, 4), 16),
        b: Number.parseInt(e.slice(4, 6), 16),
      };
}
function formatTableColorValue(e, t) {
  var a;
  return e
    ? !(0.999 <= t) && (a = hexToRgb(e))
      ? ((t = Math.round(100 * t) / 100), `rgba(${a.r}, ${a.g}, ${a.b}, ${t})`)
      : e
    : "";
}
function parseStoredTableColor(e) {
  var t,
    e = "string" == typeof e ? e.trim() : "";
  return e
    ? (t = e.match(/^#([0-9a-fA-F]{8})$/))
      ? {
          hex: "#" + (t = t[1]).slice(0, 6),
          alpha: Number.parseInt(t.slice(6, 8), 16) / 255,
        }
      : e.match(/^#([0-9a-fA-F]{6})$/)
        ? { hex: e, alpha: 1 }
        : (t = e.match(
              /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s]+([\d.]+))?\s*\)$/i,
            ))
          ? {
              hex:
                "#" +
                [t[1], t[2], t[3]]
                  .map((e) => Number(e).toString(16).padStart(2, "0"))
                  .join(""),
              alpha: void 0 !== t[4] ? Number(t[4]) : 1,
            }
          : null
    : null;
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
        .createEl("a", { text: "作者：鱼先生✨", href: "https://obsidian.run" })
        .setAttr("target", "_blank"),
      e.createEl("h2", { text: "Markplus  设置" }),
      this.plugin.isContentProtectionActivated
        ? (new Setting(e)
            .setName("任务语法自动补全")
            .setDesc("输入 - [ 或 - 【 时，自动补全任务语法。")
            .addToggle((e) => {
              e.setValue(
                this.plugin.settings.enableTaskSyntaxCompletion,
              ).onChange(async (e) => {
                ((this.plugin.settings.enableTaskSyntaxCompletion = e),
                  await this.plugin.saveSettings());
              });
            }),
          new Setting(e)
            .setName("表格公式")
            .setDesc(
              "在表格最后一行单元格输入 =sum、=avg、=count、=max、=min 时，自动计算该列数据。",
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
              "点击表格单元格后，在右下角拖拽把手可向上下左右填充内容；单元格中只要包含数字就会按 +1 / -1 递增递减，按住 Ctrl/Cmd 拖拽时则保持原样复制。",
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
            .addDropdown((t) => {
              (TABLE_STYLE_OPTIONS.forEach((e) => {
                t.addOption(e.value, e.label);
              }),
                t
                  .setValue(
                    this.plugin.settings.tableStyleVariant ||
                      DEFAULT_SETTINGS.tableStyleVariant,
                  )
                  .onChange(async (e) => {
                    await this.plugin.tableEnhancer?.setGlobalTableStyleVariant(
                      e,
                    );
                  }));
            }),
          new Setting(e).setName("隔行背景色").setHeading(),
          this.addTableColorSetting(e, {
            name: "浅色模式",
            desc: "浅色主题下的隔行背景色。",
            settingKey: "tableStripeRowBackgroundLight",
            theme: "light",
          }),
          this.addTableColorSetting(e, {
            name: "深色模式",
            desc: "深色主题下的隔行背景色。",
            settingKey: "tableStripeRowBackgroundDark",
            theme: "dark",
          }),
          new Setting(e).setName("表头背景色").setHeading(),
          this.addTableColorSetting(e, {
            name: "浅色模式",
            desc: "浅色主题下的表头背景色。",
            settingKey: "tableHeaderBackgroundLight",
            theme: "light",
          }),
          this.addTableColorSetting(e, {
            name: "深色模式",
            desc: "深色主题下的表头背景色。",
            settingKey: "tableHeaderBackgroundDark",
            theme: "dark",
          }))
        : e.createEl("p", { text: "仓库未激活，请先激活仓库" }));
  }
  addTableColorSetting(e, { name: t, desc: a, settingKey: n, theme: r }) {
    var i = parseStoredTableColor(this.plugin.settings[n]);
    let l = i?.hex || resolveDefaultTableColorHex(r),
      s = i?.alpha ?? 1,
      o = null,
      h = null;
    new Setting(e)
      .setName(t)
      .setDesc(a)
      .addColorPicker((e) => {
        ((o = e).setValue(l),
          e.onChange(async () => {
            await this.persistTableColorSetting(n, o, h);
          }));
      })
      .addSlider((e) => {
        ((h = e).setLimits(0, 100, 1),
          e.setValue(Math.round(100 * s)),
          e.setDynamicTooltip(),
          e.onChange(async () => {
            await this.persistTableColorSetting(n, o, h);
          }));
      })
      .addExtraButton((e) => {
        e.setIcon("rotate-ccw")
          .setTooltip("恢复默认")
          .onClick(async () => {
            ((this.plugin.settings[n] = ""),
              await this.plugin.saveSettings(),
              o?.setValue(resolveDefaultTableColorHex(r)),
              h?.setValue(100));
          });
      });
  }
  async persistTableColorSetting(e, t, a) {
    t &&
      ((t = t.getValue()),
      (a = (a?.getValue() ?? 100) / 100),
      (this.plugin.settings[e] = formatTableColorValue(t, a)),
      await this.plugin.saveSettings());
  }
}
