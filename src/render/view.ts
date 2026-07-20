/**
 * Read-only "visualize without converting" surface.
 *
 * {@link TranscriptView} opens a `.srt` / `.vtt` file directly as a clean,
 * readable transcript without ever rewriting the source file. It runs the pure
 * pipeline (`parseSubtitle` -> `reflow`) and renders the result into the view's
 * `contentEl` using Obsidian's element helpers.
 *
 * Security: cue `text` and `speaker` are **untrusted** input. They are only ever
 * written as DOM `textContent` (via the `text` option of `createDiv`/
 * `createSpan`) — never as `innerHTML`/`outerHTML` — so embedded markup stays
 * inert, literal text.
 */

import {
  TextFileView,
  type Plugin,
  type TFile,
  type WorkspaceLeaf,
} from 'obsidian';
import { formatTimestamp } from '../model';
import { parseSubtitle } from '../parser';
import { reflow, type Paragraph, type ReflowOptions } from '../transform/reflow';
import type { SpeakerStyle } from '../serialize/markdown';
import type { TimestampMode } from './codeblock';

/** Stable identifier Obsidian uses to associate this view with a file type. */
export const TRANSCRIPT_VIEW_TYPE = 'subtitles-md-transcript-view';

/** Tuning passed (lazily) into {@link TranscriptView} rendering. */
export interface TranscriptViewOptions {
  /** Passed through to {@link reflow}. */
  reflow?: ReflowOptions;
  /**
   * How to render each paragraph's start timestamp.
   * @defaultValue 'inline'
   */
  timestamps?: TimestampMode;
  /**
   * How to render speaker labels when known.
   * @defaultValue 'bold'
   */
  speakerStyle?: SpeakerStyle;
}

/**
 * Callback invoked when the user clicks the banner's convert button. Wired (in
 * `main.ts`) to the same conversion pipeline as the command palette command.
 */
export type ConvertFileHandler = (file: TFile) => void;

const EMPTY_MESSAGE = 'No readable cues found in this subtitle file.';
const ERROR_MESSAGE = 'This file could not be displayed as a transcript.';
const BANNER_MESSAGE =
  'This is a read-only preview. Convert it to a Markdown note to edit.';
const CONVERT_BUTTON_LABEL = 'Convert to note';

/**
 * A read-only transcript renderer for `.srt` / `.vtt` files.
 *
 * The raw file contents are stored verbatim and returned unchanged by
 * {@link getViewData}, so opening (and Obsidian's debounced save) never mutates
 * the source file.
 */
export class TranscriptView extends TextFileView {
  private readonly getOptions: () => TranscriptViewOptions;
  private readonly onConvert?: ConvertFileHandler;

  constructor(
    leaf: WorkspaceLeaf,
    getOptions: () => TranscriptViewOptions = () => ({}),
    onConvert?: ConvertFileHandler,
  ) {
    super(leaf);
    this.getOptions = getOptions;
    this.onConvert = onConvert;
  }

  getViewType(): string {
    return TRANSCRIPT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file?.basename ?? 'Transcript';
  }

  getIcon(): string {
    return 'captions';
  }

  /** Return the raw, unmodified file contents (read-only round-trip). */
  getViewData(): string {
    return this.data;
  }

  /** Store the raw data and (re)render it as a transcript. */
  setViewData(data: string, _clear: boolean): void {
    this.data = data;
    this.render();
  }

  /** Empty the rendered content and drop the stored data. */
  clear(): void {
    this.data = '';
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    this.renderConvertBanner(contentEl);

    const container = contentEl.createDiv({ cls: 'subtitles-md-transcript' });

    let paragraphs: Paragraph[];
    try {
      const transcript = parseSubtitle(this.data, { source: this.file?.name });
      paragraphs = reflow(transcript, this.getOptions().reflow);
    } catch {
      container.createDiv({ cls: 'subtitles-md-message', text: ERROR_MESSAGE });
      return;
    }

    if (paragraphs.length === 0) {
      container.createDiv({ cls: 'subtitles-md-message', text: EMPTY_MESSAGE });
      return;
    }

    const timestamps = this.getOptions().timestamps ?? 'inline';
    const speakerStyle = this.getOptions().speakerStyle ?? 'bold';
    for (const paragraph of paragraphs) {
      this.renderParagraph(container, paragraph, timestamps, speakerStyle);
    }
  }

  /**
   * Render the "convert to note" banner above the transcript, mirroring the
   * convertible-file pattern of plugins like docxer. Skipped entirely when no
   * convert handler was wired in or no file is open, so the view stays a pure
   * read-only renderer in those contexts.
   */
  private renderConvertBanner(contentEl: HTMLElement): void {
    if (this.onConvert === undefined || this.file === null) {
      return;
    }

    const banner = contentEl.createDiv({ cls: 'subtitles-md-convert-banner' });
    banner.createSpan({
      cls: 'subtitles-md-convert-message',
      text: BANNER_MESSAGE,
    });
    const button = banner.createEl('button', {
      cls: ['subtitles-md-convert-button', 'mod-cta'],
      text: CONVERT_BUTTON_LABEL,
    });
    button.onclick = (): void => {
      // Read the file at click time; it may have changed since render.
      if (this.file !== null) {
        this.onConvert?.(this.file);
      }
    };
  }

  private renderParagraph(
    container: HTMLElement,
    paragraph: Paragraph,
    timestamps: TimestampMode,
    speakerStyle: SpeakerStyle,
  ): void {
    if (paragraph.speaker !== undefined && speakerStyle === 'heading') {
      // Untrusted: rendered as textContent only.
      container.createEl('h4', {
        cls: ['subtitles-md-speaker', 'subtitles-md-speaker--heading'],
        text: paragraph.speaker,
      });
    }

    const el = container.createDiv({ cls: 'subtitles-md-paragraph' });

    if (timestamps !== 'none') {
      const cls =
        timestamps === 'aside'
          ? ['subtitles-md-timestamp', 'subtitles-md-timestamp--aside']
          : 'subtitles-md-timestamp';
      el.createSpan({ cls, text: formatTimestamp(paragraph.startMs) });
    }

    if (paragraph.speaker !== undefined && speakerStyle !== 'heading') {
      // Untrusted: rendered as textContent only.
      el.createSpan({ cls: 'subtitles-md-speaker', text: paragraph.speaker });
    }

    // Untrusted: rendered as textContent only.
    el.createSpan({ cls: 'subtitles-md-text', text: paragraph.text });
  }
}

/**
 * Register {@link TranscriptView} and bind it to the `.srt` / `.vtt`
 * extensions. The actual call is wired from `main.ts` in a later task.
 */
export function registerTranscriptView(
  plugin: Plugin,
  getOptions?: () => TranscriptViewOptions,
  onConvert?: ConvertFileHandler,
): void {
  plugin.registerView(
    TRANSCRIPT_VIEW_TYPE,
    (leaf) => new TranscriptView(leaf, getOptions, onConvert),
  );
  plugin.registerExtensions(['srt', 'vtt'], TRANSCRIPT_VIEW_TYPE);
}
