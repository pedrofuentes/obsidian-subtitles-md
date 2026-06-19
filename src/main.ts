import { Plugin } from 'obsidian';
import type { ConvertOptions } from './commands/convertToNote';
import { runConvertActiveFile } from './commands/runConvert';
import {
  registerTranscriptCodeBlock,
  type TranscriptBlockOptions,
} from './render/codeblock';
import {
  registerTranscriptView,
  type TranscriptViewOptions,
} from './render/view';
import { SubtitlesMdSettingTab } from './settings-tab';
import {
  DEFAULT_SETTINGS,
  settingsToReflowOptions,
  settingsToSerializeOptions,
  type SubtitlesMdSettings,
} from './settings';

/**
 * Entry point for the Subtitles MD plugin.
 *
 * Kept intentionally thin: it loads persisted settings and wires up the plugin's
 * surfaces — the "Convert subtitle file to transcript note" command, the
 * ` ```transcript ` reading-view code block, the read-only `.srt`/`.vtt` file
 * view, and the settings tab. All conversion logic lives in
 * {@link runConvertActiveFile} and the pure pipeline it wraps; the render
 * surfaces are driven by per-render option projections ({@link codeBlockOptions}
 * and {@link viewOptions}) so live settings changes take effect immediately.
 */
export default class SubtitlesMdPlugin extends Plugin {
  settings: SubtitlesMdSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: 'convert-subtitle-to-note',
      name: 'Convert subtitle file to transcript note',
      callback: () => {
        void runConvertActiveFile(this.app, this.settingsToOptions());
      },
    });

    registerTranscriptCodeBlock(this, () => this.codeBlockOptions());
    registerTranscriptView(this, () => this.viewOptions());
    this.addSettingTab(new SubtitlesMdSettingTab(this.app, this));
  }

  /** Merge persisted data over the defaults into {@link settings}. */
  async loadSettings(): Promise<void> {
    const stored =
      (await this.loadData()) as Partial<SubtitlesMdSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...stored };
  }

  /** Persist the current {@link settings}. */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Translate persisted settings into pipeline {@link ConvertOptions}. */
  settingsToOptions(): ConvertOptions {
    return {
      reflow: settingsToReflowOptions(this.settings),
      serialize: settingsToSerializeOptions(this.settings),
    };
  }

  /** Project persisted settings into ` ```transcript ` code-block options. */
  codeBlockOptions(): TranscriptBlockOptions {
    return {
      reflow: settingsToReflowOptions(this.settings),
      timestamps: this.settings.timestamps,
      speaker: true,
    };
  }

  /** Project persisted settings into read-only transcript view options. */
  viewOptions(): TranscriptViewOptions {
    return {
      reflow: settingsToReflowOptions(this.settings),
      showTimestamps: this.settings.timestamps !== 'none',
    };
  }
}
