/**
 * Reading-view renderer for ` ```transcript ` code blocks.
 *
 * A `transcript` block body is either inline subtitle content (`.srt` / `.vtt`)
 * or a single-line file reference (`file:` / `source:`) pointing at a subtitle
 * file in the vault. Either way the block is resolved to text, run through the
 * pure pipeline (`parseSubtitle` -> `reflow`), and rendered as a clean, readable
 * DOM tree under the supplied element.
 *
 * **Security:** cue `text` and `speaker` originate from arbitrary subtitle files
 * and are therefore UNTRUSTED. They reach the DOM *only* as text — every element
 * is built with Obsidian's `createEl`/`createDiv`/`createSpan` helpers and the
 * `text` option (which assigns `textContent`). This module never touches
 * `innerHTML`, `outerHTML`, or `insertAdjacentHTML`, so embedded markup such as
 * `<img src=x onerror=...>` stays inert literal text.
 */

import {
  normalizePath,
  TFile,
  type App,
  type MarkdownPostProcessorContext,
  type Plugin,
} from 'obsidian';
import { formatTimestamp } from '../model';
import { parseSubtitle } from '../parser';
import { reflow, type Paragraph, type ReflowOptions } from '../transform/reflow';

/** Where (and whether) a paragraph's start timestamp is rendered. */
export type TimestampMode = 'none' | 'inline' | 'aside';

/** Per-render presentation options (everything except the {@link App}). */
export interface TranscriptBlockOptions {
  /** Passed through to {@link reflow}. */
  reflow?: ReflowOptions;
  /**
   * How to render each paragraph's start timestamp.
   * @defaultValue 'inline'
   */
  timestamps?: TimestampMode;
  /**
   * Render speaker labels when known.
   * @defaultValue true
   */
  speaker?: boolean;
}

/** Full options for {@link renderTranscriptBlock}, including the {@link App}. */
export interface RenderTranscriptOptions extends TranscriptBlockOptions {
  /** The Obsidian app, used to read referenced vault files. */
  app: App;
}

const CONTAINER_CLASS = 'subtitles-md-transcript';
const PARAGRAPH_CLASS = 'subtitles-md-paragraph';
const TIMESTAMP_CLASS = 'subtitles-md-timestamp';
const TIMESTAMP_ASIDE_CLASS = 'subtitles-md-timestamp--aside';
const SPEAKER_CLASS = 'subtitles-md-speaker';
const TEXT_CLASS = 'subtitles-md-text';
const MESSAGE_CLASS = 'subtitles-md-message';

const EMPTY_MESSAGE = 'No transcript content to display.';

/** Matches a leading `file:` / `source:` reference line. */
const FILE_REFERENCE_RE = /^(?:file|source)\s*:\s*(.+)$/i;

/**
 * If `source` is a file reference (`file:` / `source:` on its first non-empty
 * line), return the normalized vault path; otherwise `null`.
 */
function parseFileReference(source: string): string | null {
  const firstLine = source
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '');
  if (firstLine === undefined) {
    return null;
  }

  const match = FILE_REFERENCE_RE.exec(firstLine);
  if (match === null) {
    return null;
  }

  const path = match[1]?.trim() ?? '';
  return path === '' ? null : normalizePath(path);
}

/** Append a friendly, non-throwing message into a fresh container. */
function renderMessage(el: HTMLElement, message: string): void {
  const container = el.createDiv({ cls: CONTAINER_CLASS });
  container.createDiv({ cls: MESSAGE_CLASS, text: message });
}

/** Render one reflowed paragraph as a `div.subtitles-md-paragraph`. */
function renderParagraph(
  container: HTMLElement,
  paragraph: Paragraph,
  timestamps: TimestampMode,
  speaker: boolean,
): void {
  const block = container.createDiv({ cls: PARAGRAPH_CLASS });

  if (timestamps !== 'none') {
    const cls =
      timestamps === 'aside'
        ? [TIMESTAMP_CLASS, TIMESTAMP_ASIDE_CLASS]
        : TIMESTAMP_CLASS;
    block.createSpan({ cls, text: `[${formatTimestamp(paragraph.startMs)}]` });
  }

  if (speaker && paragraph.speaker !== undefined) {
    block.createSpan({ cls: SPEAKER_CLASS, text: paragraph.speaker });
  }

  block.createSpan({ cls: TEXT_CLASS, text: paragraph.text });
}

/**
 * Resolve a `transcript` code block to content, parse + reflow it, and render a
 * readable DOM tree under `el`.
 *
 * Total by design: any failure (undetectable format, missing/unreadable file,
 * or empty result) renders a friendly message rather than throwing.
 *
 * @param source Raw code-block body (inline content or a file reference).
 * @param el Host element to render into.
 * @param opts The app plus presentation options.
 */
export async function renderTranscriptBlock(
  source: string,
  el: HTMLElement,
  opts: RenderTranscriptOptions,
): Promise<void> {
  el.empty();

  const timestamps = opts.timestamps ?? 'inline';
  const speaker = opts.speaker ?? true;

  let content: string;
  const reference = parseFileReference(source);
  if (reference !== null) {
    const file = opts.app.vault.getAbstractFileByPath(reference);
    if (!(file instanceof TFile)) {
      renderMessage(el, `Transcript file not found: ${reference}`);
      return;
    }
    try {
      content = await opts.app.vault.read(file);
    } catch {
      renderMessage(el, `Couldn't read transcript file: ${reference}`);
      return;
    }
  } else {
    content = source;
  }

  let paragraphs: Paragraph[];
  try {
    const transcript = parseSubtitle(content, {
      source: reference ?? undefined,
    });
    paragraphs = reflow(transcript, opts.reflow);
  } catch {
    paragraphs = [];
  }

  if (paragraphs.length === 0) {
    renderMessage(el, EMPTY_MESSAGE);
    return;
  }

  const container = el.createDiv({ cls: CONTAINER_CLASS });
  for (const paragraph of paragraphs) {
    renderParagraph(container, paragraph, timestamps, speaker);
  }
}

/**
 * Register the ` ```transcript ` code-block processor on `plugin`.
 *
 * `getOptions` is consulted on every render so live settings changes take
 * effect without re-registration. The plugin's own {@link App} is always used.
 *
 * @param plugin The owning plugin.
 * @param getOptions Supplies current presentation options per render.
 */
export function registerTranscriptCodeBlock(
  plugin: Plugin,
  getOptions: () => TranscriptBlockOptions,
): void {
  plugin.registerMarkdownCodeBlockProcessor(
    'transcript',
    (source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext) =>
      renderTranscriptBlock(source, el, { app: plugin.app, ...getOptions() }),
  );
}
