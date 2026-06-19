import { Plugin } from 'obsidian';
import type { ConvertOptions } from './commands/convertToNote';
import { runConvertActiveFile } from './commands/runConvert';
import {
  DEFAULT_SETTINGS,
  settingsToReflowOptions,
  settingsToSerializeOptions,
  type SubtitlesMdSettings,
} from './settings';

/**
 * Entry point for the obsidian-subtitles-md plugin.
 *
 * Kept intentionally thin: it loads persisted settings and registers the
 * "Convert subtitle file to transcript note" command. All conversion logic
 * lives in {@link runConvertActiveFile} and the pure pipeline it wraps.
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
}
