import { createTranscript, type Cue, type Transcript } from '../model';

/**
 * Pure WebVTT parser: turns `.vtt` text into a normalized {@link Transcript}.
 *
 * The parser is deliberately lenient and total — it never throws. Every
 * well-formed cue is extracted; malformed blocks (bad or missing timing,
 * comments, headers) are skipped rather than aborting the parse.
 *
 * It has no Obsidian, I/O, or runtime dependency beyond the domain model.
 */
export function parseVtt(input: string): Transcript {
  const normalized = stripBom(input).replace(/\r\n?/g, '\n');
  const blocks = splitIntoBlocks(normalized);

  const cues: Cue[] = [];
  for (const block of blocks) {
    const cue = parseBlock(block, cues.length + 1);
    if (cue) {
      cues.push(cue);
    }
  }

  return createTranscript(cues, { format: 'vtt' });
}

/** Remove a single leading UTF-8 BOM if present. */
function stripBom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
}

/** Split normalized text into blocks separated by one or more blank lines. */
function splitIntoBlocks(text: string): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) {
    blocks.push(current);
  }

  return blocks;
}

const TIMESTAMP = /^(?:(\d+):)?(\d{1,2}):(\d{2})\.(\d{3})$/;

/**
 * Parse a single block into a cue, or `null` when the block is a header,
 * a `NOTE` comment, or otherwise lacks a parseable timing line.
 */
function parseBlock(lines: string[], index: number): Cue | null {
  const first = lines[0]?.trim() ?? '';
  if (first === 'NOTE' || first.startsWith('NOTE ')) {
    return null;
  }

  const timingIndex = lines.findIndex((line) => line.includes('-->'));
  if (timingIndex === -1) {
    return null;
  }

  const timing = parseTiming(lines[timingIndex] ?? '');
  if (!timing) {
    return null;
  }

  const textLines = lines.slice(timingIndex + 1);
  const { text, speaker } = parseText(textLines);
  if (text === '') {
    return null;
  }

  const cue: Cue = {
    index,
    startMs: timing.startMs,
    endMs: timing.endMs,
    text,
  };
  if (speaker) {
    cue.speaker = speaker;
  }

  return cue;
}

/**
 * Parse a timing line `START --> END [settings]` into millisecond offsets,
 * tolerating trailing cue settings. Returns `null` on any malformed part.
 */
function parseTiming(line: string): { startMs: number; endMs: number } | null {
  const arrowIndex = line.indexOf('-->');
  if (arrowIndex === -1) {
    return null;
  }

  const startMs = parseTimestamp(line.slice(0, arrowIndex).trim());
  const rest = line.slice(arrowIndex + 3).trim();
  const endToken = rest.split(/\s+/)[0] ?? '';
  const endMs = parseTimestamp(endToken);

  if (startMs === null || endMs === null || endMs < startMs) {
    return null;
  }

  return { startMs, endMs };
}

/** Parse `HH:MM:SS.mmm` or `MM:SS.mmm` into milliseconds, or `null`. */
function parseTimestamp(value: string): number | null {
  const match = TIMESTAMP.exec(value);
  if (!match) {
    return null;
  }

  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = Number(match[4]);

  if (minutes >= 60 || seconds >= 60) {
    return null;
  }

  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
}

const VOICE_TAG = /<v(?:\.[^\s>.]+)*[ \t]+([^>]*)>/i;
const ANY_TAG = /<[^>]*>/g;

/** Extract an optional speaker from voice tags and strip all inline markup. */
function parseText(lines: string[]): { text: string; speaker?: string } {
  const raw = lines.join('\n');

  const voiceMatch = VOICE_TAG.exec(raw);
  const speakerRaw = voiceMatch?.[1]?.trim() ?? '';
  const speaker = speakerRaw === '' ? undefined : speakerRaw;

  const text = raw
    .replace(ANY_TAG, '')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

  return speaker ? { text, speaker } : { text };
}
