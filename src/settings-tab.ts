/**
 * Settings tab UI for the obsidian-subtitles-md plugin.
 *
 * Renders one {@link Setting} per persisted preference defined in
 * {@link SubtitlesMdSettings}. Each control reads its current value from the
 * host's settings and, on change, writes the new value back and persists it via
 * {@link SettingsHost.saveSettings}. The tab is intentionally decoupled from the
 * concrete `Plugin` — it depends only on the small {@link SettingsHost} surface,
 * which the plugin satisfies. Wiring (`addSettingTab`) lives in the plugin
 * entry point, not here.
 */

import { type App, type Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { SpeakerStyle, TimestampStyle } from './serialize/markdown';
import type { SubtitlesMdSettings } from './settings';

/** Minimal surface the settings tab needs from its owning plugin. */
export interface SettingsHost {
  /** The live, mutable settings object the tab reads from and writes to. */
  settings: SubtitlesMdSettings;
  /** Persist the current {@link settings}. */
  saveSettings(): Promise<void>;
}

const TIMESTAMP_OPTIONS: Record<TimestampStyle, string> = {
  none: 'None',
  inline: 'Inline',
  aside: 'Aside',
};

const SPEAKER_OPTIONS: Record<SpeakerStyle, string> = {
  bold: 'Bold',
  heading: 'Heading',
};

/** Plugin settings tab presenting every conversion preference. */
export class SubtitlesMdSettingTab extends PluginSettingTab {
  private readonly host: SettingsHost;

  constructor(app: App, host: SettingsHost) {
    super(app, host as unknown as Plugin);
    this.host = host;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const settings = this.host.settings;

    new Setting(containerEl)
      .setName('Timestamps')
      .setDesc('How cue timestamps are rendered in the generated note.')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(TIMESTAMP_OPTIONS)
          .setValue(settings.timestamps)
          .onChange(async (value) => {
            settings.timestamps = value as TimestampStyle;
            await this.host.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Include frontmatter')
      .setDesc('Add a YAML frontmatter block at the top of the note.')
      .addToggle((toggle) =>
        toggle
          .setValue(settings.includeFrontmatter)
          .onChange(async (value) => {
            settings.includeFrontmatter = value;
            await this.host.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Speaker style')
      .setDesc('How speaker labels are formatted before their lines.')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(SPEAKER_OPTIONS)
          .setValue(settings.speakerStyle)
          .onChange(async (value) => {
            settings.speakerStyle = value as SpeakerStyle;
            await this.host.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('New paragraph on speaker change')
      .setDesc('Start a new paragraph whenever the speaker changes.')
      .addToggle((toggle) =>
        toggle
          .setValue(settings.breakOnSpeakerChange)
          .onChange(async (value) => {
            settings.breakOnSpeakerChange = value;
            await this.host.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Split on sentence end')
      .setDesc('Start a new paragraph after a sentence-ending punctuation.')
      .addToggle((toggle) =>
        toggle
          .setValue(settings.breakOnSentenceEnd)
          .onChange(async (value) => {
            settings.breakOnSentenceEnd = value;
            await this.host.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Paragraph gap threshold (ms)')
      .setDesc(
        'Start a new paragraph when the silent gap between cues exceeds this many milliseconds.',
      )
      .addText((text) =>
        text
          .setValue(String(settings.gapThresholdMs))
          .onChange(async (value) => {
            const trimmed = value.trim();
            if (!/^\d+$/.test(trimmed)) {
              return;
            }
            settings.gapThresholdMs = Number.parseInt(trimmed, 10);
            await this.host.saveSettings();
          }),
      );
  }
}
