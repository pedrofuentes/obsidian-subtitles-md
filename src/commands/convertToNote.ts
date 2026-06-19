/**
 * Convert a subtitle file into a transcript Markdown note.
 *
 * This is the first end-to-end command: it ties the pure pipeline
 * (parse -> reflow -> serialize) to Obsidian's Vault I/O. It reads a `.srt` /
 * `.vtt` file from the vault, converts it to a clean Markdown note, and writes
 * the note as a sibling (or into an explicit target folder) without ever
 * overwriting an existing file.
 *
 * The function is total except for one typed escape hatch: an
 * {@link UnsupportedFormatError} from {@link parseSubtitle} is propagated to the
 * caller (the `main.ts` wrapper surfaces it as a `Notice`). It produces no
 * console output.
 */

import { normalizePath, type App, type TFile } from 'obsidian';
import { parseSubtitle } from '../parser';
import { reflow, type ReflowOptions } from '../transform/reflow';
import {
  serializeToMarkdown,
  type SerializeOptions,
} from '../serialize/markdown';

/** Options controlling {@link convertSubtitleFileToNote}. */
export interface ConvertOptions {
  /** Passed through to {@link reflow}. */
  reflow?: ReflowOptions;
  /** Passed through to {@link serializeToMarkdown}. */
  serialize?: SerializeOptions;
  /**
   * Folder to write the note into. Defaults to the source file's own folder.
   */
  targetFolder?: string;
}

/** Characters illegal in Obsidian/Windows note paths. */
const ILLEGAL_PATH_CHARS = /[\\/:*?"<>|]/g;
// eslint-disable-next-line no-control-regex -- intentionally strip control chars
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/**
 * Make `name` safe to use as a note's base file name: drop control characters,
 * replace path-illegal characters with spaces, collapse whitespace, and trim
 * trailing dots/spaces (which Windows forbids). Falls back to `'transcript'`
 * when nothing usable remains.
 */
function sanitizeBaseName(name: string): string {
  const cleaned = name
    .replace(CONTROL_CHARS, '')
    .replace(ILLEGAL_PATH_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .trim();
  return cleaned === '' ? 'transcript' : cleaned;
}

/**
 * Find the first non-colliding note path in `folder`. Tries `<base>.md`, then
 * `<base> 1.md`, `<base> 2.md`, ... using `getAbstractFileByPath` to detect
 * existing files. The returned path is always normalized.
 */
function findAvailablePath(app: App, folder: string, base: string): string {
  const build = (suffix: string): string =>
    normalizePath(`${folder}/${base}${suffix}.md`);

  let candidate = build('');
  let counter = 1;
  while (app.vault.getAbstractFileByPath(candidate) !== null) {
    candidate = build(` ${counter}`);
    counter += 1;
  }
  return candidate;
}

/**
 * Return the vault-relative folder portion of a file's path (everything before
 * the final `/`), or the empty string when the file lives at the vault root.
 */
function parentFolderPath(file: TFile): string {
  const slash = file.path.lastIndexOf('/');
  return slash === -1 ? '' : file.path.slice(0, slash);
}

/**
 * Read `file` from the vault, convert it through the parse -> reflow ->
 * serialize pipeline, and write the result as a new Markdown note.
 *
 * @param app The Obsidian app, used for vault I/O.
 * @param file The source `.srt` / `.vtt` file to convert.
 * @param options Optional reflow/serialize tuning and a target folder.
 * @returns The newly created note {@link TFile}.
 * @throws {UnsupportedFormatError} When the subtitle format cannot be detected.
 */
export async function convertSubtitleFileToNote(
  app: App,
  file: TFile,
  options: ConvertOptions = {},
): Promise<TFile> {
  const content = await app.vault.read(file);

  const transcript = parseSubtitle(content, { source: file.name });
  const paragraphs = reflow(transcript, options.reflow);
  const markdown = serializeToMarkdown(
    paragraphs,
    transcript.meta,
    options.serialize,
  );

  const folder = options.targetFolder ?? parentFolderPath(file);
  const base = sanitizeBaseName(file.basename);
  const targetPath = findAvailablePath(app, folder, base);

  return app.vault.create(targetPath, markdown);
}
