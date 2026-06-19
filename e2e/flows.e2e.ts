import { browser, expect } from '@wdio/globals';
import { afterEach, describe, it } from 'mocha';

/**
 * End-to-end coverage for the plugin's real user flows, driven through the live
 * Obsidian `app` via `browser.executeObsidian(...)`.
 *
 * Each spec creates its own subtitle file in the throwaway vault, exercises a
 * shipped plugin surface, asserts the observable result, and is cleaned up by
 * `afterEach` so the specs stay independent and well within the 60s timeout.
 *
 * `injectGlobals: false` (see `wdio.conf.mts`) means describe/it/expect are
 * imported explicitly. The function bodies passed to `executeObsidian` are
 * serialized and run inside Obsidian, so they cannot close over module-scope
 * values: every input is passed as an explicit, structured-cloneable argument,
 * and the plugin id / command id / view type are inlined here as literals
 * (matching the `app.plugins` pattern in `smoke.e2e.ts`, which is acceptable
 * only in e2e tests).
 */

/** Plugin id + command id, as registered by `src/main.ts` `onload()`. */
const CONVERT_COMMAND_ID = 'obsidian-subtitles-md:convert-subtitle-to-note';
/** View type bound to `.srt`/`.vtt` by `src/render/view.ts`. */
const TRANSCRIPT_VIEW_TYPE = 'subtitles-md-transcript-view';

const CONVERT_SOURCE_PATH = 'convert-sample.srt';
// `convertToNote.ts` derives the note name from the source basename, so
// `convert-sample.srt` (at the vault root) produces `convert-sample.md`.
const CONVERT_NOTE_PATH = 'convert-sample.md';
const VIEW_SOURCE_PATH = 'view-sample.srt';
const CODE_BLOCK_NOTE_PATH = 'codeblock-sample.md';

/**
 * A few realistic SRT cues. Each cue holds a distinct, self-contained sentence
 * so we can assert that a single cue's words survive the real
 * parse -> reflow -> serialize pipeline as a contiguous substring.
 */
const SAMPLE_SRT = [
  '1',
  '00:00:01,000 --> 00:00:03,500',
  'Hello and welcome to the integration test.',
  '',
  '2',
  '00:00:04,000 --> 00:00:07,800',
  'This clip exercises the convert command end to end.',
  '',
  '3',
  '00:00:08,200 --> 00:00:11,000',
  'Subtitle text should survive the reflow pipeline.',
  '',
].join('\n');

/** Best-effort, order-independent deletion of vault paths (used for cleanup). */
async function deleteVaultPaths(paths: string[]): Promise<void> {
  await browser.executeObsidian(async ({ app }, toDelete) => {
    for (const path of toDelete) {
      const file = app.vault.getAbstractFileByPath(path);
      if (file) {
        await app.vault.delete(file);
      }
    }
  }, paths);
}

describe('Subtitles MD end-to-end flows', function () {
  afterEach(async function () {
    await deleteVaultPaths([
      CONVERT_SOURCE_PATH,
      CONVERT_NOTE_PATH,
      VIEW_SOURCE_PATH,
      CODE_BLOCK_NOTE_PATH,
    ]);
  });

  it('converts the active subtitle file into a transcript note', async function () {
    // Create the source subtitle file and make it the active file.
    await browser.executeObsidian(
      async ({ app }, source, path) => {
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing) {
          await app.vault.delete(existing);
        }
        const file = await app.vault.create(path, source);
        const leaf = app.workspace.getLeaf(true);
        await leaf.openFile(file);
      },
      SAMPLE_SRT,
      CONVERT_SOURCE_PATH,
    );

    // Run the real plugin command. The command's callback is fire-and-forget,
    // so the note is written asynchronously after this resolves.
    await browser.executeObsidianCommand(CONVERT_COMMAND_ID);

    // Poll until the generated note exists, capturing its contents.
    let noteContent = '';
    await browser.waitUntil(
      async () => {
        noteContent = await browser.executeObsidian(
          async ({ app, obsidian }, path) => {
            const note = app.vault.getAbstractFileByPath(path);
            if (note instanceof obsidian.TFile) {
              return app.vault.read(note);
            }
            return '';
          },
          CONVERT_NOTE_PATH,
        );
        return noteContent.length > 0;
      },
      {
        timeout: 20000,
        interval: 250,
        timeoutMsg: `Converted note "${CONVERT_NOTE_PATH}" was not created in time`,
      },
    );

    // Cue text survived parse -> reflow -> serialize intact...
    expect(noteContent).toContain(
      'This clip exercises the convert command end to end.',
    );
    expect(noteContent).toContain('Hello and welcome to the integration test.');
    // ...and the output is transformed Markdown, not a copy of the raw SRT
    // timing lines (which contain `-->`).
    expect(noteContent).not.toContain('-->');
  });

  it('opens .srt files in the read-only transcript view', async function () {
    const viewType = await browser.executeObsidian(
      async ({ app }, source, path) => {
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing) {
          await app.vault.delete(existing);
        }
        const file = await app.vault.create(path, source);
        const leaf = app.workspace.getLeaf(true);
        await leaf.openFile(file);
        return leaf.view.getViewType();
      },
      SAMPLE_SRT,
      VIEW_SOURCE_PATH,
    );

    // The plugin's `registerExtensions(['srt', 'vtt'], ...)` took over the
    // extension, so opening the file lands in the transcript view.
    expect(viewType).toBe(TRANSCRIPT_VIEW_TYPE);
  });

  it('renders an inline transcript code block in reading view', async function () {
    const blockNote =
      '```transcript\n' +
      '1\n' +
      '00:00:01,000 --> 00:00:03,500\n' +
      'Rendered from a fenced transcript block.\n' +
      '```\n';

    // Open the note in reading view so the markdown code-block processor runs.
    await browser.executeObsidian(
      async ({ app }, note, path) => {
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing) {
          await app.vault.delete(existing);
        }
        const file = await app.vault.create(path, note);
        const leaf = app.workspace.getLeaf(true);
        await leaf.openFile(file, { state: { mode: 'preview' } });
      },
      blockNote,
      CODE_BLOCK_NOTE_PATH,
    );

    // The block renders asynchronously. Poll for a `.subtitles-md-transcript`
    // container holding *our* cue text, so the assertion can't be satisfied by
    // a transcript surface left over from another spec.
    let rendered = false;
    await browser.waitUntil(
      async () => {
        rendered = await browser.executeObsidian(() => {
          const containers = document.querySelectorAll(
            '.subtitles-md-transcript',
          );
          return Array.from(containers).some((el) =>
            (el.textContent ?? '').includes(
              'Rendered from a fenced transcript block.',
            ),
          );
        });
        return rendered;
      },
      {
        timeout: 20000,
        interval: 250,
        timeoutMsg: 'transcript code block did not render in reading view',
      },
    );

    expect(rendered).toBe(true);
  });
});
