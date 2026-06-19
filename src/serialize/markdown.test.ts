import { describe, it, expect } from 'vitest';
import { serializeToMarkdown, type SerializeOptions } from './markdown';
import type { TranscriptMeta } from '../model';
import type { Paragraph } from '../transform/reflow';

const META: TranscriptMeta = {
  format: 'srt',
  durationMs: 90_000,
  cueCount: 2,
  source: 'example.srt',
};

const TWO_SPEAKERS: Paragraph[] = [
  { speaker: 'Alice', text: 'Hello there.', startMs: 1000, endMs: 3000 },
  { speaker: 'Bob', text: 'Hi Alice.', startMs: 4000, endMs: 6000 },
];

describe('serializeToMarkdown', () => {
  it('uses inline timestamps, bold speakers, and frontmatter by default', () => {
    expect(serializeToMarkdown(TWO_SPEAKERS, META)).toBe(
      [
        '---',
        'source: example.srt',
        'format: srt',
        'duration: 00:01:30',
        'cues: 2',
        '---',
        '',
        '[00:00:01] **Alice:** Hello there.',
        '',
        '[00:00:04] **Bob:** Hi Alice.',
        '',
      ].join('\n'),
    );
  });

  it('omits timestamps when timestamps is "none"', () => {
    const options: SerializeOptions = { timestamps: 'none' };

    expect(serializeToMarkdown(TWO_SPEAKERS, META, options)).toBe(
      [
        '---',
        'source: example.srt',
        'format: srt',
        'duration: 00:01:30',
        'cues: 2',
        '---',
        '',
        '**Alice:** Hello there.',
        '',
        '**Bob:** Hi Alice.',
        '',
      ].join('\n'),
    );
  });

  it('renders timestamps as a trailing marker when timestamps is "aside"', () => {
    const options: SerializeOptions = { timestamps: 'aside' };

    expect(serializeToMarkdown(TWO_SPEAKERS, META, options)).toBe(
      [
        '---',
        'source: example.srt',
        'format: srt',
        'duration: 00:01:30',
        'cues: 2',
        '---',
        '',
        '**Alice:** Hello there. ^[00:00:01]',
        '',
        '**Bob:** Hi Alice. ^[00:00:04]',
        '',
      ].join('\n'),
    );
  });

  it('omits frontmatter when includeFrontmatter is false', () => {
    const options: SerializeOptions = { includeFrontmatter: false };

    expect(serializeToMarkdown(TWO_SPEAKERS, META, options)).toBe(
      [
        '[00:00:01] **Alice:** Hello there.',
        '',
        '[00:00:04] **Bob:** Hi Alice.',
        '',
      ].join('\n'),
    );
  });

  it('renders speakers as headings when speakerStyle is "heading"', () => {
    const options: SerializeOptions = { speakerStyle: 'heading' };

    expect(serializeToMarkdown(TWO_SPEAKERS, META, options)).toBe(
      [
        '---',
        'source: example.srt',
        'format: srt',
        'duration: 00:01:30',
        'cues: 2',
        '---',
        '',
        '#### Alice',
        '[00:00:01] Hello there.',
        '',
        '#### Bob',
        '[00:00:04] Hi Alice.',
        '',
      ].join('\n'),
    );
  });

  it('renders paragraphs without speakers and omits the source key when absent', () => {
    const meta: TranscriptMeta = { format: 'srt', durationMs: 7000, cueCount: 2 };
    const paragraphs: Paragraph[] = [
      { text: 'First line.', startMs: 0, endMs: 2000 },
      { text: 'Second line.', startMs: 5000, endMs: 7000 },
    ];

    expect(serializeToMarkdown(paragraphs, meta)).toBe(
      [
        '---',
        'format: srt',
        'duration: 00:00:07',
        'cues: 2',
        '---',
        '',
        '[00:00:00] First line.',
        '',
        '[00:00:05] Second line.',
        '',
      ].join('\n'),
    );
  });

  it('emits only frontmatter for empty input when frontmatter is enabled', () => {
    const meta: TranscriptMeta = { format: 'vtt', durationMs: 0, cueCount: 0 };

    expect(serializeToMarkdown([], meta)).toBe(
      ['---', 'format: vtt', 'duration: 00:00:00', 'cues: 0', '---', ''].join('\n'),
    );
  });

  it('emits an empty string for empty input when frontmatter is disabled', () => {
    const meta: TranscriptMeta = { format: 'vtt', durationMs: 0, cueCount: 0 };

    expect(serializeToMarkdown([], meta, { includeFrontmatter: false })).toBe('');
  });

  it('serializes a multi-paragraph, multi-speaker transcript', () => {
    const meta: TranscriptMeta = {
      format: 'vtt',
      durationMs: 8000,
      cueCount: 7,
      source: 'episode.vtt',
    };
    const paragraphs: Paragraph[] = [
      { speaker: 'Alice', text: 'Welcome to the show.', startMs: 0, endMs: 3000 },
      { speaker: 'Bob', text: 'Thanks for having me.', startMs: 3500, endMs: 6000 },
      { text: '[Applause]', startMs: 6500, endMs: 8000 },
    ];

    expect(serializeToMarkdown(paragraphs, meta)).toBe(
      [
        '---',
        'source: episode.vtt',
        'format: vtt',
        'duration: 00:00:08',
        'cues: 7',
        '---',
        '',
        '[00:00:00] **Alice:** Welcome to the show.',
        '',
        '[00:00:03] **Bob:** Thanks for having me.',
        '',
        '[00:00:06] [Applause]',
        '',
      ].join('\n'),
    );
  });

  it('ends the output with exactly one trailing newline', () => {
    const output = serializeToMarkdown(TWO_SPEAKERS, META);

    expect(output.endsWith('\n')).toBe(true);
    expect(output.endsWith('\n\n')).toBe(false);
  });

  it('does not mutate its inputs', () => {
    const meta: TranscriptMeta = {
      format: 'srt',
      durationMs: 90_000,
      cueCount: 2,
      source: 'example.srt',
    };
    const paragraphs: Paragraph[] = [
      { speaker: 'Alice', text: 'Hello there.', startMs: 1000, endMs: 3000 },
      { speaker: 'Bob', text: 'Hi Alice.', startMs: 4000, endMs: 6000 },
    ];
    const metaSnapshot = structuredClone(meta);
    const paragraphsSnapshot = structuredClone(paragraphs);

    serializeToMarkdown(paragraphs, meta, { speakerStyle: 'heading', timestamps: 'aside' });

    expect(meta).toEqual(metaSnapshot);
    expect(paragraphs).toEqual(paragraphsSnapshot);
  });
});
