import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { DEFAULT_SETTINGS, type SubtitlesMdSettings } from './settings';
import { SubtitlesMdSettingTab, type SettingsHost } from './settings-tab';

/**
 * Inline `obsidian` mock. The shared test stub only exposes `normalizePath`,
 * so the surfaces this UI module needs (`PluginSettingTab`, `Setting`, and the
 * component builders) are provided here as recording fakes.
 *
 * - `Setting` registers itself on the `containerEl.settings` array it is
 *   constructed with, so a test-owned fake container can observe every setting.
 * - Each `add*` builder constructs a recording control, invokes the caller's
 *   builder callback with it, and stores it on the setting's `components`.
 */
vi.mock('obsidian', () => {
  interface RecordingControl {
    type: string;
    value: unknown;
    options: Record<string, string>;
    changeHandler?: (value: unknown) => unknown;
    setValue(value: unknown): RecordingControl;
    onChange(cb: (value: unknown) => unknown): RecordingControl;
    addOptions(options: Record<string, string>): RecordingControl;
    addOption(value: string, display: string): RecordingControl;
    setPlaceholder(placeholder: string): RecordingControl;
    setDisabled(disabled: boolean): RecordingControl;
  }

  const makeControl = (type: string): RecordingControl => ({
    type,
    value: undefined,
    options: {},
    changeHandler: undefined,
    setValue(value) {
      this.value = value;
      return this;
    },
    onChange(cb) {
      this.changeHandler = cb;
      return this;
    },
    addOptions(options) {
      Object.assign(this.options, options);
      return this;
    },
    addOption(value, display) {
      this.options[value] = display;
      return this;
    },
    setPlaceholder() {
      return this;
    },
    setDisabled() {
      return this;
    },
  });

  class Setting {
    name = '';
    desc = '';
    components: RecordingControl[] = [];
    containerEl: { settings: Setting[] };

    constructor(containerEl: { settings: Setting[] }) {
      this.containerEl = containerEl;
      containerEl.settings.push(this);
    }

    setName(name: string): this {
      this.name = name;
      return this;
    }

    setDesc(desc: string): this {
      this.desc = desc;
      return this;
    }

    addDropdown(cb: (control: RecordingControl) => void): this {
      const control = makeControl('dropdown');
      cb(control);
      this.components.push(control);
      return this;
    }

    addToggle(cb: (control: RecordingControl) => void): this {
      const control = makeControl('toggle');
      cb(control);
      this.components.push(control);
      return this;
    }

    addText(cb: (control: RecordingControl) => void): this {
      const control = makeControl('text');
      cb(control);
      this.components.push(control);
      return this;
    }
  }

  class PluginSettingTab {
    app: unknown;
    plugin: unknown;
    containerEl: unknown;

    constructor(app: unknown, plugin: unknown) {
      this.app = app;
      this.plugin = plugin;
    }
  }

  return { PluginSettingTab, Setting };
});

/** Names the tab assigns to each setting, used to locate them in assertions. */
const NAMES = {
  timestamps: 'Timestamps',
  includeFrontmatter: 'Include frontmatter',
  speakerStyle: 'Speaker style',
  breakOnSpeakerChange: 'New paragraph on speaker change',
  breakOnSentenceEnd: 'Split on sentence end',
  gapThresholdMs: 'Paragraph gap threshold (ms)',
} as const;

interface FakeSetting {
  name: string;
  desc: string;
  components: Array<{
    type: string;
    value: unknown;
    options: Record<string, string>;
    changeHandler?: (value: unknown) => unknown;
  }>;
}

interface FakeContainer {
  settings: FakeSetting[];
  empty(): void;
}

function makeContainer(): FakeContainer {
  return {
    settings: [],
    empty() {
      this.settings = [];
    },
  };
}

function makeHost(
  overrides: Partial<SubtitlesMdSettings> = {},
): SettingsHost & { saveSettings: ReturnType<typeof vi.fn> } {
  return {
    settings: { ...DEFAULT_SETTINGS, ...overrides },
    saveSettings: vi.fn(() => Promise.resolve()),
  };
}

function setup(host: SettingsHost): {
  container: FakeContainer;
  tab: SubtitlesMdSettingTab;
} {
  const app = {} as unknown as App;
  const container = makeContainer();
  const tab = new SubtitlesMdSettingTab(app, host);
  (tab as unknown as { containerEl: FakeContainer }).containerEl = container;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- the tab intentionally overrides PluginSettingTab.display
  tab.display();
  return { container, tab };
}

const byName = (container: FakeContainer, name: string): FakeSetting => {
  const found = container.settings.find((s) => s.name === name);
  if (!found) throw new Error(`setting not found: ${name}`);
  return found;
};

type FakeControl = FakeSetting['components'][number];

const control = (container: FakeContainer, name: string): FakeControl => {
  const [first] = byName(container, name).components;
  if (!first) throw new Error(`setting has no control: ${name}`);
  return first;
};

describe('SubtitlesMdSettingTab', () => {
  let host: SettingsHost & { saveSettings: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    host = makeHost();
  });

  it('creates one setting per field (6 total)', () => {
    const { container } = setup(host);
    expect(container.settings).toHaveLength(6);
    for (const name of Object.values(NAMES)) {
      expect(byName(container, name)).toBeTruthy();
    }
  });

  it('clears the container before building (display is idempotent)', () => {
    const app = {} as unknown as App;
    const container = makeContainer();
    const tab = new SubtitlesMdSettingTab(app, host);
    (tab as unknown as { containerEl: FakeContainer }).containerEl = container;
    /* eslint-disable @typescript-eslint/no-deprecated -- the tab intentionally overrides PluginSettingTab.display */
    tab.display();
    tab.display();
    /* eslint-enable @typescript-eslint/no-deprecated */
    expect(container.settings).toHaveLength(6);
  });

  it('gives every setting a name and description', () => {
    const { container } = setup(host);
    for (const setting of container.settings) {
      expect(setting.name.length).toBeGreaterThan(0);
      expect(setting.desc.length).toBeGreaterThan(0);
    }
  });

  it('reflects initial settings values in each control', () => {
    host = makeHost({
      timestamps: 'aside',
      includeFrontmatter: false,
      speakerStyle: 'heading',
      breakOnSpeakerChange: false,
      breakOnSentenceEnd: true,
      gapThresholdMs: 1500,
    });
    const { container } = setup(host);

    expect(control(container, NAMES.timestamps).value).toBe(
      'aside',
    );
    expect(control(container, NAMES.includeFrontmatter).value).toBe(
      false,
    );
    expect(control(container, NAMES.speakerStyle).value).toBe(
      'heading',
    );
    expect(
      control(container, NAMES.breakOnSpeakerChange).value,
    ).toBe(false);
    expect(control(container, NAMES.breakOnSentenceEnd).value).toBe(
      true,
    );
    expect(control(container, NAMES.gapThresholdMs).value).toBe(
      '1500',
    );
  });

  it('offers the documented dropdown options', () => {
    const { container } = setup(host);
    expect(Object.keys(control(container, NAMES.timestamps).options)).toEqual([
      'none',
      'inline',
      'aside',
    ]);
    expect(Object.keys(control(container, NAMES.speakerStyle).options)).toEqual([
      'bold',
      'heading',
    ]);
  });

  it('updates timestamps and persists on change', async () => {
    const { container } = setup(host);
    await control(container, NAMES.timestamps).changeHandler?.(
      'none',
    );
    expect(host.settings.timestamps).toBe('none');
    expect(host.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('updates includeFrontmatter and persists on change', async () => {
    const { container } = setup(host);
    await control(container, NAMES.includeFrontmatter).changeHandler?.(false);
    expect(host.settings.includeFrontmatter).toBe(false);
    expect(host.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('updates speakerStyle and persists on change', async () => {
    const { container } = setup(host);
    await control(container, NAMES.speakerStyle).changeHandler?.(
      'heading',
    );
    expect(host.settings.speakerStyle).toBe('heading');
    expect(host.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('updates breakOnSpeakerChange and persists on change', async () => {
    const { container } = setup(host);
    await control(container, NAMES.breakOnSpeakerChange).changeHandler?.(false);
    expect(host.settings.breakOnSpeakerChange).toBe(false);
    expect(host.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('updates breakOnSentenceEnd and persists on change', async () => {
    const { container } = setup(host);
    await control(container, NAMES.breakOnSentenceEnd).changeHandler?.(true);
    expect(host.settings.breakOnSentenceEnd).toBe(true);
    expect(host.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('parses a valid non-negative integer for gap threshold', async () => {
    const { container } = setup(host);
    await control(container, NAMES.gapThresholdMs).changeHandler?.(
      '3500',
    );
    expect(host.settings.gapThresholdMs).toBe(3500);
    expect(host.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('ignores non-numeric gap threshold input (no NaN written)', async () => {
    host = makeHost({ gapThresholdMs: 2000 });
    const { container } = setup(host);
    await control(container, NAMES.gapThresholdMs).changeHandler?.(
      'abc',
    );
    expect(host.settings.gapThresholdMs).toBe(2000);
    expect(Number.isNaN(host.settings.gapThresholdMs)).toBe(false);
    expect(host.saveSettings).not.toHaveBeenCalled();
  });

  it('ignores negative gap threshold input', async () => {
    host = makeHost({ gapThresholdMs: 2000 });
    const { container } = setup(host);
    await control(container, NAMES.gapThresholdMs).changeHandler?.(
      '-5',
    );
    expect(host.settings.gapThresholdMs).toBe(2000);
    expect(host.saveSettings).not.toHaveBeenCalled();
  });
});

