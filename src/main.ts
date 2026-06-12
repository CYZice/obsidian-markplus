import { Plugin } from "obsidian";
import {
  DEFAULT_SETTINGS,
  MARKPLUS_TABLE_COLOR_STYLE_ID,
  MARKPLUS_TABLE_HEADER_BACKGROUND_VAR,
  MARKPLUS_TABLE_STRIPE_ROW_BACKGROUND_VAR,
} from "./constants";
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
    const loaded = ((await this.loadData()) || {}) as Record<string, unknown>;
    const migrated = migrateLegacyTableColorSettings(loaded);
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    delete (this.settings as Record<string, unknown>).tableStyles;
    delete (this.settings as Record<string, unknown>).tableStripeRowBackground;
    delete (this.settings as Record<string, unknown>).tableHeaderBackground;
    this.tableEnhancer = new TableColumnResizeController(this as never);
    if (migrated) {
      await this.saveSettings();
    }
    this.applyTableStyleVariables();

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
      document.getElementById(MARKPLUS_TABLE_COLOR_STYLE_ID)?.remove();
      this.tableEnhancer?.destroy();
    });

    this.tableEnhancer.scheduleRefresh("onload");
  }

  onunload(): void {
    this._pluginInitialized = false;
    document.getElementById(MARKPLUS_TABLE_COLOR_STYLE_ID)?.remove();
    this.tableEnhancer?.destroy();
    this.tableEnhancer = null;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  applyTableStyleVariables(): void {
    let styleEl = document.getElementById(MARKPLUS_TABLE_COLOR_STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = MARKPLUS_TABLE_COLOR_STYLE_ID;
      document.head.appendChild(styleEl);
    }

    const rules: string[] = [];
    appendTableColorThemeRule(
      rules,
      "theme-light",
      MARKPLUS_TABLE_STRIPE_ROW_BACKGROUND_VAR,
      this.settings.tableStripeRowBackgroundLight,
    );
    appendTableColorThemeRule(
      rules,
      "theme-dark",
      MARKPLUS_TABLE_STRIPE_ROW_BACKGROUND_VAR,
      this.settings.tableStripeRowBackgroundDark,
    );
    appendTableColorThemeRule(
      rules,
      "theme-light",
      MARKPLUS_TABLE_HEADER_BACKGROUND_VAR,
      this.settings.tableHeaderBackgroundLight,
    );
    appendTableColorThemeRule(
      rules,
      "theme-dark",
      MARKPLUS_TABLE_HEADER_BACKGROUND_VAR,
      this.settings.tableHeaderBackgroundDark,
    );
    styleEl.textContent = rules.join("\n");
  }
}

function migrateLegacyTableColorSettings(data: Record<string, unknown>): boolean {
  let changed = false;
  const stripe =
    typeof data.tableStripeRowBackground === "string" ? data.tableStripeRowBackground : "";
  const header =
    typeof data.tableHeaderBackground === "string" ? data.tableHeaderBackground : "";

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

function appendTableColorThemeRule(
  rules: string[],
  themeClass: "theme-light" | "theme-dark",
  variableName: string,
  value: string,
): void {
  const trimmed = String(value || "").trim();
  if (trimmed) {
    rules.push(`body.${themeClass} { ${variableName}: ${trimmed}; }`);
  }
}
