import { describe, it, expect } from 'vitest';
import { parseSrt } from './srt';

describe('parseSrt', () => {
  it('parses a simple multi-cue transcript', () => {
    const input = [
      '1',
      '00:00:01,000 --> 00:00:02,500',
      'Hello world',
      '',
      '2',
      '00:00:03,000 --> 00:00:04,000',
      'Second cue',
      '',
    ].join('\n');

    const transcript = parseSrt(input);

    expect(transcript.meta.format).toBe('srt');
    expect(transcript.meta.cueCount).toBe(2);
    expect(transcript.meta.durationMs).toBe(4000);
    expect(transcript.cues).toEqual([
      { index: 1, startMs: 1000, endMs: 2500, text: 'Hello world', speaker: undefined },
      { index: 2, startMs: 3000, endMs: 4000, text: 'Second cue', speaker: undefined },
    ]);
  });

  it('converts HH:MM:SS,mmm timestamps including hours and minutes', () => {
    const input = ['1', '01:02:03,400 --> 01:02:05,600', 'Timed line', ''].join('\n');

    const transcript = parseSrt(input);

    expect(transcript.cues).toHaveLength(1);
    expect(transcript.cues[0]?.startMs).toBe(3723400);
    expect(transcript.cues[0]?.endMs).toBe(3725600);
  });

  it('joins multi-line cue text with newlines', () => {
    const input = [
      '1',
      '00:00:01,000 --> 00:00:05,000',
      'Line one',
      'Line two',
      'Line three',
      '',
    ].join('\n');

    const transcript = parseSrt(input);

    expect(transcript.cues).toHaveLength(1);
    expect(transcript.cues[0]?.text).toBe('Line one\nLine two\nLine three');
  });

  it('handles CRLF line endings', () => {
    const input =
      '1\r\n00:00:01,000 --> 00:00:02,000\r\nFirst\r\nSecond\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nThird\r\n';

    const transcript = parseSrt(input);

    expect(transcript.cues).toHaveLength(2);
    expect(transcript.cues[0]?.text).toBe('First\nSecond');
    expect(transcript.cues[0]?.startMs).toBe(1000);
    expect(transcript.cues[1]?.text).toBe('Third');
  });

  it('strips a leading UTF-8 BOM', () => {
    const input = '\uFEFF1\n00:00:00,000 --> 00:00:01,000\nWith BOM\n';

    const transcript = parseSrt(input);

    expect(transcript.cues).toHaveLength(1);
    expect(transcript.cues[0]?.index).toBe(1);
    expect(transcript.cues[0]?.text).toBe('With BOM');
    expect(transcript.cues[0]?.startMs).toBe(0);
  });

  it('never assigns a speaker (SRT has no speakers)', () => {
    const input = ['1', '00:00:01,000 --> 00:00:02,000', 'No speaker', ''].join('\n');

    const transcript = parseSrt(input);

    expect(transcript.cues[0]?.speaker).toBeUndefined();
  });

  it('skips a malformed block while keeping surrounding valid cues', () => {
    const input = [
      '1',
      '00:00:01,000 --> 00:00:02,000',
      'Valid one',
      '',
      '2',
      'not a timing line',
      'Malformed cue text',
      '',
      '3',
      '00:00:05,000 --> 00:00:06,000',
      'Valid two',
      '',
    ].join('\n');

    const transcript = parseSrt(input);

    expect(transcript.cues).toHaveLength(2);
    expect(transcript.cues.map((c) => c.text)).toEqual(['Valid one', 'Valid two']);
    expect(transcript.cues[1]?.index).toBe(3);
  });

  it('skips a block that is missing its text line', () => {
    const input = [
      '1',
      '00:00:01,000 --> 00:00:02,000',
      '',
      '2',
      '00:00:03,000 --> 00:00:04,000',
      'Has text',
      '',
    ].join('\n');

    const transcript = parseSrt(input);

    expect(transcript.cues).toHaveLength(1);
    expect(transcript.cues[0]?.text).toBe('Has text');
  });

  it('tolerates extra blank lines and trailing whitespace', () => {
    const input = [
      '',
      '',
      '1  ',
      '00:00:01,000 --> 00:00:02,000  ',
      'Padded text   ',
      '',
      '',
      '',
      '2',
      '00:00:03,000 --> 00:00:04,000',
      'Another',
      '',
      '',
    ].join('\n');

    const transcript = parseSrt(input);

    expect(transcript.cues).toHaveLength(2);
    expect(transcript.cues[0]?.text).toBe('Padded text');
    expect(transcript.cues[0]?.index).toBe(1);
    expect(transcript.cues[1]?.text).toBe('Another');
  });

  it('falls back to sequential indices when the index line is non-numeric', () => {
    const input = [
      'x',
      '00:00:01,000 --> 00:00:02,000',
      'First',
      '',
      'y',
      '00:00:03,000 --> 00:00:04,000',
      'Second',
      '',
    ].join('\n');

    const transcript = parseSrt(input);

    expect(transcript.cues).toHaveLength(2);
    expect(transcript.cues[0]?.index).toBe(1);
    expect(transcript.cues[1]?.index).toBe(2);
  });

  it('returns an empty transcript for empty input', () => {
    const transcript = parseSrt('');

    expect(transcript.meta.format).toBe('srt');
    expect(transcript.meta.cueCount).toBe(0);
    expect(transcript.meta.durationMs).toBe(0);
    expect(transcript.cues).toEqual([]);
  });

  it('returns an empty transcript for whitespace-only input', () => {
    const transcript = parseSrt('   \n\n  \r\n  ');

    expect(transcript.cues).toEqual([]);
    expect(transcript.meta.cueCount).toBe(0);
  });

  it('does not throw on garbage input', () => {
    expect(() => parseSrt('not subtitles at all\njust random text')).not.toThrow();
    expect(parseSrt('not subtitles at all\njust random text').cues).toEqual([]);
  });

  it('skips an orphan index/single-line block without throwing (issue #25)', () => {
    const input = '1\n\n00:00:01,000 --> 00:00:02,000\nReal\n';

    const transcript = parseSrt(input);

    expect(transcript.cues).toHaveLength(1);
    expect(transcript.cues[0]?.text).toBe('Real');
    expect(transcript.cues[0]?.startMs).toBe(1000);
  });

  it('parses a dot-millisecond separator equal to comma-millis (issue #25)', () => {
    const dot = ['1', '00:00:01.000 --> 00:00:02.500', 'Dotted', ''].join('\n');
    const comma = ['1', '00:00:01,000 --> 00:00:02,500', 'Dotted', ''].join('\n');

    const dotCue = parseSrt(dot).cues[0];
    const commaCue = parseSrt(comma).cues[0];

    expect(dotCue).toEqual(commaCue);
    expect(dotCue?.startMs).toBe(1000);
    expect(dotCue?.endMs).toBe(2500);
  });

  it('drops a reversed-timestamp cue where endMs precedes startMs (issue #25)', () => {
    const input = [
      '1',
      '00:00:05,000 --> 00:00:01,000',
      'Reversed',
      '',
      '2',
      '00:00:06,000 --> 00:00:08,000',
      'Valid',
      '',
    ].join('\n');

    const transcript = parseSrt(input);

    expect(transcript.cues).toHaveLength(1);
    expect(transcript.cues[0]?.text).toBe('Valid');
  });
});

