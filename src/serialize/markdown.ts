/**
 * Pure Markdown serializer.
 *
 * Turns reflowed {@link Paragraph}s plus {@link TranscriptMeta} into a clean,
 * deterministic Markdown note. This is the user-facing output contract consumed
 * by the convert command and the reading-render layer.
 *
 * This module is intentionally pure: it has no Obsidian, I/O, or runtime
 * dependency, never mutates its inputs, and always ends its output with a
 * single trailing newline (or the empty string when there is nothing to emit).
 */

import { formatTimestamp, type TranscriptMeta } from '../model';
import type { Paragraph } from '../transform/reflow';

/** How a paragraph's start timestamp is rendered. */
export type TimestampStyle = 'none' | 'inline' | 'aside';

/** How a paragraph's speaker label is rendered. */
export type SpeakerStyle = 'bold' | 'heading';

/** Options controlling {@link serializeToMarkdown} output. */
export interface SerializeOptions {
  /**
   * Where (and whether) to render each paragraph's start timestamp.
   * - `'inline'` prefixes the paragraph with `[HH:MM:SS] `.
   * - `'aside'` appends an unobtrusive ` ^[HH:MM:SS]` marker.
   * - `'none'` omits timestamps entirely.
   * @defaultValue 'inline'
   */
  timestamps?: TimestampStyle;
  /**
   * Emit a leading YAML frontmatter block describing the transcript.
   * @defaultValue true
   */
  includeFrontmatter?: boolean;
  /**
   * How to render a paragraph's speaker label.
   * - `'bold'` uses an inline `**Speaker:** ` prefix.
   * - `'heading'` places a `#### Speaker` line above the paragraph.
   * @defaultValue 'bold'
   */
  speakerStyle?: SpeakerStyle;
}

const DEFAULT_TIMESTAMPS: TimestampStyle = 'inline';
const DEFAULT_SPEAKER_STYLE: SpeakerStyle = 'bold';

/** Render the YAML frontmatter block (without a trailing newline). */
function renderFrontmatter(meta: TranscriptMeta): string {
  const lines = ['---'];
  if (meta.source !== undefined) {
    lines.push(`source: ${meta.source}`);
  }
  lines.push(`format: ${meta.format}`);
  lines.push(`duration: ${formatTimestamp(meta.durationMs)}`);
  lines.push(`cues: ${meta.cueCount}`);
  lines.push('---');
  return lines.join('\n');
}

/** Render a single paragraph block (may span two lines for heading speakers). */
function renderParagraph(
  paragraph: Paragraph,
  timestamps: TimestampStyle,
  speakerStyle: SpeakerStyle,
): string {
  let line = paragraph.text;
  let heading: string | undefined;

  if (paragraph.speaker !== undefined) {
    if (speakerStyle === 'bold') {
      line = `**${paragraph.speaker}:** ${line}`;
    } else {
      heading = `#### ${paragraph.speaker}`;
    }
  }

  if (timestamps === 'inline') {
    line = `[${formatTimestamp(paragraph.startMs)}] ${line}`;
  } else if (timestamps === 'aside') {
    line = `${line} ^[${formatTimestamp(paragraph.startMs)}]`;
  }

  return heading !== undefined ? `${heading}\n${line}` : line;
}

/**
 * Serialize reflowed paragraphs and transcript metadata into a Markdown note.
 *
 * Pure and total: empty `paragraphs` yields frontmatter only (when enabled) or
 * the empty string. Inputs are never mutated. The result, when non-empty, ends
 * with exactly one trailing newline.
 */
export function serializeToMarkdown(
  paragraphs: Paragraph[],
  meta: TranscriptMeta,
  options: SerializeOptions = {},
): string {
  const timestamps = options.timestamps ?? DEFAULT_TIMESTAMPS;
  const includeFrontmatter = options.includeFrontmatter ?? true;
  const speakerStyle = options.speakerStyle ?? DEFAULT_SPEAKER_STYLE;

  const blocks: string[] = [];

  if (includeFrontmatter) {
    blocks.push(renderFrontmatter(meta));
  }

  for (const paragraph of paragraphs) {
    blocks.push(renderParagraph(paragraph, timestamps, speakerStyle));
  }

  if (blocks.length === 0) {
    return '';
  }

  return `${blocks.join('\n\n')}\n`;
}
