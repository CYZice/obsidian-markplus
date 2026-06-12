import { App, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SETTINGS } from "./constants";
import type { MarkPlusPluginApi } from "./types";

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
        "选中表格单元格后，可拖动右下角填充手柄向上下左右复制内容；数字单元格会按 +1 递增。",
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
        dropdown
          .addOption("default", "默认样式")
          .addOption("horizontal-lines", "横线样式")
          .addOption("striped-rows", "隔行背景")
          .addOption("horizontal-lines-striped", "横线 + 隔行背景")
          .setValue(this.plugin.settings.tableStyleVariant || DEFAULT_SETTINGS.tableStyleVariant)
          .onChange(async (value) => {
            this.plugin.settings.tableStyleVariant = value as typeof this.plugin.settings.tableStyleVariant;
            await this.plugin.saveSettings();
            this.plugin.tableEnhancer?.scheduleRefresh("table-style-change");
          });
      });
  }
}
