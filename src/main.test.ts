import { describe, expect, it, vi, type Mock } from 'vitest';

/**
 * Inline `obsidian` mock. The shared `tests/mocks/obsidian.mjs` stub only
 * exposes `normalizePath`, but loading `main.ts` (and the surfaces it wires)
 * needs runtime constructors for the classes the plugin and its registered
 * modules extend: `Plugin` (the entry point), `TextFileView` (the transcript
 * view) and `PluginSettingTab` (the settings tab). Each registration hook on
 * the base `Plugin` is a recording `vi.fn()` so `onload()` wiring is observable.
 */
vi.mock('obsidian', () => {
  class Plugin {
    app: unknown = {};
    addCommand = vi.fn();
    registerMarkdownCodeBlockProcessor = vi.fn();
    registerView = vi.fn();
    registerExtensions = vi.fn();
    addSettingTab = vi.fn();
    loadData = vi.fn(() => Promise.resolve(null));
    saveData = vi.fn(() => Promise.resolve());
  }
  class PluginSettingTab {
    app: unknown;
    constructor(app: unknown) {
      this.app = app;
    }
  }
  class Setting {
    setName(): this {
      return this;
    }
    setDesc(): this {
      return this;
    }
    addDropdown(): this {
      return this;
    }
    addToggle(): this {
      return this;
    }
    addText(): this {
      return this;
    }
  }
  class TextFileView {
    leaf: unknown;
    constructor(leaf: unknown) {
      this.leaf = leaf;
    }
  }
  class TFile {
    path = '';
    name = '';
    basename = '';
    extension = '';
  }
  return {
    Plugin,
    PluginSettingTab,
    Setting,
    TextFileView,
    TFile,
    normalizePath: (p: string): string => p,
  };
});

import SubtitlesMdPlugin from './main';
import { TRANSCRIPT_VIEW_TYPE } from './render/view';
import { settingsToReflowOptions } from './settings';

/**
 * The inline mock provides each registration hook as a `vi.fn()` on the base
 * `Plugin`, but the real obsidian types describe them as prototype methods.
 * Project a plugin instance onto this surface to read the recorded mock calls.
 */
interface PluginMockSurface {
  addCommand: Mock;
  registerMarkdownCodeBlockProcessor: Mock;
  registerView: Mock;
  registerExtensions: Mock;
  addSettingTab: Mock;
}

/**
 * Instantiate the plugin through the no-arg mock constructor (the real obsidian
 * `Plugin` constructor wants `(app, manifest)`; the mock needs neither) and run
 * `onload()`.
 */
async function loadPlugin(): Promise<{
  plugin: SubtitlesMdPlugin;
  hooks: PluginMockSurface;
}> {
  const Ctor = SubtitlesMdPlugin as unknown as new () => SubtitlesMdPlugin;
  const plugin = new Ctor();
  await plugin.onload();
  return { plugin, hooks: plugin as unknown as PluginMockSurface };
}

describe('SubtitlesMdPlugin onload wiring', () => {
  it('keeps the convert command registered (regression guard)', async () => {
    const { hooks } = await loadPlugin();
    expect(hooks.addCommand).toHaveBeenCalledTimes(1);
    expect(hooks.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'convert-subtitle-to-note' }),
    );
  });

  it('registers the transcript reading-view code block', async () => {
    const { hooks } = await loadPlugin();
    expect(hooks.registerMarkdownCodeBlockProcessor).toHaveBeenCalledWith(
      'transcript',
      expect.any(Function),
    );
  });

  it('registers the transcript file view and subtitle extensions', async () => {
    const { hooks } = await loadPlugin();
    expect(hooks.registerView).toHaveBeenCalledWith(
      TRANSCRIPT_VIEW_TYPE,
      expect.any(Function),
    );
    expect(hooks.registerExtensions).toHaveBeenCalledWith(
      ['srt', 'vtt'],
      TRANSCRIPT_VIEW_TYPE,
    );
  });

  it('adds the settings tab exactly once', async () => {
    const { hooks } = await loadPlugin();
    expect(hooks.addSettingTab).toHaveBeenCalledTimes(1);
  });
});

describe('SubtitlesMdPlugin option projections', () => {
  it('projects code block options from the default settings', async () => {
    const { plugin } = await loadPlugin();
    const options = plugin.codeBlockOptions();
    expect(options.timestamps).toBe('inline');
    expect(options.speaker).toBe(true);
    expect(options.speakerStyle).toBe('bold');
    expect(options.reflow).toEqual(settingsToReflowOptions(plugin.settings));
  });

  it('projects view options from the default settings', async () => {
    const { plugin } = await loadPlugin();
    const options = plugin.viewOptions();
    expect(options.timestamps).toBe('inline');
    expect(options.speakerStyle).toBe('bold');
    expect(options.reflow).toEqual(settingsToReflowOptions(plugin.settings));
  });

  it('propagates the heading speaker style to both projections', async () => {
    const { plugin } = await loadPlugin();
    plugin.settings.speakerStyle = 'heading';
    expect(plugin.viewOptions().speakerStyle).toBe('heading');
    expect(plugin.codeBlockOptions().speakerStyle).toBe('heading');
  });

  it('disables timestamps in both projections when set to none', async () => {
    const { plugin } = await loadPlugin();
    plugin.settings.timestamps = 'none';
    expect(plugin.viewOptions().timestamps).toBe('none');
    expect(plugin.codeBlockOptions().timestamps).toBe('none');
  });

  it('propagates the aside timestamp style to the view projection', async () => {
    const { plugin } = await loadPlugin();
    plugin.settings.timestamps = 'aside';
    expect(plugin.viewOptions().timestamps).toBe('aside');
  });
});
