import { describe, it, expect } from 'vitest';
import { reflow, type Paragraph } from './reflow';
import type { Cue, Transcript } from '../model';

function makeCue(overrides: Partial<Cue> = {}): Cue {
  return {
    index: 1,
    startMs: 0,
    endMs: 1000,
    text: 'hello',
    ...overrides,
  };
}

function makeTranscript(cues: Cue[]): Transcript {
  const durationMs = cues.reduce((max, c) => Math.max(max, c.endMs), 0);
  return {
    cues,
    meta: { format: 'srt', durationMs, cueCount: cues.length },
  };
}

describe('reflow', () => {
  it('returns an empty array for an empty transcript', () => {
    expect(reflow(makeTranscript([]))).toEqual([]);
  });

  it('produces a single paragraph from a single cue', () => {
    const cues = [makeCue({ index: 1, startMs: 500, endMs: 2500, text: 'hello world' })];

    const paragraphs = reflow(makeTranscript(cues));

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toEqual<Paragraph>({
      text: 'hello world',
      startMs: 500,
      endMs: 2500,
    });
  });

  it('merges consecutive cues into one paragraph joined by a single space', () => {
    const cues = [
      makeCue({ index: 1, startMs: 0, endMs: 1000, text: 'the quick' }),
      makeCue({ index: 2, startMs: 1000, endMs: 2000, text: 'brown fox' }),
      makeCue({ index: 3, startMs: 2000, endMs: 3000, text: 'jumps' }),
    ];

    const paragraphs = reflow(makeTranscript(cues));

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]?.text).toBe('the quick brown fox jumps');
    expect(paragraphs[0]?.startMs).toBe(0);
    expect(paragraphs[0]?.endMs).toBe(3000);
  });

  it('normalizes intra-cue newlines and collapses internal whitespace', () => {
    const cues = [
      makeCue({ index: 1, startMs: 0, endMs: 1000, text: '  the\nquick   brown ' }),
      makeCue({ index: 2, startMs: 1000, endMs: 2000, text: 'fox\n\njumps' }),
    ];

    const paragraphs = reflow(makeTranscript(cues));

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]?.text).toBe('the quick brown fox jumps');
  });

  it('splits into separate paragraphs when the speaker changes', () => {
    const cues = [
      makeCue({ index: 1, startMs: 0, endMs: 1000, text: 'hi there', speaker: 'Alice' }),
      makeCue({ index: 2, startMs: 1000, endMs: 2000, text: 'how are you', speaker: 'Alice' }),
      makeCue({ index: 3, startMs: 2000, endMs: 3000, text: 'great thanks', speaker: 'Bob' }),
    ];

    const paragraphs = reflow(makeTranscript(cues));

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toEqual<Paragraph>({
      speaker: 'Alice',
      text: 'hi there how are you',
      startMs: 0,
      endMs: 2000,
    });
    expect(paragraphs[1]).toEqual<Paragraph>({
      speaker: 'Bob',
      text: 'great thanks',
      startMs: 2000,
      endMs: 3000,
    });
  });

  it('does not split on speaker change when breakOnSpeakerChange is false', () => {
    const cues = [
      makeCue({ index: 1, startMs: 0, endMs: 1000, text: 'one', speaker: 'Alice' }),
      makeCue({ index: 2, startMs: 1000, endMs: 2000, text: 'two', speaker: 'Bob' }),
    ];

    const paragraphs = reflow(makeTranscript(cues), { breakOnSpeakerChange: false });

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]?.text).toBe('one two');
  });

  it('splits into a new paragraph when the time gap exceeds the threshold', () => {
    const cues = [
      makeCue({ index: 1, startMs: 0, endMs: 1000, text: 'before the gap' }),
      makeCue({ index: 2, startMs: 5000, endMs: 6000, text: 'after the gap' }),
    ];

    const paragraphs = reflow(makeTranscript(cues), { gapThresholdMs: 2000 });

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.text).toBe('before the gap');
    expect(paragraphs[0]?.endMs).toBe(1000);
    expect(paragraphs[1]?.text).toBe('after the gap');
    expect(paragraphs[1]?.startMs).toBe(5000);
  });

  it('keeps cues together when the gap is within the threshold', () => {
    const cues = [
      makeCue({ index: 1, startMs: 0, endMs: 1000, text: 'still' }),
      makeCue({ index: 2, startMs: 1500, endMs: 2500, text: 'together' }),
    ];

    const paragraphs = reflow(makeTranscript(cues), { gapThresholdMs: 2000 });

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]?.text).toBe('still together');
  });

  it('uses a default gap threshold of 2000ms when options are omitted', () => {
    const cues = [
      makeCue({ index: 1, startMs: 0, endMs: 1000, text: 'first' }),
      makeCue({ index: 2, startMs: 1500, endMs: 2500, text: 'second' }),
      makeCue({ index: 3, startMs: 5000, endMs: 6000, text: 'third' }),
    ];

    const paragraphs = reflow(makeTranscript(cues));

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.text).toBe('first second');
    expect(paragraphs[1]?.text).toBe('third');
  });

  it('splits on sentence end by default', () => {
    const cues = [
      makeCue({ index: 1, startMs: 0, endMs: 1000, text: 'This is done.' }),
      makeCue({ index: 2, startMs: 1000, endMs: 2000, text: 'And this continues' }),
    ];

    const paragraphs = reflow(makeTranscript(cues));

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.text).toBe('This is done.');
    expect(paragraphs[1]?.text).toBe('And this continues');
  });

  it('does not split on sentence end when breakOnSentenceEnd is false', () => {
    const cues = [
      makeCue({ index: 1, startMs: 0, endMs: 1000, text: 'This is done.' }),
      makeCue({ index: 2, startMs: 1000, endMs: 2000, text: 'And this continues' }),
    ];

    const paragraphs = reflow(makeTranscript(cues), { breakOnSentenceEnd: false });

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]?.text).toBe('This is done. And this continues');
  });

  it('splits at sentence-ending punctuation when breakOnSentenceEnd is true', () => {
    const cues = [
      makeCue({ index: 1, startMs: 0, endMs: 1000, text: 'First sentence.' }),
      makeCue({ index: 2, startMs: 1000, endMs: 2000, text: 'Second sentence!' }),
      makeCue({ index: 3, startMs: 2000, endMs: 3000, text: 'Third one' }),
    ];

    const paragraphs = reflow(makeTranscript(cues), { breakOnSentenceEnd: true });

    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0]?.text).toBe('First sentence.');
    expect(paragraphs[0]?.endMs).toBe(1000);
    expect(paragraphs[1]?.text).toBe('Second sentence!');
    expect(paragraphs[2]?.text).toBe('Third one');
  });

  it('treats a question-mark sentence end as a boundary when breakOnSentenceEnd is true', () => {
    const cues = [
      makeCue({ index: 1, startMs: 0, endMs: 1000, text: 'Are you sure?' }),
      makeCue({ index: 2, startMs: 1000, endMs: 2000, text: 'Yes I am' }),
    ];

    const paragraphs = reflow(makeTranscript(cues), { breakOnSentenceEnd: true });

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.text).toBe('Are you sure?');
    expect(paragraphs[1]?.text).toBe('Yes I am');
  });

  it('combines sentence-end and speaker rules to split on whichever applies first', () => {
    const cues = [
      makeCue({ index: 1, startMs: 0, endMs: 1000, text: 'Hello there.', speaker: 'Alice' }),
      makeCue({ index: 2, startMs: 1000, endMs: 2000, text: 'How are you', speaker: 'Alice' }),
      makeCue({ index: 3, startMs: 2000, endMs: 3000, text: 'Fine', speaker: 'Bob' }),
    ];

    const paragraphs = reflow(makeTranscript(cues), { breakOnSentenceEnd: true });

    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0]?.text).toBe('Hello there.');
    expect(paragraphs[1]).toEqual<Paragraph>({
      speaker: 'Alice',
      text: 'How are you',
      startMs: 1000,
      endMs: 2000,
    });
    expect(paragraphs[2]?.speaker).toBe('Bob');
  });

  it('omits the speaker field when cues have no speaker', () => {
    const cues = [makeCue({ index: 1, startMs: 0, endMs: 1000, text: 'anon' })];

    const paragraphs = reflow(makeTranscript(cues));

    expect(paragraphs[0]?.speaker).toBeUndefined();
    expect('speaker' in (paragraphs[0] as Paragraph)).toBe(false);
  });

  it('does not mutate the input transcript cues', () => {
    const cues = [makeCue({ index: 1, startMs: 0, endMs: 1000, text: ' raw\ntext ' })];
    const transcript = makeTranscript(cues);

    reflow(transcript);

    expect(transcript.cues[0]?.text).toBe(' raw\ntext ');
  });
});
