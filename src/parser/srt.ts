import { createTranscript, isValidCue, type Cue, type Transcript } from '../model';

/**
 * Parse a SubRip (`.srt`) document into a normalized {@link Transcript}.
 *
 * The parser is **lenient and total**: it never throws. It extracts every
 * well-formed cue and silently skips blocks that are malformed (unparseable
 * timing, missing text, etc.). It handles a leading UTF-8 BOM and both CRLF
 * (`\r\n`) and LF (`\n`) line endings. SRT carries no speaker information, so
 * the resulting cues never set `speaker`.
 *
 * @param input Raw `.srt` file contents.
 * @returns A transcript with `meta.format === 'srt'` and derived metadata.
 */
export function parseSrt(input: string): Transcript {
  const cues: Cue[] = [];

  const normalized = stripBom(input).replace(/\r\n?/g, '\n');
  const blocks = normalized.split(/\n[ \t]*\n/);

  let sequential = 0;

  for (const block of blocks) {
    const lines = block.split('\n');

    // Drop leading/trailing blank lines within the block.
    while (lines.length > 0 && (lines[0] ?? '').trim() === '') {
      lines.shift();
    }
    while (lines.length > 0 && (lines[lines.length - 1] ?? '').trim() === '') {
      lines.pop();
    }

    if (lines.length === 0) {
      continue;
    }

    // An optional numeric index line may precede the timing line.
    let cursor = 0;
    let parsedIndex: number | undefined;

    const firstLine = lines[0] ?? '';
    if (!parseTiming(firstLine)) {
      parsedIndex = parseIndex(firstLine);
      cursor = 1;
    }

    const timingLine = lines[cursor];
    if (timingLine === undefined) {
      continue;
    }

    const timing = parseTiming(timingLine);
    if (!timing) {
      continue;
    }
    cursor += 1;

    const text = lines.slice(cursor).join('\n').trim();

    sequential += 1;
    const index = parsedIndex ?? sequential;

    const cue: Cue = {
      index,
      startMs: timing.startMs,
      endMs: timing.endMs,
      text,
      speaker: undefined,
    };

    if (isValidCue(cue)) {
      cues.push(cue);
    } else {
      // Roll back the sequential fallback for a rejected cue so indices stay
      // contiguous across the cues that are actually emitted.
      sequential -= 1;
    }
  }

  return createTranscript(cues, { format: 'srt' });
}

/** Remove a single leading UTF-8 BOM (`U+FEFF`) if present. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Parse an index line into a positive integer, or `undefined` if invalid. */
function parseIndex(line: string): number | undefined {
  const trimmed = line.trim();
  return /^\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : undefined;
}

const TIMING_RE =
  /^(\d+):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d+):(\d{2}):(\d{2})[,.](\d{3})$/;

/** Parse an SRT timing line into start/end millisecond offsets. */
function parseTiming(line: string): { startMs: number; endMs: number } | undefined {
  const match = TIMING_RE.exec(line.trim());
  if (!match) {
    return undefined;
  }

  const startMs = toMs(match[1], match[2], match[3], match[4]);
  const endMs = toMs(match[5], match[6], match[7], match[8]);

  return { startMs, endMs };
}

/** Convert hour/minute/second/millisecond components to total milliseconds. */
function toMs(
  h: string | undefined,
  m: string | undefined,
  s: string | undefined,
  ms: string | undefined,
): number {
  return (
    Number.parseInt(h ?? '0', 10) * 3600000 +
    Number.parseInt(m ?? '0', 10) * 60000 +
    Number.parseInt(s ?? '0', 10) * 1000 +
    Number.parseInt(ms ?? '0', 10)
  );
}
