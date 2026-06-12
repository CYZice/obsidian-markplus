import type { App, MarkdownView, TFile } from "obsidian";

export type TableStyleVariant =
  | "default"
  | "horizontal-lines"
  | "striped-rows"
  | "horizontal-lines-striped";

export interface MarkPlusSettings {
  minColumnWidth: number;
  pixelsPerDash: number;
  enableTaskSyntaxCompletion: boolean;
  enableTableFormulas: boolean;
  enableTableCellFill: boolean;
  tableStyleVariant: TableStyleVariant;
}

export interface MarkdownTableColumn {
  alignLeft: boolean;
  alignRight: boolean;
  dashCount: number;
}

export interface MarkdownTableSpec {
  separatorLineIndex: number;
  headerLineIndex: number;
  columns: MarkdownTableColumn[];
  headerCells: string[];
  bodyLines: string[];
  rawHeaderLine: string;
  rawSeparatorLine: string;
}

export interface EditorPosition {
  line: number;
  ch: number;
}

export interface EditorLike {
  getValue(): string;
  getLine(line: number): string;
  replaceRange(
    text: string,
    from: EditorPosition,
    to?: EditorPosition,
  ): void;
  getCursor?(): EditorPosition;
  setCursor?(position: EditorPosition): void;
}

export type MarkdownViewLike = MarkdownView & {
  editor?: EditorLike;
  file?: TFile | null;
  contentEl: HTMLElement;
};

export interface EditorChangeContext {
  file?: TFile | null;
  view?: MarkdownViewLike | null;
}

export interface TableEnhancerLike {
  scheduleRefresh(reason?: string): void;
  clearActiveFillCell(): void;
}

export interface MarkPlusPluginApi {
  app: App;
  settings: MarkPlusSettings;
  tableEnhancer: TableEnhancerLike | null;
  saveSettings(): Promise<void>;
}
