import { describe, expect, it } from 'vitest';
import type { App, FileStats, TFile, Vault } from 'obsidian';
import { convertSubtitleFileToNote } from './convertToNote';
import { parseSubtitle } from '../parser';
import { reflow } from '../transform/reflow';
import { serializeToMarkdown } from '../serialize/markdown';

/** A created note recorded by the fake vault. */
interface CreatedNote {
  path: string;
  data: string;
}

/**
 * Build a fake Obsidian {@link App}/{@link TFile} pair backed by in-memory
 * content. `existing` seeds paths that `vault.getAbstractFileByPath` should
 * report as already present (to exercise collision handling).
 */
function makeApp(options: {
  name: string;
  basename: string;
  folderPath: string;
  content: string;
  existing?: string[];
}): { app: App; file: TFile; created: CreatedNote[] } {
  const created: CreatedNote[] = [];
  const existing = new Set(options.existing ?? []);

  const vault = {
    read: (): Promise<string> => Promise.resolve(options.content),
    cachedRead: (): Promise<string> => Promise.resolve(options.content),
    getAbstractFileByPath: (path: string): { path: string } | null =>
      existing.has(path) ? { path } : null,
    create: (path: string, data: string): Promise<{ path: string }> => {
      if (existing.has(path)) {
        throw new Error(`refusing to overwrite existing path: ${path}`);
      }
      created.push({ path, data });
      existing.add(path);
      return Promise.resolve({ path });
    },
  } as unknown as Vault;

  const stat: FileStats = { ctime: 0, mtime: 0, size: options.content.length };

  const file: TFile = {
    name: options.name,
    basename: options.basename,
    extension: options.name.split('.').pop() ?? '',
    path: `${options.folderPath}/${options.name}`,
    parent: null,
    stat,
    vault,
  };

  return {
    app: { vault } as unknown as App,
    file,
    created,
  };
}

const SRT_FIXTURE = [
  '1',
  '00:00:01,000 --> 00:00:02,000',
  'Hello world',
  '',
  '2',
  '00:00:02,200 --> 00:00:03,000',
  'Second cue',
  '',
].join('\n');

const VTT_FIXTURE = [
  'WEBVTT',
  '',
  '00:00:01.000 --> 00:00:02.000',
  'Captioned line',
  '',
].join('\n');

describe('convertSubtitleFileToNote', () => {
  it('writes a golden Markdown note as a sanitized sibling .md file', async () => {
    const { app, file, created } = makeApp({
      name: 'episode.srt',
      basename: 'episode',
      folderPath: 'Subtitles',
      content: SRT_FIXTURE,
    });

    const result = await convertSubtitleFileToNote(app, file);

    const transcript = parseSubtitle(SRT_FIXTURE, { source: 'episode.srt' });
    const expected = serializeToMarkdown(reflow(transcript), transcript.meta);

    expect(created).toHaveLength(1);
    expect(created[0]?.path).toBe('Subtitles/episode.md');
    expect(created[0]?.data).toBe(expected);
    expect(result.path).toBe('Subtitles/episode.md');
  });

  it('passes reflow and serialize options through the pipeline', async () => {
    const { app, file, created } = makeApp({
      name: 'clip.vtt',
      basename: 'clip',
      folderPath: 'Notes',
      content: VTT_FIXTURE,
    });

    await convertSubtitleFileToNote(app, file, {
      serialize: { includeFrontmatter: false, timestamps: 'none' },
    });

    const transcript = parseSubtitle(VTT_FIXTURE, { source: 'clip.vtt' });
    const expected = serializeToMarkdown(reflow(transcript), transcript.meta, {
      includeFrontmatter: false,
      timestamps: 'none',
    });

    expect(created[0]?.data).toBe(expected);
  });

  it('honors an explicit targetFolder', async () => {
    const { app, file, created } = makeApp({
      name: 'episode.srt',
      basename: 'episode',
      folderPath: 'Subtitles',
      content: SRT_FIXTURE,
    });

    await convertSubtitleFileToNote(app, file, { targetFolder: 'Transcripts' });

    expect(created[0]?.path).toBe('Transcripts/episode.md');
  });

  it('never overwrites an existing note; picks a non-colliding name', async () => {
    const { app, file, created } = makeApp({
      name: 'episode.srt',
      basename: 'episode',
      folderPath: 'Subtitles',
      content: SRT_FIXTURE,
      existing: ['Subtitles/episode.md'],
    });

    const result = await convertSubtitleFileToNote(app, file);

    expect(created).toHaveLength(1);
    expect(created[0]?.path).toBe('Subtitles/episode 1.md');
    expect(result.path).toBe('Subtitles/episode 1.md');
  });

  it('increments past multiple existing collisions', async () => {
    const { app, file, created } = makeApp({
      name: 'episode.srt',
      basename: 'episode',
      folderPath: 'Subtitles',
      content: SRT_FIXTURE,
      existing: ['Subtitles/episode.md', 'Subtitles/episode 1.md'],
    });

    await convertSubtitleFileToNote(app, file);

    expect(created[0]?.path).toBe('Subtitles/episode 2.md');
  });

  it('sanitizes characters illegal in Obsidian/Windows paths', async () => {
    const { app, file, created } = makeApp({
      name: 'a:b*c?"<>|.srt',
      basename: 'a:b*c?"<>|',
      folderPath: 'Subtitles',
      content: SRT_FIXTURE,
    });

    await convertSubtitleFileToNote(app, file);

    expect(created[0]?.path).toBe('Subtitles/a b c.md');
  });

  it('strips path separators and control characters from the base name', async () => {
    const { app, file, created } = makeApp({
      name: 'weird.srt',
      basename: 'sub\\folder/name\u0007',
      folderPath: 'Subtitles',
      content: SRT_FIXTURE,
    });

    await convertSubtitleFileToNote(app, file);

    expect(created[0]?.path).toBe('Subtitles/sub folder name.md');
  });

  it('propagates UnsupportedFormatError for undetectable input', async () => {
    const { app, file } = makeApp({
      name: 'mystery.txt',
      basename: 'mystery',
      folderPath: 'Subtitles',
      content: 'just some prose with no subtitle structure at all',
    });

    await expect(convertSubtitleFileToNote(app, file)).rejects.toMatchObject({
      name: 'UnsupportedFormatError',
    });
  });
});
