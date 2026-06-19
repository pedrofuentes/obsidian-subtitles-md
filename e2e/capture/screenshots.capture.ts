import { browser } from '@wdio/globals';
import { before, describe, it } from 'mocha';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Screenshot **capture** harness (NOT a test).
 *
 * Driven by the standalone `wdio.capture.mts` config via `pnpm capture`, this
 * spec launches the real Obsidian app, builds each shipped plugin surface inside
 * the throwaway sandbox vault at runtime (mirroring `e2e/flows.e2e.ts`), waits
 * for the live DOM to render, and writes a clean PNG to `docs/images/` with
 * `browser.saveScreenshot`. It makes no assertions — its product is the images.
 *
 * The `.capture.ts` suffix is intentionally NOT matched by `wdio.conf.mts`'s
 * `./e2e/**\/*.e2e.ts` glob, so the normal e2e run ignores this file.
 *
 * Plugin-id robustness: a sibling change is renaming the plugin id from
 * `obsidian-subtitles-md` to `subtitles-md`. To survive that, the id is
 * *discovered at runtime* from `app.plugins.plugins` (see {@link discoverPluginId})
 * and the literal below is only a last-resort fallback, kept in ONE place.
 */

/** Last-resort fallback id (current value in `manifest.json` at HEAD). */
const FALLBACK_PLUGIN_ID = 'obsidian-subtitles-md';

/** Absolute output directory for the committed documentation screenshots. */
const OUTPUT_DIR = path.resolve('docs/images');

/**
 * A short, self-describing narration. The gaps after cue 2 (2.4s) and cue 4
 * (2.7s) exceed the 2s reflow threshold, so this reflows into three tidy
 * timestamped paragraphs — enough to show the layout without overflowing.
 */
const SAMPLE_SRT = [
  '1',
  '00:00:00,500 --> 00:00:04,000',
  'Welcome to this short tour of the Subtitles MD plugin for Obsidian.',
  '',
  '2',
  '00:00:04,200 --> 00:00:08,600',
  'It turns raw subtitle files into clean, readable Markdown you can search and link.',
  '',
  '3',
  '00:00:11,000 --> 00:00:15,400',
  'Open any SRT or VTT file and it appears as a tidy transcript, never touching the original.',
  '',
  '4',
  '00:00:15,600 --> 00:00:19,800',
  'Timestamps stay attached to each paragraph so you can jump back to the moment that matters.',
  '',
  '5',
  '00:00:22,500 --> 00:00:27,000',
  'When you are ready, run the convert command to save a permanent note in your vault.',
  '',
  '6',
  '00:00:27,200 --> 00:00:31,900',
  'From there it is just Markdown: fold it, tag it, and weave it into the rest of your notes.',
  '',
].join('\n');

/** A distinctive substring guaranteed to appear in every rendered surface. */
const SAMPLE_MARKER = 'Subtitles MD plugin for Obsidian';

/** A note that embeds the sample as a fenced ` ```transcript ` block. */
const CODE_BLOCK_NOTE = [
  '# Lecture notes',
  '',
  'I keep the transcript inline with my own notes so everything stays together:',
  '',
  '```transcript',
  SAMPLE_SRT.trimEnd(),
  '```',
  '',
  'Everything below the block is my own commentary on the talk.',
  '',
].join('\n');

const CODE_BLOCK_NOTE_PATH = 'capture-code-block.md';
const VIEW_SOURCE_PATH = 'capture-transcript.srt';
const CONVERT_SOURCE_PATH = 'capture-convert.srt';
const CONVERT_NOTE_PATH = 'capture-convert.md';

/** Discover the installed plugin id at runtime, tolerant of the id rename. */
async function discoverPluginId(): Promise<string> {
  return browser.executeObsidian(({ app }, fallback) => {
    const registry = (app as unknown as {
      plugins?: { plugins?: Record<string, unknown> };
    }).plugins?.plugins;
    const ids = registry ? Object.keys(registry) : [];
    return ids.find((id) => id.includes('subtitles')) ?? fallback;
  }, FALLBACK_PLUGIN_ID);
}

/** Replace a vault file with fresh content and open it in the given mode. */
async function createAndOpen(
  filePath: string,
  contents: string,
  mode?: 'preview' | 'source',
): Promise<void> {
  await browser.executeObsidian(
    async ({ app }, source, target, openMode) => {
      const existing = app.vault.getAbstractFileByPath(target);
      if (existing) {
        await app.vault.delete(existing);
      }
      const file = await app.vault.create(target, source);
      const leaf = app.workspace.getLeaf(true);
      await leaf.openFile(
        file,
        openMode ? { state: { mode: openMode } } : undefined,
      );
    },
    contents,
    filePath,
    mode ?? null,
  );
}

/** Wait until a `.subtitles-md-transcript` container holds the sample text. */
async function waitForRenderedTranscript(): Promise<void> {
  await browser.waitUntil(
    async () =>
      browser.executeObsidian((_ctx, marker) => {
        const containers = document.querySelectorAll('.subtitles-md-transcript');
        return Array.from(containers).some((el) =>
          (el.textContent ?? '').includes(marker),
        );
      }, SAMPLE_MARKER),
    {
      timeout: 30000,
      interval: 250,
      timeoutMsg: 'transcript surface did not render in time',
    },
  );
}

/** Let Obsidian paint, then write a PNG into `docs/images/`. */
async function capture(name: string): Promise<void> {
  await browser.pause(700);
  await browser.saveScreenshot(path.join(OUTPUT_DIR, name));
}

describe('Subtitles MD documentation screenshots', function () {
  before(async function () {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    // Electron's chromedriver rejects the WebDriver "set window rect" command,
    // so size the window through Electron's own BrowserWindow API instead. This
    // is best-effort: if it is unavailable the default window size is fine.
    await browser.executeObsidian(() => {
      try {
        const req = (window as unknown as { require?: (m: string) => unknown })
          .require;
        if (typeof req !== 'function') {
          return;
        }
        const candidates = ['@electron/remote', 'electron'];
        for (const moduleName of candidates) {
          let remote: unknown;
          try {
            const mod = req(moduleName) as {
              getCurrentWindow?: () => unknown;
              remote?: { getCurrentWindow?: () => unknown };
            };
            remote = mod.getCurrentWindow ? mod : mod.remote;
          } catch {
            continue;
          }
          const getWin = (remote as { getCurrentWindow?: () => unknown })
            ?.getCurrentWindow;
          const win = getWin?.call(remote) as
            | { setSize?: (w: number, h: number) => void; center?: () => void }
            | undefined;
          if (win?.setSize) {
            win.setSize(1280, 900);
            win.center?.();
            return;
          }
        }
      } catch {
        /* default window size is acceptable for screenshots */
      }
    });
    // Dismiss any stray first-run dialog so it cannot occlude a screenshot.
    await browser.executeObsidian(() => {
      document
        .querySelectorAll('.modal-container, .modal-bg')
        .forEach((el) => el.remove());
    });
  });

  it('captures a transcript code block in reading view', async function () {
    await createAndOpen(CODE_BLOCK_NOTE_PATH, CODE_BLOCK_NOTE, 'preview');
    await waitForRenderedTranscript();
    await capture('code-block.png');
  });

  it('captures the read-only transcript file view', async function () {
    await createAndOpen(VIEW_SOURCE_PATH, SAMPLE_SRT);
    await waitForRenderedTranscript();
    await capture('file-view.png');
  });

  it('captures the note produced by the convert command', async function () {
    const pluginId = await discoverPluginId();

    await createAndOpen(CONVERT_SOURCE_PATH, SAMPLE_SRT);
    await browser.executeObsidianCommand(`${pluginId}:convert-subtitle-to-note`);

    await browser.waitUntil(
      async () =>
        browser.executeObsidian(async ({ app, obsidian }, notePath) => {
          const note = app.vault.getAbstractFileByPath(notePath);
          return note instanceof obsidian.TFile;
        }, CONVERT_NOTE_PATH),
      {
        timeout: 30000,
        interval: 250,
        timeoutMsg: `convert command did not create "${CONVERT_NOTE_PATH}"`,
      },
    );

    // Open the generated Markdown note in reading view so the frontmatter and
    // timestamped paragraphs render as a reader would see them.
    await browser.executeObsidian(async ({ app, obsidian }, notePath) => {
      const note = app.vault.getAbstractFileByPath(notePath);
      if (note instanceof obsidian.TFile) {
        const leaf = app.workspace.getLeaf(true);
        await leaf.openFile(note, { state: { mode: 'preview' } });
      }
    }, CONVERT_NOTE_PATH);

    await browser.waitUntil(
      async () =>
        browser.executeObsidian(
          ({ app, obsidian }, marker, notePath) => {
            const view = app.workspace.getActiveViewOfType(
              obsidian.MarkdownView,
            );
            if (!view || view.file?.path !== notePath) {
              return false;
            }
            const reading =
              view.contentEl.querySelector('.markdown-reading-view') ??
              view.contentEl;
            return (reading.textContent ?? '').includes(marker);
          },
          SAMPLE_MARKER,
          CONVERT_NOTE_PATH,
        ),
      {
        timeout: 30000,
        interval: 250,
        timeoutMsg: 'converted note did not render in reading view',
      },
    );

    await capture('converted-note.png');
  });

  it('captures the plugin settings tab', async function () {
    const pluginId = await discoverPluginId();

    await browser.executeObsidian(({ app }, id) => {
      const setting = (
        app as unknown as {
          setting: { open(): void; openTabById(id: string): unknown };
        }
      ).setting;
      setting.open();
      setting.openTabById(id);
    }, pluginId);

    // 'Paragraph gap threshold' is unique to this plugin's tab, so its presence
    // confirms our settings tab (not some other tab) is the one on screen.
    await browser.waitUntil(
      async () =>
        browser.executeObsidian(() => {
          const modal = document.querySelector('.modal.mod-settings');
          return (modal?.textContent ?? '').includes('Paragraph gap threshold');
        }),
      {
        timeout: 30000,
        interval: 250,
        timeoutMsg: 'plugin settings tab did not open',
      },
    );

    await capture('settings.png');
  });
});
