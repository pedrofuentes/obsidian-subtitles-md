/**
 * Normalized, pure domain model shared across the plugin.
 *
 * These interfaces describe transcripts independently of their on-disk format
 * (.srt / .vtt). They intentionally avoid any Obsidian, I/O, or runtime
 * dependency so that parsers, transforms, serializers, and renderers can all
 * agree on a single shape.
 */

/** A single subtitle cue in source order. */
export interface Cue {
  /** 1-based position of the cue in the source file. */
  index: number;
  /** Start offset from the beginning of the media, in milliseconds (>= 0). */
  startMs: number;
  /** End offset from the beginning of the media, in milliseconds (>= startMs). */
  endMs: number;
  /** Cleaned cue text. */
  text: string;
  /** Optional speaker label (e.g. from a VTT `<v Speaker>` tag). */
  speaker?: string;
}

/** Metadata describing a {@link Transcript}, mostly derived from its cues. */
export interface TranscriptMeta {
  /** Source subtitle format. */
  format: 'srt' | 'vtt';
  /** Total duration in milliseconds, derived from the cues. */
  durationMs: number;
  /** Number of cues, derived from the cues array. */
  cueCount: number;
  /** Optional source file name or path. */
  source?: string;
}

/** A complete transcript: its cues plus derived metadata. */
export interface Transcript {
  cues: Cue[];
  meta: TranscriptMeta;
}
