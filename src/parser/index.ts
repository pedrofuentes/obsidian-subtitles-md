import type { Transcript } from '../model';
import { parseSrt } from './srt';
import { parseVtt } from './vtt';

export { parseSrt } from './srt';
export { parseVtt } from './vtt';

/** A subtitle format this plugin knows how to parse. */
export type SubtitleFormat = 'srt' | 'vtt';

/**
 * Thrown by {@link parseSubtitle} when the input format cannot be determined
 * (e.g. empty or unrecognizable content with no usable filename extension).
 *
 * The individual parsers stay lenient and total; this typed error is the one
 * place where "cannot parse" is signalled.
 */
export class UnsupportedFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFormatError';
  }
}

/** Remove a single leading UTF-8 BOM (`U+FEFF`) if present. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Matches an SRT timing line `HH:MM:SS,mmm --> HH:MM:SS,mmm`. */
const SRT_TIMING_RE =
  /^\d+:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d+:\d{2}:\d{2}[,.]\d{3}/;

/** Matches a bare numeric SRT index line. */
const SRT_INDEX_RE = /^\d+$/;

/**
 * Detect whether `input` looks like an SRT document: a numeric index line
 * immediately followed by an SRT timing line, ignoring blank lines.
 */
function looksLikeSrt(lines: string[]): boolean {
  for (let i = 0; i < lines.length; i += 1) {
    const line = (lines[i] ?? '').trim();
    if (line === '') {
      continue;
    }
    if (!SRT_INDEX_RE.test(line)) {
      return false;
    }
    // Find the next non-empty line; it must be a timing line.
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = (lines[j] ?? '').trim();
      if (next === '') {
        continue;
      }
      return SRT_TIMING_RE.test(next);
    }
    return false;
  }
  return false;
}

/** Derive a format from a filename extension, case-insensitively. */
function formatFromFilename(filename: string): SubtitleFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.vtt')) {
    return 'vtt';
  }
  if (lower.endsWith('.srt')) {
    return 'srt';
  }
  return null;
}

/**
 * Determine the subtitle format of `input`.
 *
 * Detection order:
 * 1. Strip a leading BOM.
 * 2. If the first non-empty line starts with `WEBVTT` → `'vtt'`.
 * 3. Else if the content carries an SRT signature (index line followed by an
 *    `HH:MM:SS,mmm --> HH:MM:SS,mmm` timing line) → `'srt'`.
 * 4. Else, if `filename` is given, fall back to its extension.
 * 5. Otherwise `null`.
 *
 * Content signature always takes precedence over the filename extension.
 *
 * @param input Raw subtitle file contents.
 * @param filename Optional source filename used only as an extension fallback.
 * @returns The detected format, or `null` when undetectable.
 */
export function detectFormat(
  input: string,
  filename?: string,
): SubtitleFormat | null {
  const normalized = stripBom(input).replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');

  const firstNonEmpty = lines.find((line) => line.trim() !== '');
  if (firstNonEmpty !== undefined && firstNonEmpty.trimStart().startsWith('WEBVTT')) {
    return 'vtt';
  }

  if (looksLikeSrt(lines)) {
    return 'srt';
  }

  if (filename !== undefined) {
    return formatFromFilename(filename);
  }

  return null;
}

/** Options for {@link parseSubtitle}. */
export interface ParseSubtitleOptions {
  /** Force a specific format, bypassing detection. */
  format?: SubtitleFormat;
  /** Source file name or path; used for detection fallback and recorded in meta. */
  source?: string;
}

/**
 * Parse a subtitle document into a {@link Transcript}, choosing the parser by
 * the explicit `opts.format` or by {@link detectFormat}.
 *
 * Unlike the individual parsers (which are lenient and never throw), this entry
 * point throws {@link UnsupportedFormatError} when the format cannot be
 * determined. When `opts.source` is provided it is recorded on
 * `transcript.meta.source` without disturbing the parser's other metadata.
 *
 * @param input Raw subtitle file contents.
 * @param opts Optional format override and source.
 * @returns The parsed transcript.
 * @throws {UnsupportedFormatError} When the format cannot be detected.
 */
export function parseSubtitle(
  input: string,
  opts?: ParseSubtitleOptions,
): Transcript {
  const format = opts?.format ?? detectFormat(input, opts?.source);

  if (format === null) {
    throw new UnsupportedFormatError(
      'Unable to detect subtitle format: content has no recognizable WEBVTT or SRT signature' +
        (opts?.source === undefined ? '' : ` and "${opts.source}" has no known extension`) +
        '.',
    );
  }

  const transcript = format === 'vtt' ? parseVtt(input) : parseSrt(input);

  if (opts?.source !== undefined) {
    return {
      ...transcript,
      meta: { ...transcript.meta, source: opts.source },
    };
  }

  return transcript;
}
