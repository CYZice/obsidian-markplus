import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS } from "./constants";
import { mpLog } from "./debug";
import { MarkPlusSettingTab } from "./settings";
import { TableColumnResizeController } from "./table-controller";
import type { MarkPlusSettings } from "./types";

export default class MarkPlusPlugin extends Plugin {
  settings: MarkPlusSettings = { ...DEFAULT_SETTINGS };
  tableEnhancer: TableColumnResizeController | null = null;
  private _pluginInitialized = false;

  async onload(): Promise<void> {
    this._pluginInitialized = false;
    await this.initializePluginFeatures();
  }

  async initializePluginFeatures(): Promise<void> {
    if (this._pluginInitialized) {
      return;
    }

    this._pluginInitialized = true;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.tableEnhancer = new TableColumnResizeController(this as never);

    this.addSettingTab(new MarkPlusSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.tableEnhancer?.scheduleRefresh("layout-change");
      }),
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.tableEnhancer?.scheduleRefresh("active-leaf-change");
      }),
    );

    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        this.tableEnhancer?.scheduleRefresh("file-open");
      }),
    );

    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, context) => {
        this.tableEnhancer?.handleEditorChange(editor, context).catch(() => {});
      }),
    );

    this.registerDomEvent(window, "resize", () => {
      this.tableEnhancer?.scheduleRefresh("window-resize");
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
      this.tableEnhancer?.destroy();
    });

    this.tableEnhancer.scheduleRefresh("onload");
  }

  onunload(): void {
    this._pluginInitialized = false;
    this.tableEnhancer?.destroy();
    this.tableEnhancer = null;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
