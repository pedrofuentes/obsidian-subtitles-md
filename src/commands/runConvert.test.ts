import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { App, TFile, Vault, Workspace, WorkspaceLeaf } from 'obsidian';
import { runConvertActiveFile, runConvertFile } from './runConvert';

const { noticeMessages } = vi.hoisted(() => ({
  noticeMessages: [] as string[],
}));

vi.mock('obsidian', async () => {
  const actual =
    await vi.importActual<typeof import('obsidian')>('obsidian');
  return {
    ...actual,
    Notice: class {
      constructor(message: string) {
        noticeMessages.push(message);
      }
    },
  };
});

/** A note created by the in-memory fake vault. */
interface CreatedNote {
  path: string;
  data: string;
}

/**
 * Build a fake Obsidian {@link App} with an in-memory vault and a workspace
 * whose active file and leaf behavior can be controlled per test.
 */
function makeApp(options: {
  active: TFile | null;
  content?: string;
  readRejects?: boolean;
}): {
  app: App;
  created: CreatedNote[];
  opened: TFile[];
} {
  const created: CreatedNote[] = [];
  const opened: TFile[] = [];
  const existing = new Set<string>();

  const vault = {
    read: (): Promise<string> =>
      options.readRejects
        ? Promise.reject(new Error('disk on fire'))
        : Promise.resolve(options.content ?? ''),
    getAbstractFileByPath: (path: string): { path: string } | null =>
      existing.has(path) ? { path } : null,
    create: (path: string, data: string): Promise<TFile> => {
      created.push({ path, data });
      existing.add(path);
      const slash = path.lastIndexOf('/');
      const name = slash === -1 ? path : path.slice(slash + 1);
      const basename = name.endsWith('.md') ? name.slice(0, -3) : name;
      const note: TFile = {
        name,
        basename,
        extension: 'md',
        path,
        parent: null,
        stat: { ctime: 0, mtime: 0, size: data.length },
        vault,
      };
      return Promise.resolve(note);
    },
  } as unknown as Vault;

  const leaf = {
    openFile: (file: TFile): Promise<void> => {
      opened.push(file);
      return Promise.resolve();
    },
  } as unknown as WorkspaceLeaf;

  const workspace = {
    getActiveFile: (): TFile | null => options.active,
    getLeaf: (): WorkspaceLeaf => leaf,
  } as unknown as Workspace;

  return {
    app: { vault, workspace } as unknown as App,
    created,
    opened,
  };
}

/** Build a fake {@link TFile} for the given name/folder. */
function makeFile(name: string, folderPath: string): TFile {
  const basename = name.includes('.')
    ? name.slice(0, name.lastIndexOf('.'))
    : name;
  const file: TFile = {
    name,
    basename,
    extension: name.split('.').pop() ?? '',
    path: folderPath === '' ? name : `${folderPath}/${name}`,
    parent: null,
    stat: { ctime: 0, mtime: 0, size: 0 },
    vault: {} as Vault,
  };
  return file;
}

const SRT_FIXTURE = [
  '1',
  '00:00:01,000 --> 00:00:02,000',
  'Hello world',
  '',
].join('\n');

describe('runConvertActiveFile', () => {
  beforeEach(() => {
    noticeMessages.length = 0;
  });

  it('converts an active .srt file, opens the new note, and shows success', async () => {
    const file = makeFile('episode.srt', 'Subtitles');
    const { app, created, opened } = makeApp({
      active: file,
      content: SRT_FIXTURE,
    });

    await runConvertActiveFile(app);

    expect(created).toHaveLength(1);
    expect(created[0]?.path).toBe('Subtitles/episode.md');
    expect(opened).toHaveLength(1);
    expect(opened[0]?.path).toBe('Subtitles/episode.md');
    expect(noticeMessages).toHaveLength(1);
    expect(noticeMessages[0]).toContain('episode');
  });

  it('converts an active .vtt file', async () => {
    const file = makeFile('clip.vtt', 'Notes');
    const { app, created, opened } = makeApp({
      active: file,
      content: ['WEBVTT', '', '00:00:01.000 --> 00:00:02.000', 'Hi', ''].join(
        '\n',
      ),
    });

    await runConvertActiveFile(app);

    expect(created).toHaveLength(1);
    expect(created[0]?.path).toBe('Notes/clip.md');
    expect(opened[0]?.path).toBe('Notes/clip.md');
  });

  it('passes options through to the conversion pipeline', async () => {
    const file = makeFile('episode.srt', 'Subtitles');
    const { app, created } = makeApp({
      active: file,
      content: SRT_FIXTURE,
    });

    await runConvertActiveFile(app, { targetFolder: 'Transcripts' });

    expect(created[0]?.path).toBe('Transcripts/episode.md');
  });

  it('shows guidance and does nothing when there is no active file', async () => {
    const { app, created, opened } = makeApp({ active: null });

    await runConvertActiveFile(app);

    expect(created).toHaveLength(0);
    expect(opened).toHaveLength(0);
    expect(noticeMessages).toEqual(['Open a .srt or .vtt file first']);
  });

  it('shows guidance when the active file is not a subtitle file', async () => {
    const file = makeFile('note.md', 'Notes');
    const { app, created } = makeApp({ active: file, content: 'hi' });

    await runConvertActiveFile(app);

    expect(created).toHaveLength(0);
    expect(noticeMessages).toEqual(['Open a .srt or .vtt file first']);
  });

  it('surfaces conversion errors as a Notice without throwing', async () => {
    const file = makeFile('broken.srt', 'Subtitles');
    const { app, created, opened } = makeApp({
      active: file,
      readRejects: true,
    });

    await expect(runConvertActiveFile(app)).resolves.toBeUndefined();

    expect(created).toHaveLength(0);
    expect(opened).toHaveLength(0);
    expect(noticeMessages).toHaveLength(1);
    expect(noticeMessages[0]).toBe('Could not convert: disk on fire');
  });
});

describe('runConvertFile', () => {
  beforeEach(() => {
    noticeMessages.length = 0;
  });

  it('converts the given file (not the active one), opens the note, and shows success', async () => {
    const file = makeFile('episode.srt', 'Subtitles');
    // `active: null` proves the passed-in file drives the conversion.
    const { app, created, opened } = makeApp({
      active: null,
      content: SRT_FIXTURE,
    });

    await runConvertFile(app, file);

    expect(created).toHaveLength(1);
    expect(created[0]?.path).toBe('Subtitles/episode.md');
    expect(opened).toHaveLength(1);
    expect(opened[0]?.path).toBe('Subtitles/episode.md');
    expect(noticeMessages).toHaveLength(1);
    expect(noticeMessages[0]).toContain('episode');
  });

  it('passes options through to the conversion pipeline', async () => {
    const file = makeFile('episode.srt', 'Subtitles');
    const { app, created } = makeApp({ active: null, content: SRT_FIXTURE });

    await runConvertFile(app, file, { targetFolder: 'Transcripts' });

    expect(created[0]?.path).toBe('Transcripts/episode.md');
  });

  it('shows guidance and does nothing for a non-subtitle file', async () => {
    const file = makeFile('note.md', 'Notes');
    const { app, created } = makeApp({ active: null, content: 'hi' });

    await runConvertFile(app, file);

    expect(created).toHaveLength(0);
    expect(noticeMessages).toEqual(['Open a .srt or .vtt file first']);
  });

  it('surfaces conversion errors as a Notice without throwing', async () => {
    const file = makeFile('broken.srt', 'Subtitles');
    const { app, created, opened } = makeApp({
      active: null,
      readRejects: true,
    });

    await expect(runConvertFile(app, file)).resolves.toBeUndefined();

    expect(created).toHaveLength(0);
    expect(opened).toHaveLength(0);
    expect(noticeMessages).toEqual(['Could not convert: disk on fire']);
  });
});
