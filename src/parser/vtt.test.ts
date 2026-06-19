import { describe, it, expect } from 'vitest';
import { parseVtt } from './vtt';

describe('parseVtt', () => {
  it('parses a simple WEBVTT file into a transcript', () => {
    const input = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:04.000',
      'Hello world',
      '',
      '00:00:05.500 --> 00:00:07.250',
      'Second cue',
    ].join('\n');

    const transcript = parseVtt(input);

    expect(transcript.meta.format).toBe('vtt');
    expect(transcript.meta.cueCount).toBe(2);
    expect(transcript.meta.durationMs).toBe(7250);
    expect(transcript.cues).toEqual([
      { index: 1, startMs: 1000, endMs: 4000, text: 'Hello world' },
      { index: 2, startMs: 5500, endMs: 7250, text: 'Second cue' },
    ]);
  });

  it('accepts timestamps without an hours component (MM:SS.mmm)', () => {
    const input = ['WEBVTT', '', '01:02.500 --> 01:05.000', 'Short form'].join(
      '\n',
    );

    const transcript = parseVtt(input);

    expect(transcript.cues).toHaveLength(1);
    expect(transcript.cues[0]?.startMs).toBe(62500);
    expect(transcript.cues[0]?.endMs).toBe(65000);
    expect(transcript.cues[0]?.text).toBe('Short form');
  });

  it('extracts a speaker from a closed voice tag and strips the markup', () => {
    const input = [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:02.000',
      '<v Alice>Hi there</v>',
    ].join('\n');

    const transcript = parseVtt(input);

    expect(transcript.cues[0]?.speaker).toBe('Alice');
    expect(transcript.cues[0]?.text).toBe('Hi there');
  });

  it('extracts a speaker from an unclosed voice tag', () => {
    const input = [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:02.000',
      '<v Bob>No closing tag here',
    ].join('\n');

    const transcript = parseVtt(input);

    expect(transcript.cues[0]?.speaker).toBe('Bob');
    expect(transcript.cues[0]?.text).toBe('No closing tag here');
  });

  it('handles multiple speakers across cues', () => {
    const input = [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:02.000',
      '<v Alice>Hello</v>',
      '',
      '00:00:02.000 --> 00:00:04.000',
      '<v Bob>Hi Alice</v>',
    ].join('\n');

    const transcript = parseVtt(input);

    expect(transcript.cues[0]?.speaker).toBe('Alice');
    expect(transcript.cues[1]?.speaker).toBe('Bob');
    expect(transcript.cues[1]?.text).toBe('Hi Alice');
  });

  it('strips cue settings from the timing line but keeps the timestamps', () => {
    const input = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000 align:start position:10%',
      'Positioned text',
    ].join('\n');

    const transcript = parseVtt(input);

    expect(transcript.cues[0]?.startMs).toBe(1000);
    expect(transcript.cues[0]?.endMs).toBe(3000);
    expect(transcript.cues[0]?.text).toBe('Positioned text');
  });

  it('ignores NOTE comment blocks', () => {
    const input = [
      'WEBVTT',
      '',
      'NOTE This is a comment',
      'spanning two lines',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'Visible cue',
    ].join('\n');

    const transcript = parseVtt(input);

    expect(transcript.cues).toHaveLength(1);
    expect(transcript.cues[0]?.text).toBe('Visible cue');
  });

  it('supports an optional cue identifier line before the timing line', () => {
    const input = [
      'WEBVTT',
      '',
      'intro-1',
      '00:00:01.000 --> 00:00:02.000',
      'With an id',
    ].join('\n');

    const transcript = parseVtt(input);

    expect(transcript.cues).toHaveLength(1);
    expect(transcript.cues[0]?.text).toBe('With an id');
  });

  it('strips a leading UTF-8 BOM', () => {
    const input = '\uFEFFWEBVTT\n\n00:00:01.000 --> 00:00:02.000\nBOM cue';

    const transcript = parseVtt(input);

    expect(transcript.cues).toHaveLength(1);
    expect(transcript.cues[0]?.text).toBe('BOM cue');
  });

  it('handles CRLF line endings', () => {
    const input = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'CRLF cue',
    ].join('\r\n');

    const transcript = parseVtt(input);

    expect(transcript.cues).toHaveLength(1);
    expect(transcript.cues[0]?.text).toBe('CRLF cue');
  });

  it('joins multi-line cue text with newlines', () => {
    const input = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'Line one',
      'Line two',
    ].join('\n');

    const transcript = parseVtt(input);

    expect(transcript.cues[0]?.text).toBe('Line one\nLine two');
  });

  it('strips inline tags leaving readable text', () => {
    const input = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      '<c.yellow>Bright</c> and <b>bold</b> and <i>italic</i> <00:00:01.500>now',
    ].join('\n');

    const transcript = parseVtt(input);

    expect(transcript.cues[0]?.text).toBe('Bright and bold and italic now');
  });

  it('skips a malformed block among valid ones', () => {
    const input = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'Valid one',
      '',
      'not-a-timestamp --> still-not',
      'Should be skipped',
      '',
      '00:00:03.000 --> 00:00:04.000',
      'Valid two',
    ].join('\n');

    const transcript = parseVtt(input);

    expect(transcript.cues).toHaveLength(2);
    expect(transcript.cues.map((c) => c.text)).toEqual([
      'Valid one',
      'Valid two',
    ]);
    expect(transcript.cues[1]?.index).toBe(2);
  });

  it('returns an empty transcript for empty input', () => {
    const transcript = parseVtt('');

    expect(transcript.meta.format).toBe('vtt');
    expect(transcript.cues).toHaveLength(0);
    expect(transcript.meta.durationMs).toBe(0);
  });

  it('returns an empty transcript for a WEBVTT-only file', () => {
    const transcript = parseVtt('WEBVTT\n');

    expect(transcript.cues).toHaveLength(0);
  });

  it('tolerates a header with metadata and trailing whitespace', () => {
    const input = [
      'WEBVTT - Some title',
      'Kind: captions',
      'Language: en',
      '',
      '00:00:01.000 --> 00:00:02.000   ',
      'Header metadata cue   ',
    ].join('\n');

    const transcript = parseVtt(input);

    expect(transcript.cues).toHaveLength(1);
    expect(transcript.cues[0]?.text).toBe('Header metadata cue');
  });

  it('never throws and skips a block whose timing line is unparseable', () => {
    const input = [
      'WEBVTT',
      '',
      '00:00:01.000 -> 00:00:02.000',
      'Bad arrow',
    ].join('\n');

    expect(() => parseVtt(input)).not.toThrow();
    expect(parseVtt(input).cues).toHaveLength(0);
  });

  it('assigns sequential 1-based indices ignoring source identifiers', () => {
    const input = [
      'WEBVTT',
      '',
      '99',
      '00:00:01.000 --> 00:00:02.000',
      'First',
      '',
      'second-id',
      '00:00:02.000 --> 00:00:03.000',
      'Second',
    ].join('\n');

    const transcript = parseVtt(input);

    expect(transcript.cues.map((c) => c.index)).toEqual([1, 2]);
  });

  it('handles an adversarial voice tag in bounded time (no ReDoS)', () => {
    const malicious = '<v' + '.a'.repeat(60);
    const input = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      malicious,
    ].join('\n');

    const start = performance.now();
    const transcript = parseVtt(input);
    const elapsedMs = performance.now() - start;

    expect(elapsedMs).toBeLessThan(50);
    expect(transcript.cues[0]?.speaker).toBeUndefined();
  });

  it('skips a cue whose end precedes its start (reversed timing)', () => {
    const input = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:04.000',
      'Valid before',
      '',
      '00:00:05.000 --> 00:00:01.000',
      'Reversed cue',
      '',
      '00:00:06.000 --> 00:00:08.000',
      'Valid after',
    ].join('\n');

    const transcript = parseVtt(input);

    expect(transcript.cues.map((c) => c.text)).toEqual([
      'Valid before',
      'Valid after',
    ]);
    expect(transcript.cues.map((c) => c.index)).toEqual([1, 2]);
  });
});
