import { describe, it, expect } from 'vitest';
import {
  detectFormat,
  parseSubtitle,
  parseSrt,
  parseVtt,
  UnsupportedFormatError,
} from './index';

const SRT_SAMPLE = [
  '1',
  '00:00:01,000 --> 00:00:02,500',
  'Hello world',
  '',
  '2',
  '00:00:03,000 --> 00:00:04,000',
  'Second cue',
  '',
].join('\n');

const VTT_SAMPLE = [
  'WEBVTT',
  '',
  '00:00:01.000 --> 00:00:02.500',
  'Hello world',
  '',
  '00:00:03.000 --> 00:00:04.000',
  'Second cue',
  '',
].join('\n');

describe('barrel re-exports', () => {
  it('re-exports parseSrt and parseVtt', () => {
    expect(typeof parseSrt).toBe('function');
    expect(typeof parseVtt).toBe('function');
    expect(parseSrt(SRT_SAMPLE).meta.format).toBe('srt');
    expect(parseVtt(VTT_SAMPLE).meta.format).toBe('vtt');
  });
});

describe('UnsupportedFormatError', () => {
  it('is an Error subclass with the correct name', () => {
    const err = new UnsupportedFormatError('nope');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(UnsupportedFormatError);
    expect(err.name).toBe('UnsupportedFormatError');
    expect(err.message).toBe('nope');
  });
});

describe('detectFormat', () => {
  it('detects vtt by the WEBVTT signature', () => {
    expect(detectFormat(VTT_SAMPLE)).toBe('vtt');
  });

  it('detects vtt even with a leading BOM and blank lines', () => {
    expect(detectFormat('\uFEFF\n\nWEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n')).toBe(
      'vtt',
    );
  });

  it('detects srt by an index line followed by a comma-millisecond timing line', () => {
    expect(detectFormat(SRT_SAMPLE)).toBe('srt');
  });

  it('detects srt with a leading BOM', () => {
    expect(detectFormat('\uFEFF' + SRT_SAMPLE)).toBe('srt');
  });

  it('falls back to the filename extension for ambiguous content', () => {
    const ambiguous = 'Just some text\nwith no timing\n';
    expect(detectFormat(ambiguous, 'movie.vtt')).toBe('vtt');
    expect(detectFormat(ambiguous, 'movie.srt')).toBe('srt');
    expect(detectFormat(ambiguous, 'MOVIE.SRT')).toBe('srt');
    expect(detectFormat(ambiguous, 'MOVIE.VTT')).toBe('vtt');
  });

  it('prefers content signature over a conflicting extension', () => {
    expect(detectFormat(VTT_SAMPLE, 'mislabeled.srt')).toBe('vtt');
    expect(detectFormat(SRT_SAMPLE, 'mislabeled.vtt')).toBe('srt');
  });

  it('returns null for empty input', () => {
    expect(detectFormat('')).toBeNull();
    expect(detectFormat('\uFEFF\n   \n')).toBeNull();
  });

  it('returns null for garbage without a recognizable signature or extension', () => {
    expect(detectFormat('this is not a subtitle file at all')).toBeNull();
    expect(detectFormat('random text', 'notes.txt')).toBeNull();
  });
});

describe('parseSubtitle', () => {
  it('parses srt content detected from the input', () => {
    const transcript = parseSubtitle(SRT_SAMPLE);
    expect(transcript.meta.format).toBe('srt');
    expect(transcript.meta.cueCount).toBe(2);
    expect(transcript.cues[0]?.text).toBe('Hello world');
  });

  it('parses vtt content detected from the input', () => {
    const transcript = parseSubtitle(VTT_SAMPLE);
    expect(transcript.meta.format).toBe('vtt');
    expect(transcript.meta.cueCount).toBe(2);
    expect(transcript.cues[1]?.text).toBe('Second cue');
  });

  it('sets meta.source when provided without disturbing other meta', () => {
    const transcript = parseSubtitle(SRT_SAMPLE, { source: 'episode.srt' });
    expect(transcript.meta.source).toBe('episode.srt');
    expect(transcript.meta.format).toBe('srt');
    expect(transcript.meta.cueCount).toBe(2);
    expect(transcript.meta.durationMs).toBe(4000);
  });

  it('uses the source string for extension-based detection', () => {
    const ambiguous = 'Just some text\nwith no timing\n';
    const transcript = parseSubtitle(ambiguous, { source: 'movie.vtt' });
    expect(transcript.meta.format).toBe('vtt');
    expect(transcript.meta.source).toBe('movie.vtt');
  });

  it('respects an explicit opts.format over the content signature', () => {
    const transcript = parseSubtitle(VTT_SAMPLE, { format: 'srt' });
    expect(transcript.meta.format).toBe('srt');
  });

  it('does not set meta.source when no source is provided', () => {
    const transcript = parseSubtitle(SRT_SAMPLE);
    expect(transcript.meta.source).toBeUndefined();
  });

  it('throws UnsupportedFormatError for empty input', () => {
    expect(() => parseSubtitle('')).toThrow(UnsupportedFormatError);
  });

  it('throws UnsupportedFormatError for undetectable garbage', () => {
    let thrown: unknown;
    try {
      parseSubtitle('not a subtitle file');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(UnsupportedFormatError);
    expect((thrown as Error).message).toMatch(/format/i);
  });
});
