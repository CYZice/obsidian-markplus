import { App, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SETTINGS, TABLE_STYLE_OPTIONS } from "./constants";
import type { MarkPlusPluginApi } from "./types";

type ColorSettingKey =
  | "tableStripeRowBackgroundLight"
  | "tableStripeRowBackgroundDark"
  | "tableHeaderBackgroundLight"
  | "tableHeaderBackgroundDark";

export class MarkPlusSettingTab extends PluginSettingTab {
  plugin: MarkPlusPluginApi;

  constructor(app: App, plugin: MarkPlusPluginApi) {
    super(app, plugin as never);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl
      .createEl("h2")
      .createEl("a", {
        text: "作者：CYZice",
        href: "https://github.com/CYZice/obsidian-markplus",
      })
      .setAttr("target", "_blank");

    containerEl.createEl("h2", { text: "MarkPlus 设置" });

    new Setting(containerEl)
      .setName("任务语法自动补全")
      .setDesc("输入 `- [` 或 `-` 后继续输入时，自动补全任务列表语法。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableTaskSyntaxCompletion)
          .onChange(async (value) => {
            this.plugin.settings.enableTaskSyntaxCompletion = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("表格公式")
      .setDesc(
        "在表格最后一行单元格输入 `=sum`、`=avg`、`=count`、`=max`、`=min` 时自动计算该列数据。",
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.enableTableFormulas).onChange(async (value) => {
          this.plugin.settings.enableTableFormulas = value;
          await this.plugin.saveSettings();
          this.plugin.tableEnhancer?.scheduleRefresh("table-formula-toggle");
        });
      });

    new Setting(containerEl)
      .setName("单元格填充")
      .setDesc(
        "选中表格单元格后，可拖动右下角填充手柄复制内容；带数字的内容会按方向递增。",
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.enableTableCellFill).onChange(async (value) => {
          this.plugin.settings.enableTableCellFill = value;
          await this.plugin.saveSettings();
          this.plugin.tableEnhancer?.clearActiveFillCell();
          this.plugin.tableEnhancer?.scheduleRefresh("table-cell-fill-toggle");
        });
      });

    new Setting(containerEl)
      .setName("表格样式")
      .setDesc("为 Markdown 表格选择一种增强样式。")
      .addDropdown((dropdown) => {
        TABLE_STYLE_OPTIONS.forEach((option) => {
          dropdown.addOption(option.value, option.label);
        });
        dropdown
          .setValue(this.plugin.settings.tableStyleVariant || DEFAULT_SETTINGS.tableStyleVariant)
          .onChange(async (value) => {
            this.plugin.settings.tableStyleVariant =
              value as typeof this.plugin.settings.tableStyleVariant;
            await this.plugin.saveSettings();
            this.plugin.tableEnhancer?.scheduleRefresh("table-style-change");
          });
      });

    new Setting(containerEl).setName("隔行背景色").setHeading();
    this.addTableColorSetting(containerEl, {
      name: "浅色模式",
      desc: "浅色主题下的隔行背景色。",
      settingKey: "tableStripeRowBackgroundLight",
      theme: "light",
    });
    this.addTableColorSetting(containerEl, {
      name: "深色模式",
      desc: "深色主题下的隔行背景色。",
      settingKey: "tableStripeRowBackgroundDark",
      theme: "dark",
    });

    new Setting(containerEl).setName("表头背景色").setHeading();
    this.addTableColorSetting(containerEl, {
      name: "浅色模式",
      desc: "浅色主题下的表头背景色。",
      settingKey: "tableHeaderBackgroundLight",
      theme: "light",
    });
    this.addTableColorSetting(containerEl, {
      name: "深色模式",
      desc: "深色主题下的表头背景色。",
      settingKey: "tableHeaderBackgroundDark",
      theme: "dark",
    });
  }

  private addTableColorSetting(
    containerEl: HTMLElement,
    options: {
      name: string;
      desc: string;
      settingKey: ColorSettingKey;
      theme: "light" | "dark";
    },
  ): void {
    const parsed = parseStoredTableColor(this.plugin.settings[options.settingKey]);
    const defaultColor = resolveDefaultTableColorHex(options.theme);
    let colorPicker:
      | {
          getValue(): string;
          setValue(value: string): unknown;
        }
      | null = null;
    let slider:
      | {
          getValue(): number;
          setValue(value: number): unknown;
        }
      | null = null;

    new Setting(containerEl)
      .setName(options.name)
      .setDesc(options.desc)
      .addColorPicker((component) => {
        colorPicker = component;
        component.setValue(parsed?.hex || defaultColor);
        component.onChange(async () => {
          await this.persistTableColorSetting(options.settingKey, colorPicker, slider);
        });
      })
      .addSlider((component) => {
        slider = component;
        component.setLimits(0, 100, 1);
        component.setDynamicTooltip();
        component.setValue(Math.round((parsed?.alpha ?? 1) * 100));
        component.onChange(async () => {
          await this.persistTableColorSetting(options.settingKey, colorPicker, slider);
        });
      })
      .addExtraButton((button) => {
        button.setIcon("rotate-ccw").setTooltip("恢复默认").onClick(async () => {
          this.plugin.settings[options.settingKey] = "";
          await this.plugin.saveSettings();
          this.plugin.applyTableStyleVariables();
          colorPicker?.setValue(defaultColor);
          slider?.setValue(100);
          this.plugin.tableEnhancer?.scheduleRefresh("table-color-reset");
        });
      });
  }

  private async persistTableColorSetting(
    settingKey: ColorSettingKey,
    colorPicker: { getValue(): string } | null,
    slider: { getValue(): number } | null,
  ): Promise<void> {
    if (!colorPicker) {
      return;
    }

    this.plugin.settings[settingKey] = formatTableColorValue(
      colorPicker.getValue(),
      (slider?.getValue() ?? 100) / 100,
    );
    await this.plugin.saveSettings();
    this.plugin.applyTableStyleVariables();
    this.plugin.tableEnhancer?.scheduleRefresh("table-color-change");
  }
}

function parseStoredTableColor(
  value: string,
): { hex: string; alpha: number } | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,/]\s*([01]?(?:\.\d+)?))?\s*\)$/i,
  );
  if (rgbaMatch) {
    const [, r, g, b, alphaRaw] = rgbaMatch;
    return {
      hex: rgbToHex(Number(r), Number(g), Number(b)),
      alpha: alphaRaw === undefined ? 1 : clampAlpha(Number(alphaRaw)),
    };
  }

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    return { hex: normalizeHex(trimmed), alpha: 1 };
  }

  return null;
}

function resolveDefaultTableColorHex(_theme: "light" | "dark"): string {
  return "#dfe4ea";
}

function formatTableColorValue(hex: string, alpha: number): string {
  const normalizedHex = normalizeHex(hex);
  const { r, g, b } = hexToRgb(normalizedHex);
  const normalizedAlpha = clampAlpha(alpha);
  return normalizedAlpha >= 0.999
    ? normalizedHex
    : `rgba(${r}, ${g}, ${b}, ${normalizedAlpha.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")})`;
}

function normalizeHex(hex: string): string {
  const trimmed = String(hex || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }
  return "#dfe4ea";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function clampAlpha(alpha: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1));
}
