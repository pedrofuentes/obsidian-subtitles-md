import type { Cue, Transcript } from './types';

/**
 * Build a {@link Transcript} from cues and minimal metadata, deriving the
 * `durationMs` and `cueCount` fields.
 *
 * - `durationMs` is the maximum `endMs` across all cues, or `0` when there are
 *   no cues. Cues need not be sorted.
 * - `cueCount` is the number of cues.
 *
 * The input `cues` array is not mutated; the returned transcript holds a
 * shallow copy of the array.
 */
export function createTranscript(
  cues: Cue[],
  meta: { format: 'srt' | 'vtt'; source?: string },
): Transcript {
  const durationMs = cues.reduce((max, cue) => Math.max(max, cue.endMs), 0);

  return {
    cues: [...cues],
    meta: {
      format: meta.format,
      durationMs,
      cueCount: cues.length,
      source: meta.source,
    },
  };
}

/** Duration of a single cue in milliseconds (`endMs - startMs`). */
export function cueDurationMs(cue: Cue): number {
  return cue.endMs - cue.startMs;
}

/**
 * Format a millisecond offset as an `HH:MM:SS` timestamp.
 *
 * Behavior:
 * - The value is floored to whole seconds (sub-second milliseconds are dropped).
 * - Negative inputs are clamped to `0` and rendered as `00:00:00`.
 * - Hours are not wrapped at 24 and are zero-padded to a minimum of two
 *   digits, so durations beyond a day render as `25:00:00`, `100:00:00`, etc.
 */
export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

/**
 * Validate a cue against the model invariants:
 * - `index` is an integer >= 1 (1-based source order),
 * - `startMs` is a finite number >= 0,
 * - `endMs` is a finite number >= `startMs` (zero-length cues are allowed),
 * - `text` contains at least one non-whitespace character.
 *
 * The optional `speaker` field does not affect validity.
 */
export function isValidCue(cue: Cue): boolean {
  return (
    Number.isInteger(cue.index) &&
    cue.index >= 1 &&
    Number.isFinite(cue.startMs) &&
    cue.startMs >= 0 &&
    Number.isFinite(cue.endMs) &&
    cue.endMs >= cue.startMs &&
    cue.text.trim().length > 0
  );
}
