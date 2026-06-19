import { describe, it, expect } from 'vitest';
import {
  createTranscript,
  cueDurationMs,
  formatTimestamp,
  isValidCue,
  type Cue,
  type Transcript,
} from './index';

function makeCue(overrides: Partial<Cue> = {}): Cue {
  return {
    index: 1,
    startMs: 0,
    endMs: 1000,
    text: 'hello',
    ...overrides,
  };
}

describe('createTranscript', () => {
  it('derives cueCount and durationMs from a single cue', () => {
    const cues: Cue[] = [makeCue({ index: 1, startMs: 500, endMs: 2500 })];
    const transcript = createTranscript(cues, { format: 'srt' });

    expect(transcript.meta.cueCount).toBe(1);
    expect(transcript.meta.durationMs).toBe(2500);
    expect(transcript.meta.format).toBe('srt');
    expect(transcript.meta.source).toBeUndefined();
    expect(transcript.cues).toHaveLength(1);
    expect(transcript.cues[0]?.text).toBe('hello');
  });

  it('returns zero durationMs and cueCount for empty cues', () => {
    const transcript = createTranscript([], { format: 'vtt' });

    expect(transcript.meta.cueCount).toBe(0);
    expect(transcript.meta.durationMs).toBe(0);
    expect(transcript.meta.format).toBe('vtt');
    expect(transcript.cues).toEqual([]);
  });

  it('derives durationMs as the maximum endMs even when cues are out of order', () => {
    const cues: Cue[] = [
      makeCue({ index: 1, startMs: 0, endMs: 9000 }),
      makeCue({ index: 2, startMs: 9000, endMs: 3000 }),
      makeCue({ index: 3, startMs: 3000, endMs: 5000 }),
    ];

    const transcript = createTranscript(cues, { format: 'srt' });

    expect(transcript.meta.durationMs).toBe(9000);
    expect(transcript.meta.cueCount).toBe(3);
  });

  it('records the optional source when provided', () => {
    const transcript = createTranscript([makeCue()], {
      format: 'vtt',
      source: 'episode-01.vtt',
    });

    expect(transcript.meta.source).toBe('episode-01.vtt');
  });

  it('does not mutate the input cues array', () => {
    const cues: Cue[] = [makeCue({ index: 1, endMs: 1000 })];
    const originalLength = cues.length;

    const transcript = createTranscript(cues, { format: 'srt' });
    transcript.cues.push(makeCue({ index: 2, endMs: 2000 }));

    expect(cues).toHaveLength(originalLength);
  });

  it('does not share the cue array reference with the input', () => {
    const cues: Cue[] = [makeCue()];
    const transcript: Transcript = createTranscript(cues, { format: 'srt' });

    expect(transcript.cues).not.toBe(cues);
    expect(transcript.cues).toEqual(cues);
  });
});

describe('cueDurationMs', () => {
  it('returns endMs minus startMs', () => {
    expect(cueDurationMs(makeCue({ startMs: 1000, endMs: 4000 }))).toBe(3000);
  });

  it('returns 0 for a zero-length cue', () => {
    expect(cueDurationMs(makeCue({ startMs: 2000, endMs: 2000 }))).toBe(0);
  });
});

describe('formatTimestamp', () => {
  it('formats zero as 00:00:00', () => {
    expect(formatTimestamp(0)).toBe('00:00:00');
  });

  it('floors sub-second milliseconds', () => {
    expect(formatTimestamp(999)).toBe('00:00:00');
    expect(formatTimestamp(1000)).toBe('00:00:01');
    expect(formatTimestamp(1999)).toBe('00:00:01');
  });

  it('formats minutes and seconds', () => {
    expect(formatTimestamp(61000)).toBe('00:01:01');
    expect(formatTimestamp(599000)).toBe('00:09:59');
  });

  it('formats whole hours', () => {
    expect(formatTimestamp(3600000)).toBe('01:00:00');
    expect(formatTimestamp(3661000)).toBe('01:01:01');
  });

  it('handles hour rollover beyond a single day without truncating hours', () => {
    expect(formatTimestamp(90000000)).toBe('25:00:00');
    expect(formatTimestamp(360000000)).toBe('100:00:00');
  });

  it('clamps negative milliseconds to 00:00:00', () => {
    expect(formatTimestamp(-1)).toBe('00:00:00');
    expect(formatTimestamp(-5000)).toBe('00:00:00');
  });
});

describe('isValidCue', () => {
  it('accepts a well-formed cue', () => {
    expect(isValidCue(makeCue())).toBe(true);
  });

  it('accepts a zero-length cue where endMs equals startMs', () => {
    expect(isValidCue(makeCue({ startMs: 1000, endMs: 1000 }))).toBe(true);
  });

  it('accepts a cue with an optional speaker', () => {
    expect(isValidCue(makeCue({ speaker: 'Alice' }))).toBe(true);
  });

  it('rejects a non-positive index', () => {
    expect(isValidCue(makeCue({ index: 0 }))).toBe(false);
    expect(isValidCue(makeCue({ index: -1 }))).toBe(false);
  });

  it('rejects a non-integer index', () => {
    expect(isValidCue(makeCue({ index: 1.5 }))).toBe(false);
  });

  it('rejects a negative startMs', () => {
    expect(isValidCue(makeCue({ startMs: -1 }))).toBe(false);
  });

  it('rejects an endMs earlier than startMs', () => {
    expect(isValidCue(makeCue({ startMs: 5000, endMs: 4000 }))).toBe(false);
  });

  it('rejects empty or whitespace-only text', () => {
    expect(isValidCue(makeCue({ text: '' }))).toBe(false);
    expect(isValidCue(makeCue({ text: '   ' }))).toBe(false);
  });

  it('rejects non-finite timestamps', () => {
    expect(isValidCue(makeCue({ startMs: Number.NaN }))).toBe(false);
    expect(isValidCue(makeCue({ endMs: Number.POSITIVE_INFINITY }))).toBe(false);
  });
});
